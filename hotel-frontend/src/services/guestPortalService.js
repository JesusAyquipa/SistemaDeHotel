import api from './api';

/**
 * Portal del cliente (SHE-036 / SHE-037): folio, pre check-in, comprobante y reseña.
 */
const enc = (code) => encodeURIComponent(code);

/** Estado de cuenta: { booking, charges, payments, refunds, totals } */
export const getBookingFolio = async (code) => {
  const response = await api.get(`/bookings/${enc(code)}/folio`);
  return response.data;
};

/** { pre_check_in, window: {open, opens_at, reason}, capacity, prefill } */
export const getPreCheckIn = async (code) => {
  const response = await api.get(`/bookings/${enc(code)}/pre-check-in`);
  return response.data;
};

export const savePreCheckIn = async (code, data) => {
  const response = await api.post(`/bookings/${enc(code)}/pre-check-in`, data);
  return response.data;
};

/** Comprobante emitido por el hotel (404 si aún no se emite). */
export const getBookingInvoice = async (code) => {
  const response = await api.get(`/bookings/${enc(code)}/invoice`);
  return response.data?.invoice ?? response.data;
};

/** Reseña de la reserva (404 si no existe). */
export const getBookingReview = async (code) => {
  const response = await api.get(`/bookings/${enc(code)}/review`);
  return response.data.review;
};

export const submitReview = async (code, data) => {
  const response = await api.post(`/bookings/${enc(code)}/review`, data);
  return response.data;
};

export default {
  getBookingFolio,
  getPreCheckIn,
  savePreCheckIn,
  getBookingInvoice,
  getBookingReview,
  submitReview,
};
