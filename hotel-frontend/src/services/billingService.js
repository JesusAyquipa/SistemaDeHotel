import api from './api';

/**
 * Facturación (G1): política de cancelación, no-show, comprobantes internos y reembolsos.
 */

function cleanParams(filters = {}) {
  const params = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params[key] = typeof value === 'string' ? value.trim() : value;
    }
  });
  return params;
}

// ── Política de cancelación (SHE-028) ───────────────────────────────

/** GET público: { free_cancellation_hours, late_cancellation_penalty_nights, no_show_penalty_nights, no_show_grace_hours } */
export const getCancellationPolicy = async () => {
  const response = await api.get('/settings/cancellation-policy');
  return response.data;
};

/** PUT (solo admin) */
export const updateCancellationPolicy = async (policy) => {
  const response = await api.put('/settings/cancellation-policy', policy);
  return response.data;
};

/** Marca una reserva confirmada como no-show (admin | recepcionista). */
export const markNoShow = async (bookingCode) => {
  const response = await api.post(`/staff/bookings/${encodeURIComponent(bookingCode)}/no-show`);
  return response.data;
};

// ── Comprobantes internos (SHE-027) ─────────────────────────────────

/**
 * Emite boleta/factura para una reserva.
 * @param {number} bookingId
 * @param {{type, customer_doc_type, customer_doc_number, customer_name, customer_address?}} data
 */
export const issueInvoice = async (bookingId, data) => {
  const response = await api.post(`/staff/bookings/${bookingId}/invoice`, data);
  return response.data;
};

/** Lista paginada: filtros { type, status, date_from, date_to, search, page } */
export const listInvoices = async (filters = {}) => {
  const response = await api.get('/staff/invoices', { params: cleanParams(filters) });
  return response.data;
};

/** Anula un comprobante (solo admin). */
export const voidInvoice = async (invoiceId, reason) => {
  const response = await api.post(`/staff/invoices/${invoiceId}/void`, { reason });
  return response.data;
};

/** Comprobante vigente de una reserva (dueño o staff). Lanza 404 si aún no se emitió. */
export const getBookingInvoice = async (bookingCode) => {
  const response = await api.get(`/bookings/${encodeURIComponent(bookingCode)}/invoice`);
  return response.data;
};

// ── Reembolsos (SHE-029, solo admin) ────────────────────────────────

/** status: refund_pending | refunded | refund_rejected */
export const listRefunds = async (filters = {}) => {
  const response = await api.get('/staff/refunds', { params: cleanParams(filters) });
  return response.data;
};

/** method: transfer | card | cash */
export const approveRefund = async (paymentId, { method, reference }) => {
  const response = await api.post(`/staff/refunds/${paymentId}/approve`, {
    method,
    reference: reference || undefined,
  });
  return response.data;
};

export const rejectRefund = async (paymentId, reason) => {
  const response = await api.post(`/staff/refunds/${paymentId}/reject`, { reason });
  return response.data;
};

export default {
  getCancellationPolicy,
  updateCancellationPolicy,
  markNoShow,
  issueInvoice,
  listInvoices,
  voidInvoice,
  getBookingInvoice,
  listRefunds,
  approveRefund,
  rejectRefund,
};
