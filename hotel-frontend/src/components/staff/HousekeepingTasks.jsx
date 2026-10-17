import { useCallback, useEffect, useId, useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';
import { getStaff } from '../../services/staffService';
import {
  TASK_STATUSES,
  TASK_TYPES,
  assignTask,
  createTask,
  finishTask,
  inspectTask,
  listTasks,
  startTask,
  taskStatusMeta,
  taskTypeMeta,
} from '../../services/housekeepingService';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';

const STATUS_FILTERS = [
  { value: '', label: 'Abiertas + inspeccionadas hoy' },
  { value: 'open', label: 'Solo abiertas' },
  ...TASK_STATUSES.map((s) => ({ value: s.value, label: s.label })),
  { value: 'all', label: 'Todas' },
];

const COLUMNS = ['pending', 'in_progress', 'done', 'inspected'];

const fmtTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const btn = 'inline-flex items-center gap-1 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';

/**
 * Pestaña "Tareas" del tablero de housekeeping (SHE-032): asignación y flujo
 * pendiente → en curso → finalizada → inspeccionada (libera la habitación).
 */
export default function HousekeepingTasks({ rooms = [], isAdmin, currentUser, notify, onRoomsChanged }) {
  const uid = useId();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState({ status: '', assigned_to: '', date: '' });
  const [staff, setStaff] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [inspectTarget, setInspectTarget] = useState(null);

  const [form, setForm] = useState({ room_id: '', type: 'cleaning', notes: '', assigned_to: '' });
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    listTasks(filters, { signal: controller.signal })
      .then(setTasks)
      .catch((err) => {
        if (controller.signal.aborted) return;
        logError('housekeeping:tasks', err);
        setError(apiErrorMessage(err, 'No se pudieron cargar las tareas.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, reloadKey]);

  // Lista de personal (endpoint solo admin). La recepción se autoasigna.
  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    getStaff()
      .then((list) => {
        if (cancelled) return;
        setStaff((list || []).filter((u) => u.is_active && (u.roles || []).some((r) => r === 'admin' || r === 'recepcionista')));
      })
      .catch((err) => logError('housekeeping:staff', err));
    return () => { cancelled = true; };
  }, [isAdmin]);

  const run = async (task, action, successFallback) => {
    setBusyId(task.id);
    try {
      const res = await action();
      notify(res?.message || successFallback, 'success');
      if (res?.room_released) onRoomsChanged?.();
      reload();
    } catch (err) {
      logError('housekeeping:task-action', err);
      notify(apiErrorMessage(err, 'No se pudo actualizar la tarea.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.room_id) {
      notify('Seleccione una habitación.', 'error');
      return;
    }
    setCreating(true);
    try {
      const res = await createTask({
        room_id: Number(form.room_id),
        type: form.type,
        notes: form.notes.trim(),
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      });
      notify(res?.message || 'Tarea creada.', 'success');
      setForm({ room_id: '', type: 'cleaning', notes: '', assigned_to: '' });
      setShowForm(false);
      reload();
    } catch (err) {
      logError('housekeeping:create', err);
      notify(apiErrorMessage(err, 'No se pudo crear la tarea.'), 'error');
    } finally {
      setCreating(false);
    }
  };

  const grouped = COLUMNS.reduce((acc, s) => ({ ...acc, [s]: tasks.filter((t) => t.status === s) }), {});
  const selectCls = 'border-b border-[#78716c] pb-1 text-sm bg-transparent focus:outline-none font-medium cursor-pointer';

  return (
    <section aria-label="Tareas de housekeeping" className="flex flex-col gap-6">
      {/* Filtros + nueva tarea */}
      <div className="bg-white p-4 flex flex-wrap items-end gap-4 sm:gap-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-st`} className="font-mono text-[10px] uppercase font-bold text-[#78716c]">Estado</label>
          <select id={`${uid}-st`} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className={selectCls}>
            {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-as`} className="font-mono text-[10px] uppercase font-bold text-[#78716c]">Responsable</label>
          <select id={`${uid}-as`} value={filters.assigned_to} onChange={(e) => setFilters((f) => ({ ...f, assigned_to: e.target.value }))} className={selectCls}>
            <option value="">Todos</option>
            <option value="me">Mis tareas</option>
            <option value="none">Sin asignar</option>
            {staff.filter((u) => u.id !== currentUser?.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-dt`} className="font-mono text-[10px] uppercase font-bold text-[#78716c]">Creadas el</label>
          <input id={`${uid}-dt`} type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} className={selectCls} />
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
          className="ml-auto bg-[#c9a227] text-[#14213d] border border-[#a68a4d] px-4 py-2 font-mono text-xs uppercase tracking-wider font-bold hover:brightness-105 cursor-pointer"
        >
          {showForm ? 'Cerrar' : '+ Nueva tarea'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-[#f5f3ee] border border-[#d1c5af] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-room`} className="font-mono text-[10px] uppercase font-bold text-[#78716c]">Habitación *</label>
            <select id={`${uid}-room`} required value={form.room_id} onChange={(e) => setForm((f) => ({ ...f, room_id: e.target.value }))} className={selectCls}>
              <option value="">Seleccione...</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_number} · {r.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-type`} className="font-mono text-[10px] uppercase font-bold text-[#78716c]">Tipo</label>
            <select id={`${uid}-type`} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={selectCls}>
              {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-asg`} className="font-mono text-[10px] uppercase font-bold text-[#78716c]">Responsable</label>
            <select id={`${uid}-asg`} value={form.assigned_to} onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))} className={selectCls}>
              <option value="">Sin asignar</option>
              {currentUser && <option value={currentUser.id}>Yo ({currentUser.name})</option>}
              {isAdmin && staff.filter((u) => u.id !== currentUser?.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 lg:col-span-1">
            <label htmlFor={`${uid}-notes`} className="font-mono text-[10px] uppercase font-bold text-[#78716c]">Notas</label>
            <input id={`${uid}-notes`} type="text" maxLength={1000} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={selectCls} placeholder="Opcional" />
          </div>
          <button type="submit" disabled={creating} className="bg-[#14213d] text-white border border-[#c9a227] px-4 py-2 font-mono text-xs uppercase tracking-wider font-bold disabled:opacity-50 cursor-pointer">
            {creating ? 'Creando...' : 'Crear tarea'}
          </button>
        </form>
      )}

      {error && (
        <div role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-4 text-[#93000a] font-mono text-xs flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={reload} className="underline font-bold uppercase cursor-pointer">Reintentar</button>
        </div>
      )}

      {loading && tasks.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-40 bg-white/50 animate-pulse" />)}
        </div>
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start ${loading ? 'opacity-60' : ''}`}>
          {COLUMNS.map((status) => {
            const meta = taskStatusMeta(status);
            const list = grouped[status] || [];
            return (
              <div key={status} className="flex flex-col gap-3 min-w-0">
                <h3 className="flex items-center justify-between font-serif text-lg font-bold text-[#2d2d2a] border-b-2 border-gray-300 pb-2">
                  {meta.label}
                  <span className="font-mono text-xs text-[#78716c]">{list.length}</span>
                </h3>
                {list.length === 0 ? (
                  <p className="font-mono text-[11px] text-[#78716c] text-center py-6 bg-white/40">Sin tareas</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {list.map((task) => {
                      const type = taskTypeMeta(task.type);
                      const mine = task.assigned_to === currentUser?.id;
                      const busy = busyId === task.id;
                      return (
                        <li key={task.id} className="bg-white border border-gray-200 shadow-sm p-3 flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="bg-[#14213d] text-white font-mono text-xs font-bold px-2 py-1">{task.room?.room_number ?? '—'}</span>
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold text-[#755b00]">
                              <span className="material-symbols-outlined text-sm" aria-hidden="true">{type.icon}</span>
                              {type.label}
                            </span>
                          </div>
                          {task.notes && <p className="text-xs text-[#4d4635] whitespace-pre-line line-clamp-3">{task.notes}</p>}
                          <p className="font-mono text-[10px] text-[#78716c]">
                            {task.assignee ? `Responsable: ${task.assignee.name}` : 'Sin asignar'}
                            {fmtTime(task.started_at) ? ` · Inicio ${fmtTime(task.started_at)}` : ''}
                            {fmtTime(task.finished_at) ? ` · Fin ${fmtTime(task.finished_at)}` : ''}
                            {task.inspector ? ` · Inspeccionó ${task.inspector.name}` : ''}
                          </p>
                          {task.room?.status && (
                            <p className="font-mono text-[10px] text-[#78716c]">Habitación: <span className="font-bold uppercase">{task.room.status}</span></p>
                          )}

                          {status !== 'inspected' && (
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                              {isAdmin ? (
                                <>
                                  <label htmlFor={`${uid}-a-${task.id}`} className="sr-only">Asignar tarea de la habitación {task.room?.room_number}</label>
                                  <select
                                    id={`${uid}-a-${task.id}`}
                                    value={task.assigned_to ?? ''}
                                    disabled={busy}
                                    onChange={(e) => run(task, () => assignTask(task.id, e.target.value ? Number(e.target.value) : null), 'Tarea asignada.')}
                                    className="border border-[#d1c5af] bg-white text-xs p-1 max-w-[150px]"
                                  >
                                    <option value="">Sin asignar</option>
                                    {currentUser && <option value={currentUser.id}>Yo</option>}
                                    {staff.filter((u) => u.id !== currentUser?.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                  </select>
                                </>
                              ) : !task.assigned_to ? (
                                <button type="button" disabled={busy} onClick={() => run(task, () => assignTask(task.id, currentUser?.id), 'Tarea asignada.')} className={`${btn} border border-[#d1c5af] text-[#14213d] hover:border-[#14213d]`}>
                                  <span className="material-symbols-outlined text-sm" aria-hidden="true">person_add</span> Asignarme
                                </button>
                              ) : mine && status === 'pending' ? (
                                <button type="button" disabled={busy} onClick={() => run(task, () => assignTask(task.id, null), 'Tarea liberada.')} className={`${btn} border border-[#d1c5af] text-[#4d4635] hover:border-[#14213d]`}>
                                  Liberar
                                </button>
                              ) : null}

                              {status === 'pending' && (
                                <button type="button" disabled={busy} onClick={() => run(task, () => startTask(task.id), 'Tarea iniciada.')} className={`${btn} bg-[#1565c0] text-white hover:bg-[#1976d2]`}>
                                  <span className="material-symbols-outlined text-sm" aria-hidden="true">play_arrow</span> Iniciar
                                </button>
                              )}
                              {status === 'in_progress' && (
                                <button type="button" disabled={busy} onClick={() => run(task, () => finishTask(task.id), 'Tarea finalizada.')} className={`${btn} bg-[#6a1b9a] text-white hover:bg-[#7b1fa2]`}>
                                  <span className="material-symbols-outlined text-sm" aria-hidden="true">done</span> Finalizar
                                </button>
                              )}
                              {status === 'done' && (
                                <button type="button" disabled={busy} onClick={() => setInspectTarget(task)} className={`${btn} bg-[#2E7A4A] text-white hover:bg-[#3f9e63]`}>
                                  <span className="material-symbols-outlined text-sm" aria-hidden="true">verified</span> Inspeccionar
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!inspectTarget}
        title="Inspeccionar tarea"
        message={inspectTarget ? `¿Confirma que la habitación ${inspectTarget.room?.room_number ?? ''} fue revisada? Si no hay huésped alojado quedará DISPONIBLE.` : ''}
        confirmLabel="Aprobar inspección"
        busy={!!busyId}
        onCancel={() => setInspectTarget(null)}
        onConfirm={() => {
          const task = inspectTarget;
          setInspectTarget(null);
          run(task, () => inspectTask(task.id), 'Tarea inspeccionada.');
        }}
      />
    </section>
  );
}
