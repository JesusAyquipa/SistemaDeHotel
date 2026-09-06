import { useState } from 'react';

export default function EditBookingModal({ isOpen, onClose, booking }) {
  const [checkIn, setCheckIn] = useState(booking?.checkIn || '');
  const [checkOut, setCheckOut] = useState(booking?.checkOut || '');
  const [roomType, setRoomType] = useState('Standard'); // Simplified for this UI

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate API call
    console.log('Update booking:', { checkIn, checkOut, roomType });
    alert('Simulación: Reserva actualizada');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14213d]/60 backdrop-blur-sm font-sans">
      <div className="bg-[#fbf9f4] w-full max-w-2xl shadow-2xl relative flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#d1c5af]">
          <h2 className="font-serif text-2xl font-bold text-[#1b1c19]">Editar Reserva</h2>
          <button 
            onClick={onClose}
            className="text-[#4d4635] hover:text-[#1b1c19] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          
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
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-[#d1c5af] focus:border-[#14213D] outline-none py-2 pr-8 text-[#1b1c19] font-sans appearance-none cursor-pointer"
                >
                  <option value="Standard">Standard (Varias disponibles)</option>
                  <option value="Deluxe">Deluxe (Varias disponibles)</option>
                  <option value="Suite">Suite (1 disponible)</option>
                </select>
                <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-[#1b1c19] pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>
          </div>

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
            className="bg-[#755b00] hover:bg-[#c9a227] text-white font-mono text-xs font-semibold px-6 py-2 uppercase tracking-widest transition-colors shadow-sm"
          >
            GUARDAR CAMBIOS
          </button>
        </div>
      </div>
    </div>
  );
}
