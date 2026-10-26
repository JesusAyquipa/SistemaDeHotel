import { useCallback, useEffect, useId, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import CloseRegisterModal from '../reports/CloseRegisterModal';
import Toast from '../Toast';
import { getCurrentCashSession, openCashSession } from '../../services/cashSessionService';
import { apiErrorMessage, apiStatus } from '../../utils/apiError';
import { expectedDeclaredTotal } from '../../utils/cashSession';
import formatCurrency from '../../utils/formatCurrency';
import { formatDateTime, formatTime } from '../../utils/dates';
import logError from '../../utils/logError';
import useEscapeKey from '../../hooks/useEscapeKey';

const STAFF_ROLES = ['admin', 'recepcionista'];

const btn = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-xs uppercase tracking-wider font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

/** Modal para abrir la caja del usuario. También lo usa CashSessionRequiredAlert. */
export function OpenCashModal({ onClose, onOpened }) {
  const uid = useId();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Exclusivo: puede abrirse encima de otro modal (cobro) y Escape solo debe cerrar este.
  useEscapeKey(() => { if (!busy) onClose(); }, true, { exclusive: true });

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Si se abre desde un portal dentro de otro formulario (cobro), el submit de React
    // burbujea por el árbol de componentes: no debe disparar el formulario de fondo.
    e.stopPropagation();
    const value = Number(amount);
    if (amount === '' || !Number.isFinite(value) || value < 0) {
      setError('Ingresa un monto inicial válido (0 o más).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await openCashSession({ opening_amount: Math.round(value * 100) / 100, notes: notes.trim() || undefined });
      onOpened();
    } catch (err) {
      logError('cash-session:open', err);
      const status = apiStatus(err);
      if (status === 409) setError('Ya tienes una caja abierta.');
      else if (status === 422) setError(apiErrorMessage(err, 'Revisa el monto inicial.'));
      else setError(apiErrorMessage(err, 'No se pudo abrir la caja. Intenta nuevamente.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} className="w-full max-w-md bg-[#fbf9f4] border border-[#d1c5af] shadow-md">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3 border-b border-[#d1c5af]">
          <h2 id={`${uid}-title`} className="font-serif text-xl font-bold text-[#14213d]">Abrir caja</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar" className="p-1 text-[#4d4635] hover:text-[#1b1c19] cursor-pointer">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-4">
          <p className="text-sm text-[#4d4635]">
            Cuenta el efectivo con el que inicias el turno. Los cobros que registres desde ahora se sumarán a esta caja.
          </p>
          {error && (
            <p role="alert" className="bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]/30 p-3 text-xs font-mono font-bold">{error}</p>
          )}
          <div>
            <label htmlFor={`${uid}-amount`} className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">Monto inicial (fondo) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[#4d4635]" aria-hidden="true">S/</span>
              <input
                id={`${uid}-amount`}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                required
                autoFocus
                placeholder="0.00"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); if (error) setError(''); }}
                className="w-full bg-white border border-[#d1c5af] focus:border-[#14213d] focus:outline-none py-2.5 pl-9 pr-3 font-mono text-sm text-[#1b1c19]"
              />
            </div>
          </div>
          <div>
            <label htmlFor={`${uid}-notes`} className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">Notas (opcional)</label>
            <textarea
              id={`${uid}-notes`}
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white border border-[#d1c5af] focus:border-[#14213d] focus:outline-none p-2.5 text-sm text-[#1b1c19] resize-none"
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={busy} className={`${btn} border border-[#d1c5af] text-[#14213d] hover:border-[#14213d]`}>
              Cancelar
            </button>
            <button type="submit" disabled={busy} aria-busy={busy} className={`${btn} bg-[#14213d] text-[#fbf9f4] border border-[#c9a227] hover:bg-[#0a1628]`}>
              <span className="material-symbols-outlined text-base" aria-hidden="true">lock_open</span>
              {busy ? 'Abriendo…' : 'Abrir caja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Estado de la caja del usuario (SHE-014): abrir caja con fondo inicial o, si ya está
 * abierta, ver el efectivo esperado y cerrarla con el modal de cierre existente.
 *
 * Props:
 *  - onNotify(message, type): notificación del contenedor (si no, usa su propio Toast).
 *  - onClosed(result): se llama tras un cierre exitoso (p. ej. para recargar reportes).
 */
export default function CashSessionWidget({ onNotify, onClosed, className = '' }) {
  const titleId = useId();
  const { user } = useAuth();
  const roles = user?.roles || [];
  const allowed = roles.some((r) => STAFF_ROLES.includes(r));

  const [state, setState] = useState({ loading: true, error: '', session: null, summary: null });
  const [reloadKey, setReloadKey] = useState(0);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, type = 'success') => {
    if (onNotify) onNotify(message, type);
    else setToast({ message, type });
  }, [onNotify]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!allowed) return undefined;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: '' }));
    getCurrentCashSession({ signal: controller.signal })
      .then(({ session, summary }) => {
        setState({ loading: false, error: '', session, summary });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        logError('cash-session:current', err);
        setState((s) => ({ ...s, loading: false, error: 'No se pudo consultar el estado de tu caja.' }));
      });
    return () => controller.abort();
  }, [allowed, reloadKey]);

  if (!allowed) return null;

  const { loading, error, session, summary } = state;
  const isOpen = !!session && session.status !== 'closed';
  const openingAmount = summary?.opening_amount ?? session?.opening_amount ?? 0;
  const otherPayments = Number(summary?.other_payments) || 0;
  const onlinePayments = Number(summary?.online_payments) || 0;

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={loading}
      className={`bg-white border border-[#d1c5af] shadow-sm ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 md:p-5">
        <div className="flex items-center gap-3 min-w-0 lg:w-56 shrink-0">
          <span
            className={`material-symbols-outlined text-2xl p-2 ${isOpen ? 'bg-[#e8f5e9] text-[#1b5e20]' : 'bg-[#f5f3ee] text-[#755b00]'}`}
            aria-hidden="true"
          >
            {isOpen ? 'point_of_sale' : 'lock'}
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="font-serif text-lg font-bold text-[#14213d]">Mi caja</h2>
            <p className="font-mono text-[11px] text-[#4d4635]" role="status">
              {loading && !session ? 'Consultando…' : isOpen ? 'Abierta' : error ? 'Estado desconocido' : 'Cerrada'}
            </p>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {loading && !session && !error && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-pulse" aria-hidden="true">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-[#eae8e3]" />)}
            </div>
          )}

          {!loading && error && (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-[#93000a]">
              <span>{error}</span>
              <button type="button" onClick={reload} className="underline font-bold cursor-pointer">Reintentar</button>
            </div>
          )}

          {!error && !loading && !isOpen && (
            <p className="text-sm text-[#4d4635]">
              No tienes una caja abierta. Ábrela al iniciar tu turno para registrar el fondo inicial.
            </p>
          )}

          {!error && isOpen && (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-[#4d4635] font-bold">Apertura</dt>
                <dd className="font-mono text-sm text-[#1b1c19]" title={formatDateTime(session.opened_at)}>{formatTime(session.opened_at)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-[#4d4635] font-bold">Fondo inicial</dt>
                <dd className="font-mono text-sm text-[#1b1c19] tabular-nums">{formatCurrency(openingAmount)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-[#4d4635] font-bold">Tarjeta / vouchers</dt>
                <dd className="font-mono text-sm text-[#1b1c19] tabular-nums">{formatCurrency(summary?.card_payments)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-[#4d4635] font-bold">Efectivo esperado</dt>
                <dd className="font-serif text-xl font-bold text-[#755b00] tabular-nums" data-testid="expected-cash">{formatCurrency(summary?.expected_cash ?? openingAmount)}</dd>
              </div>
              {otherPayments > 0 && (
                <div className="min-w-0">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-[#4d4635] font-bold">Otros medios</dt>
                  <dd className="font-mono text-sm text-[#1b1c19] tabular-nums">{formatCurrency(otherPayments)}</dd>
                </div>
              )}
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-[#4d4635] font-bold">Total a declarar</dt>
                <dd className="font-mono text-sm font-bold text-[#14213d] tabular-nums" data-testid="expected-total">{formatCurrency(expectedDeclaredTotal(summary) || openingAmount)}</dd>
              </div>
              {onlinePayments > 0 && (
                <div className="col-span-2 sm:col-span-4 min-w-0 flex flex-wrap items-baseline gap-x-2 border-t border-[#e4e2dd] pt-2" data-testid="online-payments">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-[#4d4635] font-bold">Pagos en línea (no van a caja)</dt>
                  <dd className="font-mono text-sm text-[#4d4635] tabular-nums">{formatCurrency(onlinePayments)}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {isOpen && (
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              aria-label="Actualizar resumen de caja"
              className={`${btn} border border-[#d1c5af] text-[#14213d] hover:border-[#14213d] px-3`}
            >
              <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`} aria-hidden="true">refresh</span>
            </button>
          )}
          {!error && !loading && !isOpen && (
            <button type="button" onClick={() => setOpenModal(true)} className={`${btn} bg-[#14213d] text-[#fbf9f4] border border-[#c9a227] hover:bg-[#0a1628]`}>
              <span className="material-symbols-outlined text-base" aria-hidden="true">lock_open</span>
              Abrir caja
            </button>
          )}
          {!error && isOpen && (
            <button type="button" onClick={() => setCloseModal(true)} className={`${btn} bg-[#c9a227] text-[#14213d] border border-[#a68a4d] hover:brightness-105`}>
              <span className="material-symbols-outlined text-base" aria-hidden="true">account_balance_wallet</span>
              Cerrar caja
            </button>
          )}
        </div>
      </div>

      {openModal && (
        <OpenCashModal
          onClose={() => setOpenModal(false)}
          onOpened={() => {
            setOpenModal(false);
            notify('Caja abierta. ¡Buen turno!');
            reload();
          }}
        />
      )}

      {closeModal && (
        <CloseRegisterModal
          summary={summary}
          expectedAmount={expectedDeclaredTotal(summary)}
          onClose={() => { setCloseModal(false); reload(); }}
          onSuccess={(result) => {
            setCloseModal(false);
            notify('Cierre de caja registrado.');
            reload();
            onClosed?.(result);
          }}
        />
      )}

      {!onNotify && (
        <Toast message={toast?.message} isOpen={!!toast} type={toast?.type} onClose={() => setToast(null)} />
      )}
    </section>
  );
}
