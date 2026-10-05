import { useState, useEffect } from 'react';
import api from '../../services/api';

/**
 * Formatea un número de tarjeta con espacios cada 4 dígitos.
 */
function formatCardNumber(value) {
  const cleaned = value.replace(/\D/g, '').slice(0, 16);
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Formatea la fecha de expiración como MM/YY.
 */
function formatExpiry(value) {
  const cleaned = value.replace(/\D/g, '').slice(0, 4);
  if (cleaned.length >= 3) {
    return cleaned.slice(0, 2) + '/' + cleaned.slice(2);
  }
  return cleaned;
}

export default function EditBookingModal({ isOpen, onClose, onSuccess, booking }) {
  const [checkIn, setCheckIn] = useState(booking?.checkIn || '');
  const [checkOut, setCheckOut] = useState(booking?.checkOut || '');
  
  const [availableRooms, setAvailableRooms] = useState([]);
  const [roomId, setRoomId] = useState('');

  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  // Datos del huésped
  const [guestName, setGuestName] = useState('');
  const [guestSurname, setGuestSurname] = useState('');
  const [documentType, setDocumentType] = useState('DNI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  // Acompañantes
  const [companions, setCompanions] = useState([]);
  
  // Cupones
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');

  // Pasarela de Pagos
  const [cardData, setCardData] = useState({
    cardNumber: '',
    cardExpiry: '',
    cardCvc: '',
    cardHolder: ''
  });
  const [paymentResult, setPaymentResult] = useState(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (checkIn && checkOut && !booking) {
      const capacity = parseInt(adults || 1) + parseInt(children || 0);
      api.get(`/rooms/available?check_in=${checkIn}&check_out=${checkOut}&capacity=${capacity}`)
        .then(res => {
          setAvailableRooms(res.data);
          setRoomId(current => {
             const stillExists = res.data.some(r => r.id.toString() === current);
             if (!stillExists && res.data.length > 0) return res.data[0].id.toString();
             if (res.data.length === 0) return '';
             return current;
          });
        })
        .catch(err => console.error(err));
    }
  }, [checkIn, checkOut, booking, adults, children]);

  const handleSearchGuest = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length >= 2) {
      try {
        const res = await api.get(`/guests/search?query=${query}`);
        setSearchResults(res.data);
      } catch (err) {
        console.error(err);
      }
    } else {
      setSearchResults([]);
    }
  };

  const selectGuest = (guest) => {
    setGuestName(guest.name);
    setGuestSurname(guest.surname);
    setDocumentType(guest.document_type);
    setDocumentNumber(guest.document_number);
    setGuestEmail(guest.email);
    setGuestPhone(guest.phone || '');
    setSearchQuery('');
    setSearchResults([]);
  };

  // Helper para capacidades de habitaciones dinámicas
  const getRoomCapacity = (id) => {
    if (booking && booking.room) return booking.room.capacity;
    const room = availableRooms.find(r => r.id.toString() === id);
    return room ? room.capacity : 2;
  };

  const handleAddCompanion = () => {
    const capacity = getRoomCapacity(roomId);
    if (companions.length + 1 >= capacity) {
      alert(`No puedes añadir más acompañantes. La capacidad máxima de esta habitación es ${capacity} persona(s).`);
      return;
    }
    setCompanions([...companions, { 
      name: '', surname: '', document_type: 'DNI', document_number: '', email: '', phone: '', searchQuery: '', searchResults: [] 
    }]);
  };

  const handleSearchCompanion = async (index, query) => {
    updateCompanion(index, 'searchQuery', query);
    if (query.length >= 2) {
      try {
        const res = await api.get(`/guests/search?query=${query}`);
        updateCompanion(index, 'searchResults', res.data);
      } catch (err) {
        console.error(err);
      }
    } else {
      updateCompanion(index, 'searchResults', []);
    }
  };

  const selectCompanionGuest = (index, guest) => {
    const newCompanions = [...companions];
    newCompanions[index] = {
      ...newCompanions[index],
      name: guest.name,
      surname: guest.surname,
      document_type: guest.document_type,
      document_number: guest.document_number,
      email: guest.email,
      phone: guest.phone || '',
      searchQuery: '',
      searchResults: []
    };
    setCompanions(newCompanions);
  };

  const updateCompanion = (index, field, value) => {
    const newCompanions = [...companions];
    newCompanions[index][field] = value;
    setCompanions(newCompanions);
  };

  const removeCompanion = (index) => {
    const newCompanions = companions.filter((_, i) => i !== index);
    setCompanions(newCompanions);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const res = await api.post('/coupons/validate', { code: couponCode.trim() });
      setAppliedCoupon(res.data.coupon);
      setCouponError('');
    } catch (err) {
      setCouponError(err.response?.data?.error || 'Cupón inválido');
      setAppliedCoupon(null);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  if (!isOpen) return null;

  const handleCardChange = (field, value) => {
    let val = value;
    if (field === 'cardNumber') val = formatCardNumber(val);
    if (field === 'cardExpiry') val = formatExpiry(val);
    if (field === 'cardCvc') val = val.replace(/\D/g, '').slice(0, 4);
    if (field === 'cardHolder') val = val.replace(/[0-9]/g, '');
    setCardData(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (booking) {
      alert('Simulación: Edición de reserva no implementada en este demo');
      onClose();
      return;
    }

    if (!cardData.cardNumber || !cardData.cardExpiry || !cardData.cardCvc || !cardData.cardHolder) {
      setError('Por favor complete los datos de la tarjeta en la Pasarela de Pagos.');
      return;
    }

    setLoading(true);
    try {
      // 1. Crear intención de pago
      const intentRes = await api.post('/payments/checkout-intent', {
        room_id: parseInt(roomId),
        check_in: checkIn,
        check_out: checkOut,
        guest_name: guestName,
        guest_surname: guestSurname,
        guest_email: guestEmail,
        document_type: documentType,
        document_number: documentNumber,
        guest_phone: guestPhone,
        companions: companions,
        notes: "Reserva creada manualmente desde recepción",
        coupon_code: appliedCoupon ? appliedCoupon.code : null
      });

      const bookingCode = intentRes.data.booking_code;

      // 2. Procesar pago en pasarela simulada
      const paymentRes = await api.post('/payments/process-mock', {
        booking_code: bookingCode,
        card_number: cardData.cardNumber.replace(/\s/g, ''),
        card_expiry: cardData.cardExpiry,
        card_cvc: cardData.cardCvc,
        card_holder: cardData.cardHolder.trim()
      });

      setPaymentResult(paymentRes.data);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error al procesar el cobro o reserva en la pasarela.');
    } finally {
      setLoading(false);
    }
  };

  if (paymentResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1c19]/80 backdrop-blur-sm p-4">
        <div className="bg-[#fbf9f4] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-[#d1c5af]">
          <div className="flex justify-between items-center p-6 border-b border-[#d1c5af] bg-[#f5f3ee]">
            <h2 className="font-serif text-2xl font-bold text-[#14213d] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#755b00]">receipt_long</span>
              Comprobante de Pago
            </h2>
            <button onClick={onClose} className="text-[#4d4635] hover:text-[#ba1a1a] transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="overflow-y-auto p-6 space-y-6">
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#c9a227]/20 border-2 border-[#c9a227] mb-4">
                <span className="material-symbols-outlined text-4xl text-[#c9a227]">check_circle</span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#14213d] mb-1">¡Pago Confirmado!</h3>
              <p className="font-sans text-sm text-[#4d4635]">La reserva manual ha sido creada y cobrada exitosamente.</p>
            </div>

            <div className="bg-[#f5f3ee] border-2 border-dashed border-[#c9a227] p-5 text-center">
              <span className="font-mono text-[11px] uppercase font-bold text-[#755b00] tracking-widest block mb-1">
                Código Único de Reserva
              </span>
              <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[#14213d] tracking-wider">
                {paymentResult.booking_code}
              </div>
            </div>

            <div className="bg-[#f5f3ee] border border-[#d1c5af] p-5 space-y-3">
              <h4 className="font-mono text-xs uppercase font-bold text-[#14213d] tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#755b00]">receipt</span>
                Detalles del Comprobante
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs text-[#4d4635]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#78716c] block">N° Comprobante</span>
                  <span className="font-bold text-[#1b1c19]">{paymentResult.receipt_number || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#78716c] block">ID Transacción</span>
                  <span className="font-bold text-[#1b1c19] text-[10px] break-all">{paymentResult.payment?.transaction_id || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#78716c] block">Monto Cobrado</span>
                  <span className="font-bold text-[#14213d] text-sm">
                    S/ {Number(paymentResult.payment?.amount || 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#78716c] block">Fecha</span>
                  <span className="font-bold text-[#1b1c19]">
                    {new Date().toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-[#d1c5af] flex justify-end gap-4 bg-[#f5f3ee]">
            <button 
              type="button" 
              onClick={() => window.print()}
              className="px-6 py-2 border border-[#14213D] text-[#14213D] font-mono text-xs font-semibold uppercase tracking-widest hover:bg-[#eae8e3] transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              Imprimir
            </button>
            <button 
              type="button" 
              onClick={onClose}
              className="bg-[#755b00] hover:bg-[#c9a227] text-white font-mono text-xs font-semibold px-6 py-2 uppercase tracking-widest transition-colors shadow-sm"
            >
              CERRAR
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14213d]/60 backdrop-blur-sm font-sans p-4 sm:p-6">
      <div className="bg-[#fbf9f4] w-full max-w-2xl max-h-[95vh] shadow-2xl relative flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#d1c5af]">
          <h2 className="font-serif text-2xl font-bold text-[#1b1c19]">
            {booking ? 'Editar Reserva' : 'Nueva Reserva Manual'}
          </h2>
          <button 
            onClick={onClose}
            className="text-[#4d4635] hover:text-[#1b1c19] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {error && (
            <div className="bg-[#ba1a1a]/10 text-[#ba1a1a] p-4 border border-[#ba1a1a]/20 font-mono text-sm">
              {error}
            </div>
          )}
          
          {/* Section 1 */}
          <div className="space-y-4">
            <h3 className="font-serif text-lg font-semibold text-[#1b1c19] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#755b00]">calendar_month</span>
              1. Fechas y Ocupación
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[10px] font-medium text-[#4d4635] uppercase tracking-widest">
                  CHECK-IN
                </label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={checkIn}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-[#d1c5af] focus:border-[#14213D] outline-none py-2 text-[#1b1c19] font-sans appearance-none"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[10px] font-medium text-[#4d4635] uppercase tracking-widest">
                  CHECK-OUT
                </label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={checkOut}
                    min={checkIn || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-[#d1c5af] focus:border-[#14213D] outline-none py-2 text-[#1b1c19] font-sans appearance-none"
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[10px] font-medium text-[#4d4635] uppercase tracking-widest">
                  ADULTOS
                </label>
                <input 
                  type="number" 
                  min="1"
                  value={adults}
                  onChange={(e) => setAdults(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-[#d1c5af] focus:border-[#14213D] outline-none py-2 text-[#1b1c19] font-sans text-center"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[10px] font-medium text-[#4d4635] uppercase tracking-widest">
                  NIÑOS
                </label>
                <input 
                  type="number" 
                  min="0"
                  value={children}
                  onChange={(e) => setChildren(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-[#d1c5af] focus:border-[#14213D] outline-none py-2 text-[#1b1c19] font-sans text-center"
                />
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-4">
            <h3 className="font-serif text-lg font-semibold text-[#1b1c19] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#755b00]">bed</span>
              2. Asignación de Habitación
            </h3>
            
            <div className="flex flex-col gap-2">
              <label className="font-mono text-[10px] font-medium text-[#4d4635] uppercase tracking-widest">
                TIPO DE HABITACIÓN / DISPONIBLE
              </label>
              <div className="relative">
                <select 
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  disabled={availableRooms.length === 0}
                  className="w-full bg-transparent border-b-2 border-[#d1c5af] focus:border-[#14213D] outline-none py-2 pr-8 text-[#1b1c19] font-sans appearance-none cursor-pointer disabled:opacity-50"
                >
                  {availableRooms.length === 0 ? (
                    <option value="">No hay habitaciones disponibles</option>
                  ) : (
                    availableRooms.map(room => (
                      <option key={room.id} value={room.id}>
                        Habitación {room.room_number} - {room.name} (S/ {room.price_per_night})
                      </option>
                    ))
                  )}
                </select>
                <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-[#1b1c19] pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Datos del Huésped (Solo para nuevas reservas) */}
          {!booking && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-serif text-lg font-semibold text-[#1b1c19] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#755b00]">person</span>
                  3. Datos del Huésped Principal
                </h3>
                
                {/* Buscador de Huésped */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar huésped existente por DNI, Nombre o Apellido..."
                    value={searchQuery}
                    onChange={handleSearchGuest}
                    className="w-full bg-[#eae8e3] border border-[#d1c5af] p-3 text-sm focus:outline-none focus:border-[#14213D] mb-2"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-[#fbf9f4] border border-[#d1c5af] max-h-48 overflow-y-auto z-10 shadow-lg">
                      {searchResults.map(guest => (
                        <div
                          key={guest.id}
                          className="p-3 hover:bg-[#eae8e3] cursor-pointer border-b border-[#d1c5af]/50"
                          onClick={() => selectGuest(guest)}
                        >
                          <div className="font-semibold text-[#1b1c19]">{guest.name} {guest.surname}</div>
                          <div className="text-xs text-[#4d4635]">{guest.document_type}: {guest.document_number} | {guest.email}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[10px] font-medium text-[#4d4635] uppercase tracking-widest">Nombre</label>
                    <input type="text" required pattern="^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$" title="Solo letras" value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full bg-transparent border-b-2 border-[#d1c5af] focus:border-[#14213D] outline-none py-2 text-[#1b1c19]" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[10px] font-medium text-[#4d4635] uppercase tracking-widest">Apellidos</label>
                    <input type="text" required pattern="^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$" title="Solo letras" value={guestSurname} onChange={e => setGuestSurname(e.target.value)} className="w-full bg-transparent border-b-2 border-[#d1c5af] focus:border-[#14213D] outline-none py-2 text-[#1b1c19]" />
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[10px] font-medium text-[#4d4635] uppercase tracking-widest">Tipo de Documento</label>
                    <div className="relative">
                      <select value={documentType} onChange={e => setDocumentType(e.target.value)} className="w-full bg-transparent border-b-2 border-[#d1c5af] focus:border-[#14213D] outline-none py-2 pr-8 text-[#1b1c19] appearance-none cursor-pointer">
                        <option value="DNI">DNI</option>
                        <option value="Pasaporte">Pasaporte</option>
                        <option value="Carnet Extranjería">Carnet Extranjería</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-[#1b1c19] pointer-events-none">expand_more</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[10px] font-medium text-[#4d4635] uppercase tracking-widest">Nº Documento</label>
                    <input type="text" required pattern={documentType === 'DNI' ? "^[0-9]{8}$" : ".*"} title={documentType === 'DNI' ? "DNI debe tener 8 dígitos numéricos" : "Número de documento"} value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} className="w-full bg-transparent border-b-2 border-[#d1c5af] focus:border-[#14213D] outline-none py-2 text-[#1b1c19]" />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[10px] font-medium text-[#4d4635] uppercase tracking-widest">Correo Electrónico</label>
                    <input type="email" required value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="w-full bg-transparent border-b-2 border-[#d1c5af] focus:border-[#14213D] outline-none py-2 text-[#1b1c19]" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[10px] font-medium text-[#4d4635] uppercase tracking-widest">Teléfono (Opcional)</label>
                    <input type="tel" pattern="^\+?[0-9\s\-]+$" title="Solo números" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} className="w-full bg-transparent border-b-2 border-[#d1c5af] focus:border-[#14213D] outline-none py-2 text-[#1b1c19]" />
                  </div>
                </div>
              </div>

              {/* Acompañantes */}
              {companions.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-[#d1c5af]/50">
                  <h4 className="font-serif text-md font-semibold text-[#1b1c19]">Acompañantes</h4>
                  {companions.map((companion, idx) => (
                    <div key={idx} className="bg-[#f5f3ee] p-4 relative border border-[#d1c5af]/30">
                      <button 
                        type="button" 
                        onClick={() => removeCompanion(idx)}
                        className="absolute top-2 right-2 text-[#ba1a1a] hover:bg-[#ba1a1a]/10 p-1 rounded-full transition-colors z-20"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>

                      <div className="relative mb-4 mt-2">
                        <input
                          type="text"
                          placeholder="Buscar acompañante existente..."
                          value={companion.searchQuery || ''}
                          onChange={(e) => handleSearchCompanion(idx, e.target.value)}
                          className="w-full bg-[#eae8e3] border border-[#d1c5af] p-2 text-xs focus:outline-none focus:border-[#14213D]"
                        />
                        {companion.searchResults?.length > 0 && (
                          <div className="absolute top-full left-0 right-0 bg-[#fbf9f4] border border-[#d1c5af] max-h-40 overflow-y-auto z-10 shadow-lg">
                            {companion.searchResults.map(guest => (
                              <div
                                key={guest.id}
                                className="p-2 hover:bg-[#eae8e3] cursor-pointer border-b border-[#d1c5af]/50"
                                onClick={() => selectCompanionGuest(idx, guest)}
                              >
                                <div className="font-semibold text-[#1b1c19] text-xs">{guest.name} {guest.surname}</div>
                                <div className="text-[10px] text-[#4d4635]">{guest.document_type}: {guest.document_number}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[9px] font-medium text-[#4d4635] uppercase">Nombre</label>
                          <input type="text" required pattern="^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$" title="Solo letras" value={companion.name} onChange={e => updateCompanion(idx, 'name', e.target.value)} className="w-full bg-transparent border-b border-[#d1c5af] focus:border-[#14213D] outline-none py-1 text-[#1b1c19] text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[9px] font-medium text-[#4d4635] uppercase">Apellidos</label>
                          <input type="text" required pattern="^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$" title="Solo letras" value={companion.surname} onChange={e => updateCompanion(idx, 'surname', e.target.value)} className="w-full bg-transparent border-b border-[#d1c5af] focus:border-[#14213D] outline-none py-1 text-[#1b1c19] text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[9px] font-medium text-[#4d4635] uppercase">Tipo de Doc</label>
                          <select value={companion.document_type} onChange={e => updateCompanion(idx, 'document_type', e.target.value)} className="w-full bg-transparent border-b border-[#d1c5af] focus:border-[#14213D] outline-none py-1 text-[#1b1c19] text-sm cursor-pointer">
                            <option value="DNI">DNI</option>
                            <option value="Pasaporte">Pasaporte</option>
                            <option value="Carnet Extranjería">Carnet Extranjería</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[9px] font-medium text-[#4d4635] uppercase">Nº Documento</label>
                          <input type="text" required pattern={companion.document_type === 'DNI' ? "^[0-9]{8}$" : ".*"} title={companion.document_type === 'DNI' ? "DNI de 8 dígitos numéricos" : ""} value={companion.document_number} onChange={e => updateCompanion(idx, 'document_number', e.target.value)} className="w-full bg-transparent border-b border-[#d1c5af] focus:border-[#14213D] outline-none py-1 text-[#1b1c19] text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[9px] font-medium text-[#4d4635] uppercase">Correo Electrónico (Opcional)</label>
                          <input type="email" value={companion.email || ''} onChange={e => updateCompanion(idx, 'email', e.target.value)} className="w-full bg-transparent border-b border-[#d1c5af] focus:border-[#14213D] outline-none py-1 text-[#1b1c19] text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[9px] font-medium text-[#4d4635] uppercase">Teléfono (Opcional)</label>
                          <input type="tel" pattern="^\+?[0-9\s\-]+$" title="Solo números" value={companion.phone || ''} onChange={e => updateCompanion(idx, 'phone', e.target.value)} className="w-full bg-transparent border-b border-[#d1c5af] focus:border-[#14213D] outline-none py-1 text-[#1b1c19] text-sm" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {companions.length + 1 < getRoomCapacity(roomId) && (
                <button 
                  type="button" 
                  onClick={handleAddCompanion}
                  className="text-[#755b00] font-mono text-xs font-semibold uppercase tracking-widest flex items-center gap-1 hover:text-[#c9a227] transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  Añadir Acompañante
                </button>
              )}
            </div>
          )}

          {/* Cupones (Solo para nuevas reservas) */}
          {!booking && (
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-semibold text-[#1b1c19] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#755b00]">sell</span>
                4. Cupón de Descuento (Opcional)
              </h3>
              
              <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4">
                 {!appliedCoupon ? (
                   <div>
                     <div className="flex gap-2">
                       <input 
                         type="text" 
                         placeholder="Ingresa el código" 
                         value={couponCode}
                         onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                         className="w-full bg-transparent border-b-2 border-[#d1c5af] focus:border-[#14213D] outline-none py-2 text-[#1b1c19] font-sans uppercase"
                       />
                       <button 
                         type="button"
                         onClick={handleApplyCoupon}
                         className="bg-[#14213d] hover:bg-[#0a1128] text-white font-mono text-[10px] font-bold uppercase tracking-widest px-4 py-2 transition-colors"
                       >
                         Aplicar
                       </button>
                     </div>
                     {couponError && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{couponError}</p>}
                   </div>
                 ) : (
                   <div className="flex items-center justify-between bg-[#e5efff] border border-[#0047b3] p-2">
                     <div className="flex items-center gap-2">
                       <span className="material-symbols-outlined text-[#0047b3] text-sm">check_circle</span>
                       <span className="font-mono text-xs font-bold text-[#0047b3]">{appliedCoupon.code} aplicado</span>
                     </div>
                     <button type="button" onClick={handleRemoveCoupon} className="text-[#ba1a1a] hover:text-[#93000a]">
                       <span className="material-symbols-outlined text-sm">delete</span>
                     </button>
                   </div>
                 )}
              </div>
            </div>
          )}

          {/* Pasarela de Pagos */}
          {!booking && (
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-semibold text-[#1b1c19] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#755b00]">credit_card</span>
                5. Pasarela de Pagos
              </h3>
              <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="font-mono text-[9px] font-medium text-[#4d4635] uppercase">Número de Tarjeta</label>
                  <input type="text" value={cardData.cardNumber} onChange={(e) => handleCardChange('cardNumber', e.target.value)} maxLength={19} placeholder="4242 4242 4242 4242" className="w-full bg-transparent border-b border-[#d1c5af] focus:border-[#14213D] outline-none py-1 text-[#1b1c19] text-sm tracking-wider" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] font-medium text-[#4d4635] uppercase">Fecha Exp (MM/YY)</label>
                  <input type="text" value={cardData.cardExpiry} onChange={(e) => handleCardChange('cardExpiry', e.target.value)} maxLength={5} placeholder="MM/YY" className="w-full bg-transparent border-b border-[#d1c5af] focus:border-[#14213D] outline-none py-1 text-[#1b1c19] text-sm tracking-wider" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] font-medium text-[#4d4635] uppercase">CVC</label>
                  <input type="password" value={cardData.cardCvc} onChange={(e) => handleCardChange('cardCvc', e.target.value)} maxLength={4} placeholder="•••" className="w-full bg-transparent border-b border-[#d1c5af] focus:border-[#14213D] outline-none py-1 text-[#1b1c19] text-sm tracking-wider" />
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="font-mono text-[9px] font-medium text-[#4d4635] uppercase">Titular de la Tarjeta</label>
                  <input type="text" value={cardData.cardHolder} onChange={(e) => handleCardChange('cardHolder', e.target.value)} placeholder="NOMBRE DEL TITULAR" className="w-full bg-transparent border-b border-[#d1c5af] focus:border-[#14213D] outline-none py-1 text-[#1b1c19] text-sm uppercase" />
                </div>
              </div>
            </div>
          )}

        </form>

        {/* Footer */}
        <div className="p-6 border-t border-[#d1c5af] flex justify-end gap-4 bg-[#f5f3ee]">
          <button 
            type="button" 
            onClick={onClose}
            className="px-6 py-2 border border-[#14213D] text-[#14213D] font-mono text-xs font-semibold uppercase tracking-widest hover:bg-[#eae8e3] transition-colors"
          >
            CANCELAR
          </button>
          <button 
            type="submit" 
            onClick={handleSubmit}
            disabled={loading}
            className="bg-[#755b00] hover:bg-[#c9a227] disabled:opacity-50 text-white font-mono text-xs font-semibold px-6 py-2 uppercase tracking-widest transition-colors shadow-sm"
          >
            {loading ? 'PROCESANDO...' : (booking ? 'GUARDAR CAMBIOS' : 'CREAR RESERVA')}
          </button>
        </div>
      </div>
    </div>
  );
}
