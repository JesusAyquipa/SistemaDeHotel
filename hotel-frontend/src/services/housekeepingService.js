import api from './api';

/**
 * Tareas de housekeeping (SHE-032). Rutas /staff/housekeeping/* (admin | recepcionista).
 */

/** @param {{ status?: string, assigned_to?: string|number, date?: string, type?: string, room_id?: number }} params */
export const listTasks = async (params = {}, { signal } = {}) => {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
  const response = await api.get('/staff/housekeeping/tasks', { params: clean, signal });
  return response.data.tasks || [];
};

export const createTask = async ({ room_id, type, notes, assigned_to }) => {
  const response = await api.post('/staff/housekeeping/tasks', {
    room_id,
    type,
    notes: notes || null,
    assigned_to: assigned_to || null,
  });
  return response.data;
};

export const assignTask = async (id, assignedTo) => {
  const response = await api.patch(`/staff/housekeeping/tasks/${id}/assign`, { assigned_to: assignedTo ?? null });
  return response.data;
};

export const startTask = async (id) => (await api.post(`/staff/housekeeping/tasks/${id}/start`)).data;

export const finishTask = async (id) => (await api.post(`/staff/housekeeping/tasks/${id}/finish`)).data;

export const inspectTask = async (id, notes) => (await api.post(`/staff/housekeeping/tasks/${id}/inspect`, { notes: notes || null })).data;

export const TASK_TYPES = [
  { value: 'cleaning', label: 'Limpieza', icon: 'cleaning_services' },
  { value: 'inspection', label: 'Inspección', icon: 'fact_check' },
  { value: 'maintenance', label: 'Mantenimiento', icon: 'build' },
];

export const TASK_STATUSES = [
  { value: 'pending', label: 'Pendiente', badge: 'bg-[#fff3e0] text-[#e65100] border-[#ff9800]' },
  { value: 'in_progress', label: 'En curso', badge: 'bg-[#e3f2fd] text-[#1565c0] border-[#2196f3]' },
  { value: 'done', label: 'Por inspeccionar', badge: 'bg-[#f3e5f5] text-[#6a1b9a] border-[#ab47bc]' },
  { value: 'inspected', label: 'Inspeccionada', badge: 'bg-[#e8f5e9] text-[#1b5e20] border-[#4caf50]' },
];

export const taskTypeMeta = (type) => TASK_TYPES.find((t) => t.value === type) || { value: type, label: type, icon: 'task' };
export const taskStatusMeta = (status) => TASK_STATUSES.find((s) => s.value === status) || { value: status, label: status, badge: 'bg-gray-100 text-gray-800 border-gray-300' };
