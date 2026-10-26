import { useState, useEffect } from 'react';
import formatCurrency from '../../utils/formatCurrency';
import useEscapeKey from '../../hooks/useEscapeKey';
import { apiErrorMessage } from '../../utils/apiError';
import { isCashSessionRequiredError } from '../../utils/cashSession';
import CashSessionRequiredAlert from './CashSessionRequiredAlert';

/**
 * Registro de un pago en recepción.
 * `onProcessPayment({ amount, method })` debe devolver una promesa: si se rechaza, el error
 * se muestra aquí (incluido el 422 "Debes abrir caja…", con la opción de abrir la caja).
 */
export default function ProcessPaymentModal({ isOpen, onClose, onProcessPayment, totalAmount }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Efectivo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cashRequired, setCashRequired] = useState(false);
  const [notice, setNotice] = useState('');

  useEscapeKey(() => { if (!busy) onClose(); }, isOpen);

  useEffect(() => {
    if (isOpen) {
      setAmount(totalAmount > 0 ? totalAmount.toFixed(2) : '');
      setMethod('Efectivo');
      setError('');
      setCashRequired(false);
      setNotice('');
    }
  }, [isOpen, totalAmount]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy || !amount || parseFloat(amount) <= 0) return;

    setBusy(true);
    setError('');
    setCashRequired(false);
    setNotice('');
    try {
      await onProcessPayment({
        amount: parseFloat(amount),
        method: method
      });
    } catch (err) {
      if (isCashSessionRequiredError(err)) setCashRequired(true);
      else setError(apiErrorMessage(err, 'No se pudo registrar el pago. Intente nuevamente.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1c19]/50 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="process-payment-title" className="bg-[#e5e4de] w-full max-w-md shadow-2xl overflow-hidden border border-[#d1c5af] m-4">

        {/* Header */}
        <div className="bg-[#1b1c19] px-6 py-4 flex justify-between items-center">
          <h2 id="process-payment-title" className="font-serif text-xl font-bold text-white tracking-widest uppercase">
            Procesar Pago
          </h2>
          <button type="button" onClick={onClose} disabled={busy} className="text-[#a39f96] hover:text-white transition-colors" aria-label="Cerrar">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="bg-[#f5e0d8] border border-[#d32f2f] text-[#d32f2f] p-4 mb-6 font-mono text-xs flex justify-between items-center">
            <span className="font-bold tracking-widest uppercase">Monto a Pagar:</span>
            <span className="text-lg font-bold">{formatCurrency(totalAmount)}</span>
          </div>

          {cashRequired && (
            <CashSessionRequiredAlert
              className="mb-5"
              onOpened={() => {
                setCashRequired(false);
                setNotice('Caja abierta. Ya puedes confirmar el pago.');
              }}
            />
          )}
          {error && (
            <p role="alert" className="mb-5 bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]/30 p-3 font-mono text-xs font-bold">{error}</p>
          )}
          {notice && (
            <p role="status" className="mb-5 bg-[#e8f5e9] text-[#1b5e20] border border-[#4caf50]/50 p-3 font-mono text-xs font-bold">{notice}</p>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="pay-method" className="block font-mono text-xs font-bold text-[#a39f96] tracking-widest uppercase mb-2">
                Método de Pago
              </label>
              <select
                id="pay-method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full bg-white border border-[#d1c5af] text-[#2d2d2a] font-mono text-sm px-4 py-3 focus:outline-none focus:border-[#987d35] focus:ring-1 focus:ring-[#987d35] transition-all"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta de Crédito/Débito</option>
                <option value="Transferencia">Transferencia Bancaria</option>
              </select>
            </div>

            <div>
              <label htmlFor="pay-amount" className="block font-mono text-xs font-bold text-[#a39f96] tracking-widest uppercase mb-2">
                Monto Recibido
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[#a39f96]" aria-hidden="true">S/</span>
                <input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={totalAmount > 0 ? totalAmount.toFixed(2) : undefined}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white border border-[#d1c5af] text-[#2d2d2a] font-mono text-sm pl-10 pr-4 py-3 focus:outline-none focus:border-[#987d35] focus:ring-1 focus:ring-[#987d35] transition-all"
                  required
                />
              </div>
              <p className="mt-1 font-mono text-[10px] text-[#78716c]">
                El monto no puede exceder el total de la cuenta.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 disabled:opacity-50 bg-white hover:bg-gray-50 border border-[#d1c5af] text-[#2d2d2a] font-mono text-xs font-bold uppercase tracking-widest py-3 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed bg-[#d32f2f] hover:bg-[#b71c1c] text-white font-mono text-xs font-bold uppercase tracking-widest py-3 transition-colors"
            >
              {busy ? 'Procesando…' : 'Confirmar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
