import { useState } from 'react';
import { updateBooking } from '../services/bookingService';

export default function ModifyBookingModal({ booking, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkIn, setCheckIn] = useState(booking.check_in.substring(0, 10));
  const [checkOut, setCheckOut] = useState(booking.check_out.substring(0, 10));

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await updateBooking(booking.booking_code, {
        check_in: checkIn,
        check_out: checkOut,
        room_id: booking.room_id,
      });
      onSuccess(response);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al modificar la reserva.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14213d]/80 backdrop-blur-sm">
      <div className="bg-[#fbf9f4] max-w-lg w-full border border-[#d1c5af] shadow-lg flex flex-col">
        <div className="p-6 border-b border-[#d1c5af] flex justify-between items-center bg-[#eae8e3]">
          <h2 className="font-serif text-xl font-bold text-[#1b1c19]">Modificar Fechas de Reserva</h2>
          <button onClick={onClose} className="text-[#4d4635] hover:text-[#1b1c19]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleUpdate} className="p-6 flex flex-col gap-4">
          <div className="bg-[#eae8e3] p-4 font-mono text-xs text-[#4d4635] mb-2 border border-[#d1c5af]">
            <p><strong>Reserva:</strong> {booking.booking_code}</p>
            <p><strong>Habitación:</strong> {booking.room?.name || `Habitación ID: ${booking.room_id}`}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-[#4d4635] font-bold mb-2">
                Nuevo Check-in
              </label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full bg-[#f5f3ee] border border-[#d1c5af] p-3 font-sans text-sm text-[#1b1c19] focus:outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227] transition-all"
              />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-[#4d4635] font-bold mb-2">
                Nuevo Check-out
              </label>
              <input
                type="date"
                required
                min={checkIn || new Date().toISOString().split('T')[0]}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full bg-[#f5f3ee] border border-[#d1c5af] p-3 font-sans text-sm text-[#1b1c19] focus:outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227] transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="bg-[#ffdad6] text-[#93000a] p-3 text-xs font-mono font-bold border border-[#ba1a1a]/30 mt-2">
              {error}
            </div>
          )}

          <div className="flex gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#eae8e3] text-[#14213d] font-mono text-xs uppercase font-bold hover:bg-[#d1c5af] transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#c9a227] text-[#14213d] font-mono text-xs uppercase font-bold hover:brightness-105 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer border border-[#a68a4d]"
            >
              {loading ? 'Verificando y Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
