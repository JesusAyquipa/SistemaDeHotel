import api from './api';

/**
 * Servicio para el módulo de pagos y checkout seguro en el frontend.
 */

/**
 * Crea una intención de pago (checkout intent) para una reserva.
 * Registra la reserva en estado pending_payment y prepara la pasarela.
 *
 * @param {Object} checkoutData - Datos de habitación, fechas y huésped
 * @returns {Promise<Object>} Respuesta con booking_code, client_secret, transaction_id
 */
export const createCheckoutIntent = async (checkoutData) => {
  const response = await api.post('/payments/checkout-intent', checkoutData);
  return response.data;
};

/**
 * Procesa un pago con tarjeta usando la pasarela simulada (modo development).
 *
 * @param {Object} paymentData - { booking_code, card_number, card_expiry, card_cvc, card_holder }
 * @returns {Promise<Object>} Resultado del pago con receipt_number si fue exitoso
 */
export const processMockPayment = async (paymentData) => {
  const response = await api.post('/payments/process-mock', paymentData);
  return response.data;
};

/**
 * Obtiene el comprobante de pago (receipt) de una reserva confirmada.
 *
 * El backend permite verlo al dueño autenticado, al personal, o a quien indique el
 * correo del huésped (`email`), para que los huéspedes sin sesión puedan consultarlo.
 *
 * @param {string} bookingCode - Código de reserva (ej: RES-8K9W2B4F)
 * @param {string|null} email - Correo del huésped ingresado en el checkout (opcional)
 * @returns {Promise<Object>} Datos completos del comprobante/recibo
 */
export const fetchReceipt = async (bookingCode, email = null) => {
  const params = email ? { email } : undefined;
  const response = await api.get(`/bookings/${encodeURIComponent(bookingCode)}/receipt`, { params });
  return response.data;
};

export default {
  createCheckoutIntent,
  processMockPayment,
  fetchReceipt,
};
