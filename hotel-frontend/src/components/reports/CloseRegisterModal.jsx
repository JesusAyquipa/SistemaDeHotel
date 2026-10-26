import { useState } from 'react';
import { closeRegister } from '../../services/reportService';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';
import formatCurrency from '../../utils/formatCurrency';
import useEscapeKey from '../../hooks/useEscapeKey';

/**
 * Declaración de cierre de caja.
 * - expectedAmount: total esperado (efectivo + vouchers) para mostrar la diferencia.
 * - summary (opcional, SHE-014): resumen de la sesión de caja abierta
 *   { opening_amount, cash_payments, card_payments, other_payments, expected_cash, online_payments? }.
 *   El total esperado incluye efectivo + tarjeta + otros medios; los pagos en línea
 *   (online_payments) se muestran solo como referencia: no van a caja.
 */
export default function CloseRegisterModal({ onClose, onSuccess, expectedAmount = 0, summary = null }) {
  const [cashAmount, setCashAmount] = useState('');
  const [voucherAmount, setVoucherAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEscapeKey(() => { if (!loading) onClose(); });

  // Calculate difference
  const numCash = Number(cashAmount) || 0;
  const numVoucher = Number(voucherAmount) || 0;
  const totalEntered = numCash + numVoucher;
  const difference = totalEntered - expectedAmount;

  const isDifferenceZero = Math.abs(difference) < 0.01;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // El monto esperado y la diferencia los calcula el servidor
      const result = await closeRegister({
        cash_amount: numCash,
        voucher_amount: numVoucher,
        counted_amount: totalEntered,
      });
      onSuccess(result);
    } catch (err) {
      logError('reports:close-register', err);
      setError(apiErrorMessage(err, 'Error al procesar el cierre de caja.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="close-register-title" className="max-w-2xl w-full bg-[#fbf9f4] rounded-xl shadow-md p-6 relative overflow-y-auto max-h-[95vh]">
        {/* Decoración */}
        <div className="absolute -top-6 -left-6 w-24 h-24 bg-[#c9a227]/20 rounded-full blur-2xl z-0 pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6 border-b border-[#d1c5af] pb-2">
            <h1 id="close-register-title" className="font-serif font-bold text-2xl text-[#1b1c19]">
              Declaración de Caja
              <span className="block font-mono text-[10px] text-[#755b00] tracking-widest mt-1 uppercase font-bold">
                Cierre de Turno
              </span>
            </h1>
            <button type="button" onClick={onClose} className="text-[#4d4635] hover:text-[#1b1c19]" aria-label="Cerrar">
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="bg-[#ffdad6] text-[#93000a] p-3 text-xs font-mono font-bold mb-4 border border-[#ba1a1a]/30">
                {error}
              </div>
            )}

            <div className="bg-[#f5f3ee] rounded-lg p-6 mb-6 flex flex-col gap-2 shadow-sm border border-[#d1c5af]">
              <h2 className="font-serif font-bold text-[#4d4635] uppercase tracking-wider text-xs mb-2">Resumen del Turno</h2>
              {(summary
                ? [
                    ['Fondo Inicial', summary.opening_amount],
                    ['Cobros en Efectivo', summary.cash_payments],
                    ['Cobros con Tarjeta / Vouchers', summary.card_payments],
                    ...(Number(summary.other_payments) > 0 ? [['Otros Medios (transferencia, etc.)', summary.other_payments]] : []),
                  ]
                : [
                    ['Fondo Inicial', 0],
                    ['Ingresos en Sistema', expectedAmount],
                  ]
              ).map(([label, amount]) => (
                <div key={label} className="flex justify-between items-center gap-4 pb-2 border-b border-[#d1c5af]/50">
                  <span className="font-mono text-xs text-[#1b1c19]">{label}</span>
                  <span className="font-mono text-sm text-[#1b1c19] font-bold whitespace-nowrap">{formatCurrency(amount)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2">
                <span className="font-mono text-sm text-[#1b1c19] font-bold">Total Esperado</span>
                <span className="font-mono text-[#755b00] font-bold text-lg">{formatCurrency(expectedAmount)}</span>
              </div>
              {Number(summary?.online_payments) > 0 && (
                <div className="flex justify-between items-center gap-4 pt-2 border-t border-dashed border-[#d1c5af]">
                  <span className="font-mono text-xs text-[#4d4635]">Pagos en línea (no van a caja)</span>
                  <span className="font-mono text-sm text-[#4d4635] whitespace-nowrap">{formatCurrency(summary.online_payments)}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6 mb-8">
              <div className="relative">
                <label className="block font-mono text-[11px] text-[#4d4635] uppercase font-bold mb-1" htmlFor="efectivo">
                  Efectivo en Gaveta
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[#4d4635]">S/</span>
                  <input
                    id="efectivo"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    required
                    className="w-full bg-[#fbf9f4] border-b-2 border-[#d1c5af] focus:border-[#755b00] outline-none py-3 pl-8 pr-4 font-mono text-sm text-[#1b1c19] transition-colors shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]"
                  />
                </div>
              </div>

              <div className="relative">
                <label className="block font-mono text-[11px] text-[#4d4635] uppercase font-bold mb-1" htmlFor="vouchers">
                  Total en Vouchers (Visa/MC) y otros medios
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[#4d4635]">S/</span>
                  <input
                    id="vouchers"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={voucherAmount}
                    onChange={(e) => setVoucherAmount(e.target.value)}
                    required
                    className="w-full bg-[#fbf9f4] border-b-2 border-[#d1c5af] focus:border-[#755b00] outline-none py-3 pl-8 pr-4 font-mono text-sm text-[#1b1c19] transition-colors shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]"
                  />
                </div>
              </div>

              <div className={`mt-4 p-4 rounded border relative overflow-hidden transition-colors ${isDifferenceZero ? 'bg-[#e8f5e9] border-[#81c784]' : 'bg-[#e4e2dd]/30 border-[#d1c5af]/50'}`}>
                <div className="relative flex justify-between items-center z-10">
                  <span className="font-mono text-xs font-bold text-[#4d4635] uppercase tracking-wider">
                    Diferencia {difference > 0.01 ? '(Sobrante)' : difference < -0.01 ? '(Faltante)' : '(Cuadre Perfecto)'}
                  </span>
                  <span className={`font-mono font-bold text-lg ${difference > 0.01 ? 'text-[#e65100]' : difference < -0.01 ? 'text-[#ba1a1a]' : 'text-[#2e7d32]'}`}>
                    {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#c9a227] text-[#14213d] font-mono text-sm font-bold py-4 px-6 uppercase tracking-wider shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] active:translate-y-[1px] transition-all hover:bg-[#c9a227]/90 rounded-sm flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Procesando...' : 'Confirmar Cierre de Caja'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
