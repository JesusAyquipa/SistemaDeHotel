import { useState } from 'react';
import { cancelBooking } from '../services/bookingService';

export default function CancelBookingModal({ booking, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  // Calcula horas faltantes
  const checkInDate = new Date(booking.check_in);
  const now = new Date();
  const hoursUntilCheckIn = (checkInDate - now) / (1000 * 60 * 60);
  const willGetFullRefund = hoursUntilCheckIn >= 48;

  const handleCancel = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await cancelBooking(booking.booking_code);
      setSuccessData(response);
      setTimeout(() => {
        onSuccess(response);
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cancelar la reserva.');
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14213d]/80 backdrop-blur-sm">
        <div className="bg-[#fbf9f4] p-8 max-w-md w-full border border-[#d1c5af] shadow-lg text-center">
          <span className="material-symbols-outlined text-6xl text-[#4caf50] mb-4">check_circle</span>
          <h2 className="font-serif text-2xl font-bold text-[#1b1c19] mb-2">Reserva Cancelada</h2>
          <p className="font-sans text-sm text-[#4d4635] mb-4">
            Tu reserva ha sido cancelada con éxito.
          </p>
          <div className="bg-[#eae8e3] p-4 text-left font-mono text-xs text-[#14213d] mb-6">
            <p><strong>Reembolso Aplicado:</strong> {successData.refund_percentage}%</p>
            <p><strong>Monto a Devolver:</strong> S/ {Number(successData.refund_amount).toFixed(2)}</p>
          </div>
          <p className="font-mono text-xs text-[#755b00]">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14213d]/80 backdrop-blur-sm">
      <div className="bg-[#fbf9f4] max-w-md w-full border border-[#d1c5af] shadow-lg flex flex-col">
        <div className="p-6 border-b border-[#d1c5af] flex justify-between items-center bg-[#eae8e3]">
          <h2 className="font-serif text-xl font-bold text-[#ba1a1a]">Cancelar Reserva</h2>
          <button onClick={onClose} className="text-[#4d4635] hover:text-[#1b1c19]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6">
          <p className="font-sans text-sm text-[#1b1c19] mb-4">
            ¿Estás seguro de que deseas cancelar la reserva <strong>{booking.booking_code}</strong>?
          </p>

          <div className={`p-4 border font-mono text-xs mb-6 ${willGetFullRefund ? 'bg-[#e8f5e9] border-[#4caf50] text-[#1b5e20]' : 'bg-[#fff3e0] border-[#ff9800] text-[#e65100]'}`}>
            <h4 className="font-bold mb-2 uppercase flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">info</span>
              Política de Reembolso
            </h4>
            <p>
              {willGetFullRefund
                ? 'Faltan más de 48 horas para tu Check-in. Tienes derecho a un reembolso del 100%.'
                : 'Faltan menos de 48 horas para tu Check-in. Se aplicará una penalidad y el reembolso será del 50%.'}
            </p>
          </div>

          {error && (
            <div className="bg-[#ffdad6] text-[#93000a] p-3 text-xs font-mono font-bold mb-4 border border-[#ba1a1a]/30">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-[#eae8e3] text-[#14213d] font-mono text-xs uppercase font-bold hover:bg-[#d1c5af] transition-colors disabled:opacity-50 cursor-pointer"
            >
              Mantener Reserva
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-[#ba1a1a] text-white font-mono text-xs uppercase font-bold hover:bg-[#93000a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>Procesando...</>
              ) : (
                <>Sí, Cancelar</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
