import { useCallback, useEffect, useId, useState } from 'react';
import StaffLayout from '../../components/StaffLayout';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { listRefunds, approveRefund, rejectRefund } from '../../services/billingService';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import useEscapeKey from '../../hooks/useEscapeKey';
import formatCurrency from '../../utils/formatCurrency';
import { bookingStatusLabel } from '../../utils/bookingStatus';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';

const TABS = [
  { status: 'refund_pending', label: 'Pendientes' },
  { status: 'refunded', label: 'Procesados' },
  { status: 'refund_rejected', label: 'Rechazados' },
];

const METHODS = [
  { value: 'transfer', label: 'Transferencia bancaria' },
  { value: 'card', label: 'Extorno a tarjeta' },
  { value: 'cash', label: 'Efectivo' },
];

const methodLabel = (value) => METHODS.find((m) => m.value === value)?.label || value || '—';

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function defaultMethod(originalMethod) {
  const m = String(originalMethod || '').toLowerCase();
  if (m === 'efectivo' || m === 'cash') return 'cash';
  if (m === 'tarjeta' || m === 'card') return 'card';
  return 'transfer';
}

function ApproveRefundModal({ refund, busy, onCancel, onConfirm }) {
  const titleId = useId();
  const [method, setMethod] = useState(() => defaultMethod(refund?.original_method));
  const [reference, setReference] = useState('');

  useEscapeKey(() => { if (!busy) onCancel(); }, !!refund);

  if (!refund) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#14213d]/60 backdrop-blur-xs p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-[#fbf9f4] border border-[#d1c5af] shadow-[4px_4px_0px_rgba(20,33,61,0.25)] max-w-md w-full">
        <div className="px-6 py-4 border-b border-[#d1c5af] bg-[#f5f3ee]">
          <h2 id={titleId} className="font-serif text-lg font-bold text-[#14213d]">Aprobar reembolso</h2>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); onConfirm({ method, reference: reference.trim() }); }}
          className="px-6 py-5 space-y-4"
        >
          <p className="font-sans text-sm text-[#4d4635]">
            Reserva <strong>{refund.booking?.booking_code}</strong> · {refund.booking?.guest?.name || 'Huésped'} ·{' '}
            <strong>{formatCurrency(refund.amount)}</strong>
          </p>
          <div>
            <label htmlFor="refund-method" className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">Método de devolución *</label>
            <select
              id="refund-method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full bg-white border border-[#d1c5af] p-2 text-sm font-sans focus:border-[#14213d] focus:outline-none"
            >
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="refund-reference" className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">Referencia (opcional)</label>
            <input
              id="refund-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={100}
              placeholder="N° de operación, voucher..."
              className="w-full bg-white border border-[#d1c5af] p-2 text-sm font-sans focus:border-[#14213d] focus:outline-none"
            />
          </div>
          <p className="font-mono text-[10px] text-[#78716c]">Se notificará al huésped por correo electrónico.</p>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="px-5 py-2 border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-xs uppercase font-bold tracking-wider disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 border border-[#c9a227] bg-[#14213d] hover:bg-[#0a1628] text-[#fbf9f4] font-mono text-xs uppercase font-bold tracking-wider disabled:opacity-50"
            >
              {busy ? 'Procesando...' : 'Aprobar reembolso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Gestión de reembolsos (SHE-029). Solo administradores.
 */
export default function RefundManagement() {
  const [tab, setTab] = useState('refund_pending');
  const [refunds, setRefunds] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);

  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listRefunds({ status: tab, search: debouncedSearch, page });
      setRefunds(data?.data || []);
      setMeta({
        current_page: data?.current_page || 1,
        last_page: data?.last_page || 1,
        total: data?.total || 0,
        from: data?.from || 0,
        to: data?.to || 0,
      });
    } catch (err) {
      logError('refunds:list', err);
      setError(apiErrorMessage(err, 'No se pudieron cargar los reembolsos.'));
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedSearch, page]);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  const handleApprove = async ({ method, reference }) => {
    if (!approveTarget) return;
    setBusy(true);
    try {
      await approveRefund(approveTarget.id, { method, reference });
      setToast({ type: 'success', message: `Reembolso de ${formatCurrency(approveTarget.amount)} aprobado.` });
      setApproveTarget(null);
      fetchRefunds();
    } catch (err) {
      logError('refunds:approve', err);
      setToast({ type: 'error', message: apiErrorMessage(err, 'No se pudo aprobar el reembolso.') });
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (reason) => {
    if (!rejectTarget) return;
    setBusy(true);
    try {
      await rejectRefund(rejectTarget.id, reason);
      setToast({ type: 'success', message: 'Reembolso rechazado.' });
      setRejectTarget(null);
      fetchRefunds();
    } catch (err) {
      logError('refunds:reject', err);
      setToast({ type: 'error', message: apiErrorMessage(err, 'No se pudo rechazar el reembolso.') });
    } finally {
      setBusy(false);
    }
  };

  const isPending = tab === 'refund_pending';
  const colCount = 6;

  return (
    <StaffLayout>
      <header className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4">
        <p className="text-[10px] font-mono tracking-widest text-[#78716c] uppercase font-bold mb-1">
          Facturación · Administración
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2d2d2a] tracking-tight">Reembolsos</h1>
        <p className="font-sans text-sm text-[#4d4635] mt-1">
          Reembolsos generados por cancelaciones, modificaciones y no-shows según la política vigente.
        </p>
      </header>

      <main className="px-4 sm:px-8 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
          <div role="tablist" aria-label="Estado del reembolso" className="flex border border-[#d1c5af] bg-white w-full sm:w-auto">
            {TABS.map((t) => (
              <button
                key={t.status}
                type="button"
                role="tab"
                aria-selected={tab === t.status}
                onClick={() => { setTab(t.status); setPage(1); }}
                className={`flex-1 sm:flex-none px-4 py-2 font-mono text-xs uppercase font-bold tracking-wider transition-colors ${tab === t.status ? 'bg-[#14213d] text-[#fbf9f4]' : 'text-[#4d4635] hover:bg-[#eae8e3]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="w-full sm:w-72">
            <label htmlFor="refund-search" className="sr-only">Buscar</label>
            <input
              id="refund-search"
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Código de reserva o huésped"
              className="w-full bg-white border border-[#d1c5af] px-2 py-1.5 text-sm font-sans focus:border-[#14213d] focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <div role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-4 mb-6 text-[#93000a] font-mono text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">error</span>
            <span>{error}</span>
          </div>
        )}

        <section className="bg-white shadow-sm border border-[#e4e2dd]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[#f5f3ee] border-b border-[#d1c5af]">
                <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-[#4d4635]">
                  <th className="px-4 py-3">Solicitado</th>
                  <th className="px-4 py-3">Reserva / Huésped</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3">{isPending ? 'Pago original' : 'Resolución'}</th>
                  <th className="px-4 py-3 text-right">{isPending ? 'Acciones' : 'Procesado'}</th>
                </tr>
              </thead>
              <tbody>
                {loading && refunds.length === 0 && [1, 2, 3].map((i) => (
                  <tr key={`sk-${i}`} className="border-b border-[#e4e2dd]">
                    <td colSpan={colCount} className="px-4 py-3"><div className="h-4 bg-[#eae8e3] animate-pulse" /></td>
                  </tr>
                ))}
                {!loading && refunds.length === 0 && (
                  <tr>
                    <td colSpan={colCount} className="px-4 py-12 text-center font-mono text-xs text-[#78716c]">
                      {isPending ? 'No hay reembolsos pendientes.' : 'No hay reembolsos en esta categoría.'}
                    </td>
                  </tr>
                )}
                {refunds.map((r) => (
                  <tr key={r.id} className={`border-b border-[#e4e2dd] align-top hover:bg-[#fbf9f4] ${loading ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-[#4d4635]">{formatDateTime(r.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-[#14213d]">{r.booking?.booking_code || '—'}</div>
                      <div className="font-semibold text-[#1b1c19] truncate max-w-[220px]">{r.booking?.guest?.name || '—'}</div>
                      <div className="font-mono text-[10px] text-[#78716c] truncate max-w-[220px]">
                        {r.booking?.guest?.email || ''}{r.booking ? ` · ${bookingStatusLabel(r.booking.status)}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#4d4635] max-w-[220px] break-words">{r.reason || '—'}</td>
                    <td className="px-4 py-3 font-mono text-right font-bold text-[#14213d] whitespace-nowrap">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-3 text-xs text-[#4d4635]">
                      {isPending && <span className="font-mono">{r.original_method || '—'}</span>}
                      {r.status === 'refunded' && (
                        <>
                          <div>{methodLabel(r.refund_method)}</div>
                          {r.refund_reference && <div className="font-mono text-[10px] text-[#78716c]">Ref. {r.refund_reference}</div>}
                        </>
                      )}
                      {r.status === 'refund_rejected' && <div className="text-[#93000a] break-words max-w-[200px]">{r.rejection_reason}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {isPending ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setApproveTarget(r)}
                            className="px-2 py-1 border border-[#3F6B4F]/50 hover:bg-[#3F6B4F]/10 text-[#3F6B4F] font-mono text-[10px] uppercase font-bold"
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectTarget(r)}
                            className="px-2 py-1 border border-[#ba1a1a]/40 hover:bg-[#ffdad6] text-[#93000a] font-mono text-[10px] uppercase font-bold"
                          >
                            Rechazar
                          </button>
                        </div>
                      ) : (
                        <div className="font-mono text-xs text-right text-[#4d4635] whitespace-nowrap">{formatDateTime(r.processed_at)}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#d1c5af] bg-[#f5f3ee]">
            <p className="font-mono text-[11px] text-[#4d4635]">
              {meta.total > 0 ? `Mostrando ${meta.from}–${meta.to} de ${meta.total}` : 'Sin registros'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || meta.current_page <= 1}
                className="px-3 py-1.5 border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-xs uppercase font-bold disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="font-mono text-xs text-[#4d4635]">{meta.current_page} / {meta.last_page}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                disabled={loading || meta.current_page >= meta.last_page}
                className="px-3 py-1.5 border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-xs uppercase font-bold disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>
      </main>

      {approveTarget && (
        <ApproveRefundModal
          key={approveTarget.id}
          refund={approveTarget}
          busy={busy}
          onCancel={() => setApproveTarget(null)}
          onConfirm={handleApprove}
        />
      )}

      <ConfirmDialog
        isOpen={!!rejectTarget}
        title="Rechazar reembolso"
        message={rejectTarget ? `Reserva ${rejectTarget.booking?.booking_code} · ${formatCurrency(rejectTarget.amount)}. El monto volverá a quedar disponible para un nuevo reembolso.` : ''}
        confirmLabel="Rechazar"
        variant="danger"
        requireReason
        reasonLabel="Motivo del rechazo"
        busy={busy}
        onCancel={() => setRejectTarget(null)}
        onConfirm={handleReject}
      />

      <Toast message={toast?.message} isOpen={!!toast} type={toast?.type} onClose={() => setToast(null)} />
    </StaffLayout>
  );
}
