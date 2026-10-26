import { useCallback, useEffect, useId, useRef, useState } from 'react';
import StaffLayout from '../../components/StaffLayout';
import Toast from '../../components/Toast';
import { getCashSession, listCashSessions } from '../../services/cashSessionService';
import { getStaff } from '../../services/staffService';
import useEscapeKey from '../../hooks/useEscapeKey';
import { apiErrorMessage } from '../../utils/apiError';
import formatCurrency from '../../utils/formatCurrency';
import { formatDateTime } from '../../utils/dates';
import { downloadCsv } from '../../utils/csv';
import logError from '../../utils/logError';

const EMPTY_FILTERS = { date_from: '', date_to: '', user_id: '', status: '' };
const MAX_EXPORT_PAGES = 50;

const STATUS = {
  open: { label: 'Abierta', classes: 'bg-[#e3f2fd] text-[#0d47a1] border-[#1976d2]/30' },
  closed: { label: 'Cerrada', classes: 'bg-[#e4e2dd] text-[#4d4635] border-[#d1c5af]' },
};

const PAYMENT_METHODS = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  voucher: 'Voucher',
  mock: 'Tarjeta (en línea)',
  transfer: 'Transferencia',
  yape: 'Yape',
  plin: 'Plin',
};

const hasValue = (v) => v !== null && v !== undefined && v !== '';

/** Rojo = faltante, verde = cuadre, ámbar = sobrante. */
function differenceTone(value) {
  if (!hasValue(value)) return { classes: 'text-[#78716c]', label: '' };
  const n = Number(value) || 0;
  if (n < -0.009) return { classes: 'text-[#93000a] bg-[#ffdad6]', label: 'Faltante' };
  if (n > 0.009) return { classes: 'text-[#8a4b00] bg-[#fff3e0]', label: 'Sobrante' };
  return { classes: 'text-[#1b5e20] bg-[#e8f5e9]', label: 'Cuadre' };
}

function Money({ value, signed = false }) {
  if (!hasValue(value)) return <span className="text-[#78716c]">—</span>;
  const n = Number(value) || 0;
  return <>{signed && n > 0.009 ? '+' : ''}{formatCurrency(n)}</>;
}

function DifferenceCell({ value }) {
  const tone = differenceTone(value);
  if (!hasValue(value)) return <span className="text-[#78716c]">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 font-mono font-bold whitespace-nowrap ${tone.classes}`}>
      <Money value={value} signed />
      <span className="sr-only"> ({tone.label})</span>
    </span>
  );
}

function SessionDrawer({ sessionId, summary, onClose }) {
  const titleId = useId();
  const closeRef = useRef(null);
  const [state, setState] = useState({ loading: true, error: '', data: null });

  useEscapeKey(onClose);

  // Foco al abrir y devolución del foco al elemento que abrió el panel.
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => { if (previous && typeof previous.focus === 'function') previous.focus(); };
  }, []);

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: '', data: null });
    getCashSession(sessionId)
      .then((data) => { if (active) setState({ loading: false, error: '', data }); })
      .catch((err) => {
        logError('cash-sessions:detail', err);
        if (active) setState({ loading: false, error: apiErrorMessage(err, 'No se pudo cargar el detalle de la caja.'), data: null });
      });
    return () => { active = false; };
  }, [sessionId]);

  const s = state.data || summary || {};
  const payments = state.data?.payments || [];
  const paymentsTotal = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-xl h-full bg-[#fbf9f4] border-l border-[#d1c5af] shadow-xl flex flex-col"
      >
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#d1c5af] bg-[#14213d] text-[#fbf9f4]">
          <div className="min-w-0">
            <h2 id={titleId} className="font-serif text-xl font-bold">Caja #{sessionId}</h2>
            <p className="font-mono text-xs text-[#d1c5af] truncate">{s.user?.name || 'Empleado'}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar detalle" className="p-1 text-[#d1c5af] hover:text-white cursor-pointer">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {[
              ['Apertura', formatDateTime(s.opened_at)],
              ['Cierre', s.closed_at ? formatDateTime(s.closed_at) : 'Sigue abierta'],
              ['Fondo inicial', <Money key="o" value={s.opening_amount} />],
              ['Esperado', <Money key="e" value={s.expected_amount} />],
              ['Contado', <Money key="c" value={s.counted_amount} />],
              ['Diferencia', <DifferenceCell key="d" value={s.difference} />],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-wider font-bold text-[#4d4635]">{label}</dt>
                <dd className="font-mono text-[#1b1c19] tabular-nums break-words">{value}</dd>
              </div>
            ))}
          </dl>
          {s.notes && (
            <p className="text-sm text-[#4d4635] bg-[#f5f3ee] border border-[#d1c5af] p-3 break-words">
              <span className="font-bold">Notas:</span> {s.notes}
            </p>
          )}

          <section aria-labelledby={`${titleId}-payments`}>
            <h3 id={`${titleId}-payments`} className="font-serif text-lg font-bold text-[#14213d] mb-2">Pagos de la sesión</h3>
            {state.loading && (
              <div className="space-y-2 animate-pulse" aria-hidden="true">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-[#eae8e3]" />)}
              </div>
            )}
            {state.loading && <p className="sr-only" role="status">Cargando pagos…</p>}
            {!state.loading && state.error && (
              <p role="alert" className="bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]/30 p-3 text-xs font-mono">{state.error}</p>
            )}
            {!state.loading && !state.error && payments.length === 0 && (
              <p className="font-mono text-xs text-[#78716c] py-6 text-center border border-dashed border-[#d1c5af]">
                No se registraron pagos en esta caja.
              </p>
            )}
            {!state.loading && !state.error && payments.length > 0 && (
              <div className="overflow-x-auto border border-[#e4e2dd]">
                <table className="w-full min-w-[440px] text-sm">
                  <thead className="bg-[#f5f3ee]">
                    <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-[#4d4635]">
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Reserva</th>
                      <th className="px-3 py-2">Método</th>
                      <th className="px-3 py-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, idx) => (
                      <tr key={p.id ?? idx} className="border-t border-[#e4e2dd]">
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{formatDateTime(p.paid_at || p.created_at)}</td>
                        <td className="px-3 py-2 font-mono text-xs break-all">{p.booking_code || p.booking?.booking_code || '—'}</td>
                        <td className="px-3 py-2 text-xs">{PAYMENT_METHODS[p.payment_method || p.method] || p.payment_method || p.method || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold whitespace-nowrap tabular-nums">{formatCurrency(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#d1c5af] bg-[#f5f3ee]">
                      <td colSpan={3} className="px-3 py-2 font-mono text-[10px] uppercase font-bold text-[#4d4635]">Total ({payments.length})</td>
                      <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">{formatCurrency(paymentsTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

/**
 * Historial de cajas (SHE-015): sesiones de apertura/cierre por empleado, con
 * diferencias, totales, detalle de pagos y exportación CSV.
 */
export default function CashSessionHistory() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], pagination: { current_page: 1, last_page: 1, total: 0, from: 0, to: 0 }, totals: { expected: 0, counted: 0, difference: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setResult(await listCashSessions({ ...filters, page }));
    } catch (err) {
      logError('cash-sessions:list', err);
      setError(apiErrorMessage(err, 'No se pudo cargar el historial de cajas.'));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    let active = true;
    getStaff()
      .then((data) => { if (active) setUsers(Array.isArray(data) ? data : []); })
      .catch((err) => logError('cash-sessions:users', err));
    return () => { active = false; };
  }, []);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = [];
      let current = 1;
      let last = 1;
      do {
        const res = await listCashSessions({ ...filters, page: current });
        rows.push(...res.items);
        last = res.pagination.last_page;
        current += 1;
      } while (current <= last && current <= MAX_EXPORT_PAGES);

      const header = ['ID', 'Empleado', 'Apertura', 'Cierre', 'Estado', 'Fondo inicial', 'Esperado', 'Contado', 'Diferencia', 'Notas'];
      const num = (v) => (hasValue(v) ? Number(v) || 0 : '');
      const body = rows.map((r) => [
        r.id,
        r.user?.name || '',
        formatDateTime(r.opened_at),
        r.closed_at ? formatDateTime(r.closed_at) : '',
        STATUS[r.status]?.label || r.status || '',
        num(r.opening_amount),
        num(r.expected_amount),
        num(r.counted_amount),
        num(r.difference),
        r.notes || '',
      ]);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`historial-cajas-${stamp}.csv`, [header, ...body]);
      setToast({ type: 'success', message: `Exportadas ${rows.length} cajas.` });
    } catch (err) {
      logError('cash-sessions:export', err);
      setToast({ type: 'error', message: 'No se pudo exportar el historial.' });
    } finally {
      setExporting(false);
    }
  };

  const { items, pagination, totals } = result;
  const hasFilters = Object.values(filters).some((v) => v !== '');
  const inputClasses = 'w-full bg-white border border-[#d1c5af] px-2 py-1.5 text-sm font-sans focus:border-[#14213d] focus:outline-none';
  const labelClasses = 'block font-mono text-[10px] uppercase font-bold text-[#4d4635] mb-1';

  return (
    <StaffLayout>
      <header className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2d2d2a] tracking-tight">Historial de cajas</h1>
          <p className="font-sans text-sm text-[#4d4635] mt-1">
            Aperturas y cierres de caja por empleado, con el efectivo esperado y el declarado.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || loading || items.length === 0}
          aria-busy={exporting}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#14213d] hover:bg-[#0a1628] text-[#fbf9f4] border border-[#c9a227] font-mono text-xs uppercase font-bold tracking-wider disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">download</span>
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </header>

      <main className="px-4 sm:px-8 pb-8">
        <section aria-label="Filtros" className="bg-white p-4 mb-6 shadow-sm border border-[#e4e2dd]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="cash-from" className={labelClasses}>Desde</label>
              <input id="cash-from" type="date" value={filters.date_from} max={filters.date_to || undefined} onChange={(e) => updateFilter('date_from', e.target.value)} className={inputClasses} />
            </div>
            <div>
              <label htmlFor="cash-to" className={labelClasses}>Hasta</label>
              <input id="cash-to" type="date" value={filters.date_to} min={filters.date_from || undefined} onChange={(e) => updateFilter('date_to', e.target.value)} className={inputClasses} />
            </div>
            <div>
              <label htmlFor="cash-user" className={labelClasses}>Empleado</label>
              <select id="cash-user" value={filters.user_id} onChange={(e) => updateFilter('user_id', e.target.value)} className={inputClasses}>
                <option value="">Todos</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{[u.name, u.surname].filter(Boolean).join(' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cash-status" className={labelClasses}>Estado</label>
              <select id="cash-status" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)} className={inputClasses}>
                <option value="">Todos</option>
                <option value="open">Abiertas</option>
                <option value="closed">Cerradas</option>
              </select>
            </div>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}
              className="mt-3 font-mono text-[10px] uppercase font-bold tracking-widest text-[#755b00] hover:text-[#14213d] cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </section>

        {error && (
          <div role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-4 mb-6 text-[#93000a] font-mono text-xs flex flex-wrap items-center gap-3">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">error</span>
            <span className="flex-1">{error}</span>
            <button type="button" onClick={fetchList} className="underline font-bold cursor-pointer">Reintentar</button>
          </div>
        )}

        <section className="bg-white shadow-sm border border-[#e4e2dd]" aria-busy={loading}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <caption className="sr-only">Historial de cajas. Seleccione una fila para ver los pagos.</caption>
              <thead className="bg-[#f5f3ee] border-b border-[#d1c5af]">
                <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-[#4d4635]">
                  <th scope="col" className="px-4 py-3">Empleado</th>
                  <th scope="col" className="px-4 py-3">Apertura</th>
                  <th scope="col" className="px-4 py-3">Cierre</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3 text-right">Fondo</th>
                  <th scope="col" className="px-4 py-3 text-right">Esperado</th>
                  <th scope="col" className="px-4 py-3 text-right">Contado</th>
                  <th scope="col" className="px-4 py-3 text-right">Diferencia</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Detalle</span></th>
                </tr>
              </thead>
              <tbody>
                {loading && items.length === 0 && [1, 2, 3, 4].map((i) => (
                  <tr key={`sk-${i}`} className="border-b border-[#e4e2dd]">
                    <td colSpan={9} className="px-4 py-3"><div className="h-4 bg-[#eae8e3] animate-pulse" /></td>
                  </tr>
                ))}
                {!loading && !error && items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center font-mono text-xs text-[#78716c]">
                      {hasFilters ? 'No hay cajas para los filtros seleccionados.' : 'Todavía no se ha abierto ninguna caja.'}
                    </td>
                  </tr>
                )}
                {items.map((row) => {
                  const status = STATUS[row.status] || { label: row.status || '—', classes: 'bg-[#e4e2dd] text-[#4d4635] border-[#d1c5af]' };
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelected(row)}
                      className={`border-b border-[#e4e2dd] hover:bg-[#fbf9f4] cursor-pointer ${loading ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3 font-semibold text-[#1b1c19] max-w-[200px] truncate" title={row.user?.name}>{row.user?.name || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-[#4d4635]">{formatDateTime(row.opened_at)}</td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-[#4d4635]">{row.closed_at ? formatDateTime(row.closed_at) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 border font-mono text-[10px] uppercase font-bold tracking-wider whitespace-nowrap ${status.classes}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono whitespace-nowrap tabular-nums"><Money value={row.opening_amount} /></td>
                      <td className="px-4 py-3 text-right font-mono whitespace-nowrap tabular-nums"><Money value={row.expected_amount} /></td>
                      <td className="px-4 py-3 text-right font-mono whitespace-nowrap tabular-nums"><Money value={row.counted_amount} /></td>
                      <td className="px-4 py-3 text-right tabular-nums"><DifferenceCell value={row.difference} /></td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelected(row); }}
                          aria-label={`Ver detalle de la caja ${row.id} de ${row.user?.name || 'empleado'}`}
                          className="p-1 text-[#4d4635] hover:text-[#14213d] cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">chevron_right</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {items.length > 0 && (
                <tfoot>
                  <tr className="bg-[#f5f3ee] border-t-2 border-[#d1c5af] font-mono">
                    <th scope="row" colSpan={5} className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-[#4d4635]">
                      Totales {pagination.total > 0 ? `(${pagination.total} cajas)` : ''}
                    </th>
                    <td className="px-4 py-3 text-right font-bold whitespace-nowrap tabular-nums">{formatCurrency(totals.expected)}</td>
                    <td className="px-4 py-3 text-right font-bold whitespace-nowrap tabular-nums">{formatCurrency(totals.counted)}</td>
                    <td className="px-4 py-3 text-right tabular-nums"><DifferenceCell value={totals.difference} /></td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#d1c5af] bg-[#f5f3ee]">
            <p className="font-mono text-[11px] text-[#4d4635]">
              {pagination.total > 0 ? `Mostrando ${pagination.from}–${pagination.to} de ${pagination.total} cajas` : 'Sin registros'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || pagination.current_page <= 1}
                className="px-3 py-1.5 border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-xs uppercase font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="font-mono text-xs text-[#4d4635]">{pagination.current_page} / {pagination.last_page}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.last_page, p + 1))}
                disabled={loading || pagination.current_page >= pagination.last_page}
                className="px-3 py-1.5 border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-xs uppercase font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>
      </main>

      {selected && <SessionDrawer sessionId={selected.id} summary={selected} onClose={() => setSelected(null)} />}

      <Toast message={toast?.message} isOpen={!!toast} type={toast?.type} onClose={() => setToast(null)} />
    </StaffLayout>
  );
}
