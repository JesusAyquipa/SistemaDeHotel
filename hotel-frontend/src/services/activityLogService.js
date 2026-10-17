import api from './api';

/**
 * Servicio de la bitácora de auditoría (solo administradores).
 */

function cleanFilters(filters = {}) {
  const params = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '' && value !== 'todos') {
      params[key] = typeof value === 'string' ? value.trim() : value;
    }
  });
  return params;
}

/**
 * Lista paginada (25 por página).
 * @param {Object} filters - { user_id, action, subject_type, date_from, date_to, search, page }
 * @returns {Promise<Object>} Paginador de Laravel { data, current_page, last_page, total, ... }
 */
export const getActivityLogs = async (filters = {}) => {
  const response = await api.get('/staff/activity-logs', { params: cleanFilters(filters) });
  return response.data;
};

/**
 * Descarga la bitácora filtrada como CSV (máx. 5000 filas).
 */
export const exportActivityLogs = async (filters = {}) => {
  const params = cleanFilters(filters);
  delete params.page;
  const response = await api.get('/staff/activity-logs/export', {
    params,
    responseType: 'blob',
    headers: { Accept: 'text/csv' },
  });

  const disposition = response.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match ? match[1] : 'bitacora-auditoria.csv';

  const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default { getActivityLogs, exportActivityLogs };
