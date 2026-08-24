import api from './api';

/**
 * Servicio para la gestión de reservas en el frontend.
 */

/**
 * Crea una nueva reserva para un huésped en el backend.
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
  const response = await api.get(`/bookings/${code}`);
  return response.data;
};

export default {
  createBooking,
  getBookingByCode,
};
