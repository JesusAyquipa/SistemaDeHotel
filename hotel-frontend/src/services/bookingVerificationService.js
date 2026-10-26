import api from './api';

/**
 * Verificación de correo por código (OTP) para reservas sin cuenta (SHE-026).
 */

/**
 * Envía un código de 6 dígitos al correo. La API responde siempre 200 (no revela si el correo existe).
 * @param {string} email
 */
export const sendBookingVerificationCode = async (email) => {
  const response = await api.post('/booking-verification/send', { email });
  return response.data;
};

/**
 * Verifica el código y devuelve un token de un solo uso para el checkout.
 * @param {string} email
 * @param {string} code
 * @returns {Promise<{ verification_token: string, expires_at: string }>}
 */
export const verifyBookingCode = async (email, code) => {
  const response = await api.post('/booking-verification/verify', { email, code });
  return response.data;
};

export default { sendBookingVerificationCode, verifyBookingCode };
