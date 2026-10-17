import api from './api';

/**
 * Recepción (front desk): rack de ocupación, panel del día y acciones de reserva.
 */

/** GET /staff/front-desk/rack?start=YYYY-MM-DD&days=N */
export const getRack = async ({ start, days }, { signal } = {}) => {
  const response = await api.get('/staff/front-desk/rack', { params: { start, days }, signal });
  return response.data;
};

/** GET /staff/front-desk/today -> { arrivals, departures, in_house, no_show_candidates, counts } */
export const getToday = async ({ signal } = {}) => {
  const response = await api.get('/staff/front-desk/today', { signal });
  return response.data;
};

export const checkInBooking = async (code) => {
  const response = await api.post(`/staff/bookings/${encodeURIComponent(code)}/check-in`);
  return response.data;
};

export const checkOutBooking = async (code, { reason, force } = {}) => {
  const response = await api.post(`/staff/bookings/${encodeURIComponent(code)}/check-out`, {
    early_checkout_reason: reason || undefined,
    force: force || undefined,
  });
  return response.data;
};

/** POST /staff/bookings/{code}/no-show (penalidad y liberación de la habitación en el servidor). */
export const markNoShow = async (code) => {
  const response = await api.post(`/staff/bookings/${encodeURIComponent(code)}/no-show`);
  return response.data;
};

/** Mueve una reserva (habitación y/o fechas) vía PUT /bookings/{code}. */
export const moveBooking = async (code, { roomId, checkIn, checkOut }) => {
  const response = await api.put(`/bookings/${encodeURIComponent(code)}`, {
    room_id: roomId,
    check_in: checkIn,
    check_out: checkOut,
  });
  return response.data;
};

export default {
  getRack,
  getToday,
  checkInBooking,
  checkOutBooking,
  markNoShow,
  moveBooking,
};
