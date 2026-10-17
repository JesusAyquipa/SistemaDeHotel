import api from './api';

/**
 * Servicio para la gestión de reservas en el frontend.
 */

/**
 * Crea una nueva reserva (walk-in) desde recepción. Solo personal (admin/recepcionista).
 * @param {Object} bookingData - Datos completos de la reserva y huésped
 * @returns {Promise<Object>} Respuesta con booking, booking_code y mensaje
 */
export const createBooking = async (bookingData) => {
  const response = await api.post('/bookings', bookingData);
  return response.data;
};

/**
 * Consulta los datos de una reserva mediante su código único.
 * @param {string} code - Código alfanumérico (ej: RES-8K9W2B4F)
 * @returns {Promise<Object>} Datos de la reserva
 */
export const getBookingByCode = async (code) => {
  const response = await api.get(`/bookings/${encodeURIComponent(code)}`);
  return response.data;
};

export const getMyBookings = async () => {
  const response = await api.get('/my-bookings');
  return response.data.bookings;
};

export const cancelBooking = async (code) => {
  const response = await api.post(`/bookings/${encodeURIComponent(code)}/cancel`);
  return response.data;
};

/**
 * Modifica una reserva (dueño o personal). Si la diferencia de precio es positiva,
 * `data` debe incluir card_number, card_expiry, card_cvc y card_holder; el cobro se
 * realiza en el servidor (402 si es rechazado).
 */
export const updateBooking = async (code, data) => {
  const response = await api.put(`/bookings/${encodeURIComponent(code)}`, data);
  return response.data;
};

export default {
  createBooking,
  getBookingByCode,
  getMyBookings,
  cancelBooking,
  updateBooking,
};
