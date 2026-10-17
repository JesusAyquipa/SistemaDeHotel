import { Fragment, useCallback, useEffect, useState } from 'react';
import StaffLayout from '../../components/StaffLayout';
import Toast from '../../components/Toast';
import { getActivityLogs, exportActivityLogs } from '../../services/activityLogService';
import { getStaff } from '../../services/staffService';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';

const ACTIONS = {
  created: { label: 'Creación', classes: 'bg-[#3F6B4F]/10 text-[#3F6B4F] border-[#3F6B4F]/30' },
  updated: { label: 'Modificación', classes: 'bg-[#14213d]/10 text-[#14213d] border-[#14213d]/30' },
  deleted: { label: 'Eliminación', classes: 'bg-[#ba1a1a]/10 text-[#93000a] border-[#ba1a1a]/30' },
  login: { label: 'Inicio de sesión', classes: 'bg-[#c9a227]/15 text-[#755b00] border-[#c9a227]/40' },
  logout: { label: 'Cierre de sesión', classes: 'bg-[#e4e2dd] text-[#4d4635] border-[#d1c5af]' },
  login_failed: { label: 'Login fallido', classes: 'bg-[#ba1a1a]/10 text-[#93000a] border-[#ba1a1a]/30' },
  check_in: { label: 'Check-in', classes: 'bg-[#1976d2]/10 text-[#0d47a1] border-[#1976d2]/30' },
  check_out: { label: 'Check-out', classes: 'bg-[#1976d2]/10 text-[#0d47a1] border-[#1976d2]/30' },
  payment: { label: 'Pago', classes: 'bg-[#3F6B4F]/10 text-[#3F6B4F] border-[#3F6B4F]/30' },
  cancel: { label: 'Cancelación', classes: 'bg-[#ba1a1a]/10 text-[#93000a] border-[#ba1a1a]/30' },
  status_change: { label: 'Cambio de estado', classes: 'bg-[#c9a227]/15 text-[#755b00] border-[#c9a227]/40' },
  role_change: { label: 'Cambio de rol', classes: 'bg-[#525e7d]/10 text-[#525e7d] border-[#525e7d]/30' },
};

const SUBJECTS = {
  Booking: 'Reserva',
  Room: 'Habitación',
  Product: 'Producto',
  Coupon: 'Cupón',
  Season: 'Temporada',
  Guest: 'Huésped',
  User: 'Usuario',
  Payment: 'Pago',
  Charge: 'Consumo',
};

const EMPTY_FILTERS = { user_id: '', action: '', subject_type: '', date_from: '', date_to: '' };

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '∅';
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function ChangesDetail({ changes }) {
  if (!changes || typeof changes !== 'object') {
    return <p className="font-mono text-xs text-[#78716c]">Sin detalle de cambios.</p>;
  }

  const oldValues = changes.old && typeof changes.old === 'object' ? changes.old : {};
  const newValues = changes.new && typeof changes.new === 'object' ? changes.new : {};
  const keys = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])];
  const extras = Object.entries(changes).filter(([k, v]) => k !== 'old' && k !== 'new' && v !== null && v !== undefined);

  return (
    <div className="space-y-3">
      {keys.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[#78716c]">
                <th className="py-1 pr-4 font-bold">Campo</th>
                <th className="py-1 pr-4 font-bold">Anterior</th>
                <th className="py-1 pr-4 font-bold" aria-hidden="true"></th>
                <th className="py-1 font-bold">Nuevo</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key} className="border-t border-[#e4e2dd] align-top">
                  <td className="py-1.5 pr-4 font-bold text-[#14213d] whitespace-nowrap">{key}</td>
                  <td className="py-1.5 pr-4 text-[#93000a] break-all">
                    {key in oldValues ? formatValue(oldValues[key]) : '—'}
                  </td>
                  <td className="py-1.5 pr-4 text-[#78716c]" aria-hidden="true">→</td>
                  <td className="py-1.5 text-[#3F6B4F] break-all">
                    {key in newValues ? formatValue(newValues[key]) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {extras.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs font-mono">
          {extras.map(([k, v]) => (
            <Fragment key={k}>
              <dt className="font-bold text-[#14213d]">{k === 'reason' ? 'motivo' : k === 'forced' ? 'forzado' : k}</dt>
              <dd className="text-[#4d4635] break-all">{formatValue(v)}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      {keys.length === 0 && extras.length === 0 && (
        <p className="font-mono text-xs text-[#78716c]">Sin detalle de cambios.</p>
      )}
    </div>
  );
}

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [users, setUsers] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getActivityLogs({ ...filters, search: debouncedSearch, page });
      setLogs(data?.data || []);
      setMeta({
        current_page: data?.current_page || 1,
        last_page: data?.last_page || 1,
        total: data?.total || 0,
        from: data?.from || 0,
        to: data?.to || 0,
      });
    } catch (err) {
      logError('audit:list', err);
      setError(apiErrorMessage(err, 'No se pudo cargar la bitácora de auditoría.'));
    } finally {
      setLoading(false);
    }
  }, [filters, debouncedSearch, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    let active = true;
    getStaff()
      .then((data) => { if (active) setUsers(data || []); })
      .catch((err) => logError('audit:users', err));
    return () => { active = false; };
  }, []);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearch('');
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportActivityLogs({ ...filters, search: debouncedSearch });
      setToast({ type: 'success', message: 'Exportación generada (máx. 5000 registros).' });
    } catch (err) {
      logError('audit:export', err);
      setToast({ type: 'error', message: apiErrorMessage(err, 'No se pudo exportar la bitácora.') });
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = search.trim() !== '' || Object.values(filters).some((v) => v !== '');
  const inputClasses = 'w-full bg-white border border-[#d1c5af] px-2 py-1.5 text-sm font-sans focus:border-[#14213d] focus:outline-none';
  const labelClasses = 'block font-mono text-[10px] uppercase font-bold text-[#78716c] mb-1';

  return (
    <StaffLayout>
      <header className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[10px] font-mono tracking-widest text-[#78716c] uppercase font-bold mb-1">
            Seguridad · Administración
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2d2d2a] tracking-tight">
            Bitácora de Auditoría
          </h1>
          <p className="font-sans text-sm text-[#4d4635] mt-1">
            Registro automático de acciones del personal y del sistema.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || loading}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#14213d] hover:bg-[#0a1628] text-[#fbf9f4] border border-[#c9a227] font-mono text-xs uppercase font-bold tracking-wider disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">download</span>
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </header>

      <main className="px-4 sm:px-8 pb-8">
        {/* Filtros */}
        <section aria-label="Filtros" className="bg-white p-4 mb-6 shadow-sm border border-[#e4e2dd]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <label htmlFor="audit-search" className={labelClasses}>Buscar en descripción</label>
              <input
                id="audit-search"
                type="search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Ej. código de reserva, habitación..."
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="audit-user" className={labelClasses}>Usuario</label>
              <select id="audit-user" value={filters.user_id} onChange={(e) => updateFilter('user_id', e.target.value)} className={inputClasses}>
                <option value="">Todos</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="audit-action" className={labelClasses}>Acción</label>
              <select id="audit-action" value={filters.action} onChange={(e) => updateFilter('action', e.target.value)} className={inputClasses}>
                <option value="">Todas</option>
                {Object.entries(ACTIONS).map(([key, a]) => (
                  <option key={key} value={key}>{a.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="audit-subject" className={labelClasses}>Entidad</label>
              <select id="audit-subject" value={filters.subject_type} onChange={(e) => updateFilter('subject_type', e.target.value)} className={inputClasses}>
                <option value="">Todas</option>
                {Object.entries(SUBJECTS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
              <div>
                <label htmlFor="audit-from" className={labelClasses}>Desde</label>
                <input id="audit-from" type="date" value={filters.date_from} onChange={(e) => updateFilter('date_from', e.target.value)} className={inputClasses} />
              </div>
              <div>
                <label htmlFor="audit-to" className={labelClasses}>Hasta</label>
                <input id="audit-to" type="date" value={filters.date_to} min={filters.date_from || undefined} onChange={(e) => updateFilter('date_to', e.target.value)} className={inputClasses} />
              </div>
            </div>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 font-mono text-[10px] uppercase font-bold tracking-widest text-[#c9a227] hover:text-[#987d35]"
            >
              Limpiar filtros
            </button>
          )}
        </section>

        {error && (
          <div role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-4 mb-6 text-[#93000a] font-mono text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Tabla */}
        <section className="bg-white shadow-sm border border-[#e4e2dd]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-[#f5f3ee] border-b border-[#d1c5af]">
                <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-[#4d4635]">
                  <th className="px-4 py-3 w-8"><span className="sr-only">Detalle</span></th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3">Entidad</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {loading && logs.length === 0 && (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={`sk-${i}`} className="border-b border-[#e4e2dd]">
                      <td colSpan={7} className="px-4 py-3"><div className="h-4 bg-[#eae8e3] animate-pulse" /></td>
                    </tr>
                  ))
                )}
                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center font-mono text-xs text-[#78716c]">
                      No hay registros para los filtros seleccionados.
                    </td>
                  </tr>
                )}
                {logs.map((log) => {
                  const action = ACTIONS[log.action] || { label: log.action, classes: 'bg-[#e4e2dd] text-[#4d4635] border-[#d1c5af]' };
                  const expanded = expandedId === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr className={`border-b border-[#e4e2dd] align-top ${expanded ? 'bg-[#fbf9f4]' : 'hover:bg-[#fbf9f4]'} ${loading ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : log.id)}
                            aria-expanded={expanded}
                            aria-label={expanded ? 'Ocultar cambios' : 'Ver cambios'}
                            className="text-[#78716c] hover:text-[#14213d]"
                          >
                            <span className={`material-symbols-outlined text-lg transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden="true">chevron_right</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-[#4d4635]">{formatDateTime(log.created_at)}</td>
                        <td className="px-4 py-3">
                          {log.user ? (
                            <>
                              <div className="font-semibold text-[#1b1c19] truncate max-w-[180px]">{log.user.name}</div>
                              <div className="font-mono text-[10px] text-[#78716c] truncate max-w-[180px]">{log.user.email}</div>
                            </>
                          ) : (
                            <span className="font-mono text-xs text-[#78716c]">Sistema / anónimo</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 border font-mono text-[10px] uppercase font-bold tracking-wider whitespace-nowrap ${action.classes}`}>
                            {action.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-[#4d4635]">
                          {log.subject_type ? `${SUBJECTS[log.subject_type] || log.subject_type}${log.subject_id ? ` #${log.subject_id}` : ''}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-[#1b1c19] break-words max-w-[360px]">{log.description}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#78716c] whitespace-nowrap">{log.ip_address || '—'}</td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-[#e4e2dd] bg-[#fbf9f4]">
                          <td></td>
                          <td colSpan={6} className="px-4 pb-4 pt-1">
                            <ChangesDetail changes={log.changes} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#d1c5af] bg-[#f5f3ee]">
            <p className="font-mono text-[11px] text-[#4d4635]">
              {meta.total > 0 ? `Mostrando ${meta.from}–${meta.to} de ${meta.total} registros` : 'Sin registros'}
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
              <span className="font-mono text-xs text-[#4d4635]">
                {meta.current_page} / {meta.last_page}
              </span>
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

      <Toast message={toast?.message} isOpen={!!toast} type={toast?.type} onClose={() => setToast(null)} />
    </StaffLayout>
  );
}
