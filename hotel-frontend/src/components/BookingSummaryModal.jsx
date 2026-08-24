import { useState, useMemo } from 'react';
import { createBooking } from '../services/bookingService';

// Imágenes por defecto si no vienen en la habitación
const DEFAULT_IMAGES = {
  individual: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
  doble: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80',
  king: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
  default: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80',
};

export default function BookingSummaryModal({
  room,
  initialDates = {},
  onClose,
  onBookingSuccess,
}) {
  // Configuración de fechas por defecto
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const [dates, setDates] = useState({
    check_in: initialDates.check_in || todayStr,
    check_out: initialDates.check_out || tomorrowStr,
  });

  const [guestData, setGuestData] = useState({
    guest_name: '',
    guest_surname: '',
    document_type: 'DNI',
    document_number: '',
    guest_email: '',
    guest_phone: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Cálculo de noches y monto total
  const { nights, totalAmount } = useMemo(() => {
    if (!dates.check_in || !dates.check_out) {
      return { nights: 1, totalAmount: Number(room.price_per_night) };
    }
    const start = new Date(dates.check_in);
    const end = new Date(dates.check_out);
    const diffTime = end.getTime() - start.getTime();
    const calculatedNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const validNights = calculatedNights > 0 ? calculatedNights : 1;
    return {
      nights: validNights,
      totalAmount: validNights * Number(room.price_per_night),
    };
  }, [dates.check_in, dates.check_out, room.price_per_night]);

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDates((prev) => ({ ...prev, [name]: value }));
  };

  const handleGuestChange = (e) => {
    const { name, value } = e.target;
    setGuestData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!dates.check_in) errors.check_in = 'Fecha de check-in requerida';
    if (!dates.check_out) errors.check_out = 'Fecha de check-out requerida';
    if (dates.check_in >= dates.check_out) {
      errors.check_out = 'El check-out debe ser posterior al check-in';
    }

    if (!guestData.guest_name.trim()) errors.guest_name = 'El nombre es obligatorio';
    if (!guestData.guest_surname.trim()) errors.guest_surname = 'Los apellidos son obligatorios';
    if (!guestData.guest_email.trim()) {
      errors.guest_email = 'El correo electrónico es obligatorio';
    } else if (!/\S+@\S+\.\S+/.test(guestData.guest_email)) {
      errors.guest_email = 'Ingrese un correo electrónico válido';
    }
    if (!guestData.document_number.trim()) {
      errors.document_number = 'El número de documento es obligatorio';
    } else if (guestData.document_type === 'DNI' && !/^\d{8}$/.test(guestData.document_number.trim())) {
      errors.document_number = 'El DNI debe tener 8 dígitos numéricos';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const payload = {
        room_id: room.id,
        check_in: dates.check_in,
        check_out: dates.check_out,
        guest_name: guestData.guest_name.trim(),
        guest_surname: guestData.guest_surname.trim(),
        guest_email: guestData.guest_email.trim(),
        document_type: guestData.document_type,
        document_number: guestData.document_number.trim(),
        guest_phone: guestData.guest_phone.trim() || undefined,
        notes: guestData.notes.trim() || undefined,
      };

      const result = await createBooking(payload);
      onBookingSuccess(result);
    } catch (err) {
      console.error('Error al crear la reserva:', err);
      const apiMsg = err.response?.data?.message || 'No se pudo procesar la reserva. Verifique los datos e intente nuevamente.';
      const apiValidationErrors = err.response?.data?.errors || {};
      setErrorMessage(apiMsg);
      setFieldErrors(apiValidationErrors);
    } finally {
      setLoading(false);
    }
  };

  const roomImage = room.image_url || DEFAULT_IMAGES[room.bed_type] || DEFAULT_IMAGES.default;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#14213d]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-[#fbf9f4] border border-[#d1c5af] shadow-[4px_4px_0px_rgba(20,33,61,0.25)] max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-[#14213d] text-[#fbf9f4] px-6 py-4 flex items-center justify-between border-b border-[#c9a227]">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#c9a227] text-2xl">
              receipt_long
            </span>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold tracking-wide">
                Resumen de la Reserva
              </h2>
              <p className="font-mono text-[11px] text-[#d1c5af] uppercase">
                Revisa los detalles antes de confirmar tu estadía
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#d1c5af] hover:text-white transition-colors cursor-pointer p-1"
            title="Cerrar ventana"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="overflow-y-auto p-6 flex-grow space-y-6">

          {/* Mensaje de Error General */}
          {errorMessage && (
            <div className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-4 text-[#93000a] font-mono text-xs flex items-start gap-3">
              <span className="material-symbols-outlined text-lg mt-0.5">error</span>
              <div>
                <p className="font-bold">{errorMessage}</p>
                {Object.keys(fieldErrors).length > 0 && (
                  <ul className="list-disc list-inside mt-1">
                    {Object.values(fieldErrors).flat().map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Columna Izquierda: Tarjeta de la Habitación & Desglose Financiero (5 columnas) */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* Tarjeta Visual de la Habitación */}
              <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4">
                <div className="relative h-36 w-full bg-cover bg-center border border-[#d1c5af] mb-3 overflow-hidden"
                     style={{ backgroundImage: `url('${roomImage}')` }}>
                  <div className="absolute top-2 left-2 bg-[#c9a227] text-[#14213d] px-2.5 py-0.5 font-mono text-[10px] font-bold border border-[#14213d]">
                    HAB {room.room_number}
                  </div>
                  <div className="absolute top-2 right-2 bg-[#fbf9f4]/90 text-[#4d4635] px-2 py-0.5 font-mono text-[10px] uppercase border border-[#d1c5af]">
                    {room.bed_type}
                  </div>
                </div>

                <h3 className="font-serif font-bold text-lg text-[#1b1c19] mb-1">
                  {room.name}
                </h3>
                <p className="font-sans text-xs text-[#4d4635] mb-3 line-clamp-2 leading-relaxed">
                  {room.description || 'Habitación equipada con comodidades de lujo y servicio personalizado.'}
                </p>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#4d4635] border-t border-[#d1c5af] pt-2">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-[#755b00]">person</span>
                    <span>{room.capacity} Huésped(es)</span>
                  </div>
                  {room.size_m2 && (
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-[#755b00]">square_foot</span>
                      <span>{room.size_m2} m²</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Resumen Financiero */}
              <div className="bg-[#f5f3ee] border border-[#c9a227]/60 p-4">
                <h4 className="font-mono text-xs uppercase font-bold text-[#755b00] tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">payments</span>
                  Desglose de Costos
                </h4>

                <div className="space-y-2 text-xs font-mono text-[#4d4635]">
                  <div className="flex justify-between">
                    <span>Tarifa por noche:</span>
                    <span className="font-bold text-[#1b1c19]">S/ {Number(room.price_per_night).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duración de estadía:</span>
                    <span className="font-bold text-[#1b1c19]">{nights} {nights === 1 ? 'noche' : 'noches'}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#78716c]">
                    <span>Impuestos y tasas (IGV):</span>
                    <span>Incluidos</span>
                  </div>

                  <div className="border-t border-[#d1c5af] pt-2 mt-2 flex justify-between items-baseline">
                    <span className="font-serif font-bold text-sm text-[#14213d]">Total a Pagar:</span>
                    <span className="font-mono font-bold text-lg text-[#14213d] bg-[#c9a227]/20 px-2 py-0.5 border border-[#c9a227]">
                      S/ {totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Columna Derecha: Formulario de Fechas y Datos del Huésped (7 columnas) */}
            <div className="lg:col-span-7 space-y-4">

              {/* Selección de Fechas */}
              <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4">
                <h4 className="font-mono text-xs uppercase font-bold text-[#14213d] tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#755b00]">calendar_month</span>
                  1. Fechas de Estadía
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                      Check-In (Llegada) *
                    </label>
                    <input
                      type="date"
                      name="check_in"
                      min={todayStr}
                      value={dates.check_in}
                      onChange={handleDateChange}
                      required
                      className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none"
                    />
                    {fieldErrors.check_in && (
                      <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.check_in}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                      Check-Out (Salida) *
                    </label>
                    <input
                      type="date"
                      name="check_out"
                      min={dates.check_in || todayStr}
                      value={dates.check_out}
                      onChange={handleDateChange}
                      required
                      className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none"
                    />
                    {fieldErrors.check_out && (
                      <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.check_out}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Datos del Huésped */}
              <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4">
                <h4 className="font-mono text-xs uppercase font-bold text-[#14213d] tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#755b00]">person_add</span>
                  2. Datos del Huésped Titular
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                      Nombres *
                    </label>
                    <input
                      type="text"
                      name="guest_name"
                      placeholder="Ej. Juan Carlos"
                      value={guestData.guest_name}
                      onChange={handleGuestChange}
                      required
                      className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-sans text-[#1b1c19] focus:border-[#14213d] focus:outline-none"
                    />
                    {fieldErrors.guest_name && (
                      <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.guest_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                      Apellidos *
                    </label>
                    <input
                      type="text"
                      name="guest_surname"
                      placeholder="Ej. Pérez Rossi"
                      value={guestData.guest_surname}
                      onChange={handleGuestChange}
                      required
                      className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-sans text-[#1b1c19] focus:border-[#14213d] focus:outline-none"
                    />
                    {fieldErrors.guest_surname && (
                      <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.guest_surname}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                      Tipo de Documento *
                    </label>
                    <select
                      name="document_type"
                      value={guestData.document_type}
                      onChange={handleGuestChange}
                      className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none cursor-pointer"
                    >
                      <option value="DNI">DNI (8 dígitos)</option>
                      <option value="Pasaporte">Pasaporte</option>
                      <option value="Carnet Extranjería">Carnet de Extranjería</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                      N° de Documento *
                    </label>
                    <input
                      type="text"
                      name="document_number"
                      placeholder={guestData.document_type === 'DNI' ? '8 dígitos' : 'N° Documento'}
                      value={guestData.document_number}
                      onChange={handleGuestChange}
                      required
                      className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none"
                    />
                    {fieldErrors.document_number && (
                      <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.document_number}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                      Correo Electrónico *
                    </label>
                    <input
                      type="email"
                      name="guest_email"
                      placeholder="nombre@ejemplo.com"
                      value={guestData.guest_email}
                      onChange={handleGuestChange}
                      required
                      className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-sans text-[#1b1c19] focus:border-[#14213d] focus:outline-none"
                    />
                    {fieldErrors.guest_email && (
                      <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.guest_email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                      Teléfono / WhatsApp
                    </label>
                    <input
                      type="tel"
                      name="guest_phone"
                      placeholder="+51 987 654 321"
                      value={guestData.guest_phone}
                      onChange={handleGuestChange}
                      className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                      Peticiones Especiales (Opcional)
                    </label>
                    <textarea
                      name="notes"
                      rows="2"
                      placeholder="Horario estimado de llegada, preferencias de piso, etc."
                      value={guestData.notes}
                      onChange={handleGuestChange}
                      className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-sans text-[#1b1c19] focus:border-[#14213d] focus:outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Modal Footer / Botones de Acción */}
        <div className="bg-[#f5f3ee] border-t border-[#d1c5af] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 bg-transparent border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-xs uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3 bg-[#c9a227] hover:bg-[#b08b1a] text-[#14213d] font-mono text-xs uppercase tracking-widest font-bold border border-[#14213d] shadow-[2px_2px_0px_#14213d] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                <span>Procesando Reserva...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">verified</span>
                <span>Confirmar Reserva</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
