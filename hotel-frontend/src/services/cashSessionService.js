import api from './api';

/**
 * Sesiones de caja por usuario (SHE-014) e historial de cajas (SHE-015).
 */

function cleanFilters(filters = {}) {
  const params = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params[key] = typeof value === 'string' ? value.trim() : value;
    }
  });
  return params;
}

/**
 * Abre la caja del usuario autenticado.
 * @param {{ opening_amount: number, notes?: string }} data
 * @returns {Promise<Object>} La sesión abierta. 409 si ya tiene una caja abierta.
 */
export const openCashSession = async (data) => {
  const response = await api.post('/staff/cash-sessions/open', data);
  return response.data?.session ?? response.data;
};

/**
 * Sesión abierta del usuario y resumen de cobros desde la apertura.
 * @returns {Promise<{ session: Object|null, summary: Object|null }>}
 */
export const getCurrentCashSession = async ({ signal } = {}) => {
  const response = await api.get('/staff/cash-sessions/current', { signal });
  const data = response.data || {};
  return { session: data.session ?? null, summary: data.summary ?? null };
};

/**
 * Historial paginado de cajas (solo administradores).
 * @param {Object} filters { date_from, date_to, user_id, status, page }
 * @returns {Promise<{ items: Array, pagination: Object, totals: Object }>}
 */
export const listCashSessions = async (filters = {}) => {
  const response = await api.get('/staff/cash-sessions', { params: cleanFilters(filters) });
  return normalizeCashSessionList(response.data);
};

/**
 * Detalle de una sesión de caja, con los pagos registrados en ella.
 */
export const getCashSession = async (id) => {
  const response = await api.get(`/staff/cash-sessions/${encodeURIComponent(id)}`);
  const data = response.data || {};
  const session = data.session ?? data.data ?? data;
  const payments = session?.payments ?? data.payments ?? [];
  return { ...session, payments: Array.isArray(payments) ? payments : [] };
};

/**
 * Acepta el paginador de Laravel ({ data, current_page, ... }) o un recurso
 * ({ data, meta: { current_page, ..., totals } }).
 */
export function normalizeCashSessionList(raw) {
  const data = raw || {};
  const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
  const source = meta.current_page !== undefined ? meta : data;
  const totalsRaw = meta.totals ?? data.totals ?? meta;
  const pick = (...keys) => {
    for (const k of keys) {
      if (totalsRaw?.[k] !== undefined && totalsRaw?.[k] !== null) return Number(totalsRaw[k]) || 0;
    }
    return 0;
  };
  const items = Array.isArray(data.data) ? data.data : [];
  const currentPage = Number(source.current_page) || 1;
  const total = Number(source.total) || 0;
  // meta.from / meta.to si el servidor los envía; si no, se calculan con current_page/per_page.
  const rawFrom = meta.from ?? data.from;
  const rawTo = meta.to ?? data.to;
  let from = 0;
  let to = 0;
  if (rawFrom !== undefined && rawFrom !== null && rawTo !== undefined && rawTo !== null) {
    from = Number(rawFrom) || 0;
    to = Number(rawTo) || 0;
  } else if (items.length > 0) {
    const perPage = Number(meta.per_page ?? data.per_page) || items.length;
    from = (currentPage - 1) * perPage + 1;
    to = from + items.length - 1;
    if (total > 0) to = Math.min(to, total);
  }
  return {
    items,
    pagination: {
      current_page: currentPage,
      last_page: Number(source.last_page) || 1,
      total,
      from,
      to,
    },
    totals: {
      expected: pick('expected', 'expected_amount', 'total_expected', 'sum_expected'),
      counted: pick('counted', 'counted_amount', 'total_counted', 'sum_counted'),
      difference: pick('difference', 'total_difference', 'sum_difference'),
    },
  };
}

export default {
  openCashSession,
  getCurrentCashSession,
  listCashSessions,
  getCashSession,
};
