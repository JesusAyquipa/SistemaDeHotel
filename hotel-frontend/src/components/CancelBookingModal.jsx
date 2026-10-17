import { useState, useEffect, useRef } from 'react';
import { cancelBooking } from '../services/bookingService';
import formatCurrency from '../utils/formatCurrency';
import { apiErrorMessage } from '../utils/apiError';
import useEscapeKey from '../hooks/useEscapeKey';
import useCancellationPolicy from '../hooks/useCancellationPolicy';
import { estimateRefund, policyLines } from '../utils/cancellationPolicy';

export default function CancelBookingModal({ booking, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);
  useEscapeKey(() => { if (!loading && !successData) onClose(); });

  // Reembolso estimado según la política configurada (SHE-028). El servidor es la
  // fuente de verdad: el monto definitivo se informa al confirmar.
  const { policy } = useCancellationPolicy();
  const paidAmount = (() => {
    if (Array.isArray(booking.payments)) {
      return booking.payments.reduce((acc, p) => {
        const amount = Number(p.amount) || 0;
        if (p.status === 'completed' && amount > 0) return acc + amount;
        if (['refund_pending', 'refunded'].includes(p.status)) return acc - Math.abs(amount);
        return acc;
      }, 0);
    }
    return booking.status === 'pending_payment' ? 0 : null;
  })();
  const estimate = estimateRefund(policy, booking, paidAmount);
  const willGetFullRefund = estimate.window === 'free' || estimate.penalty === 0;

  const handleCancel = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await cancelBooking(booking.booking_code);
      setSuccessData(response);
      timerRef.current = setTimeout(() => {
        onSuccess(response);
      }, 3000);
    } catch (err) {
      setError(apiErrorMessage(err, 'Error al cancelar la reserva.'));
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14213d]/80 backdrop-blur-sm">
        <div role="dialog" aria-modal="true" aria-label="Reserva cancelada" className="bg-[#fbf9f4] p-8 max-w-md w-full border border-[#d1c5af] shadow-lg text-center">
          <span className="material-symbols-outlined text-6xl text-[#4caf50] mb-4">check_circle</span>
          <h2 className="font-serif text-2xl font-bold text-[#1b1c19] mb-2">Reserva Cancelada</h2>
          <p className="font-sans text-sm text-[#4d4635] mb-4">
            Tu reserva ha sido cancelada con éxito.
          </p>
          <div className="bg-[#eae8e3] p-4 text-left font-mono text-xs text-[#14213d] mb-6">
            <p><strong>Reembolso Aplicado:</strong> {successData.refund_percentage}%</p>
            <p><strong>Monto a Devolver:</strong> {formatCurrency(successData.refund_amount)}</p>

            {Number(successData.refund_amount) > 0 && (
              <div className="mt-3 pt-3 border-t border-[#d1c5af]">
                {successData.payment_method === 'Efectivo' ? (
                  <p className="text-[#93000a] font-bold">
                    Pago original en efectivo. Por favor, acérquese a la recepción del hotel con su documento de identidad para recibir su reembolso.
                  </p>
                ) : (
                  <p className="text-[#1b5e20] font-bold">
                    El reembolso se está procesando a su tarjeta o método de pago original y puede tardar de 5 a 10 días hábiles.
                  </p>
                )}
              </div>
            )}
          </div>
          <p className="font-mono text-xs text-[#755b00]">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14213d]/80 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="cancel-booking-title" className="bg-[#fbf9f4] max-w-md w-full border border-[#d1c5af] shadow-lg flex flex-col">
        <div className="p-6 border-b border-[#d1c5af] flex justify-between items-center bg-[#eae8e3]">
          <h2 id="cancel-booking-title" className="font-serif text-xl font-bold text-[#ba1a1a]">Cancelar Reserva</h2>
          <button type="button" onClick={onClose} className="text-[#4d4635] hover:text-[#1b1c19]" aria-label="Cerrar">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
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
            <ul className="list-disc pl-4 space-y-1 mb-3">
              {policyLines(policy).map((line) => <li key={line}>{line}</li>)}
            </ul>
            <div className="border-t border-black/10 pt-2 space-y-0.5">
              {estimate.penalty > 0 && (
                <p>Penalidad aplicable: <strong>{formatCurrency(estimate.penalty)}</strong></p>
              )}
              <p>
                Reembolso estimado: <strong>{formatCurrency(estimate.refund)}</strong>
                {estimate.paid > 0 && ` (${estimate.percentage}% de lo pagado)`}
              </p>
              {estimate.paid === 0 && <p>No hay pagos registrados: no se genera reembolso.</p>}
              <p className="opacity-75">Estimación referencial; el monto final lo confirma el hotel.</p>
            </div>
          </div>

          {error && (
            <div role="alert" className="bg-[#ffdad6] text-[#93000a] p-3 text-xs font-mono font-bold mb-4 border border-[#ba1a1a]/30">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-[#eae8e3] text-[#14213d] font-mono text-xs uppercase font-bold hover:bg-[#d1c5af] transition-colors disabled:opacity-50 cursor-pointer"
            >
              Mantener Reserva
            </button>
            <button
              type="button"
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
