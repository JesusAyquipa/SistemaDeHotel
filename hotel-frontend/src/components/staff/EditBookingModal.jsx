import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function EditBookingModal({ isOpen, onClose, onSuccess, booking }) {
  const [checkIn, setCheckIn] = useState(booking?.checkIn || '');
  const [checkOut, setCheckOut] = useState(booking?.checkOut || '');
  
  // En el diseño actual el roomType es un string, pero el backend pide room_id.
  // Como estamos creando una reserva manual general, usaremos un select temporal
  // En un sistema completo esto cargaría las habitaciones disponibles de la base de datos.
  const [roomId, setRoomId] = useState('1'); // ID de ejemplo
  const [roomType, setRoomType] = useState('Standard');

  // Datos del huésped
  const [guestName, setGuestName] = useState('');
  const [guestSurname, setGuestSurname] = useState('');
  const [documentType, setDocumentType] = useState('DNI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  // Acompañantes
  const [companions, setCompanions] = useState([]);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Helper para simular capacidades de habitaciones
  const getRoomCapacity = (id) => {
    if (id === '1') return 2; // Standard
    if (id === '2') return 3; // Deluxe
    if (id === '3') return 4; // Suite
    return 2;
  };

  const handleAddCompanion = () => {
    const capacity = getRoomCapacity(roomId);
    if (companions.length + 1 >= capacity) {
      alert(`No puedes añadir más acompañantes. La capacidad máxima de esta habitación es ${capacity} persona(s).`);
      return;
    }
    setCompanions([...companions, { name: '', surname: '', document_type: 'DNI', document_number: '' }]);
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

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (booking) {
      alert('Simulación: Edición de reserva no implementada en este demo');
      onClose();
      return;
    }

    setLoading(true);
    try {
      // POST a la API real
      await api.post('/bookings', {
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
        notes: "Reserva creada manualmente desde recepción"
      });

      alert('¡Reserva creada exitosamente y correo de confirmación enviado!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error al crear la reserva');
    } finally {
      setLoading(false);
    }
  };

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
                  defaultValue="2"
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
                  defaultValue="0"
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
                  className="w-full bg-transparent border-b-2 border-[#d1c5af] focus:border-[#14213D] outline-none py-2 pr-8 text-[#1b1c19] font-sans appearance-none cursor-pointer"
                >
                  <option value="1">Habitación 101 - Standard</option>
                  <option value="2">Habitación 205 - Deluxe</option>
                  <option value="3">Habitación 301 - Suite</option>
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
                        className="absolute top-2 right-2 text-[#ba1a1a] hover:bg-[#ba1a1a]/10 p-1 rounded-full transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
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
