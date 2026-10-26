import { apiStatus } from './apiError';

/** Mensaje del backend cuando el personal cobra sin una caja abierta (422). */
export const CASH_SESSION_REQUIRED_MESSAGE = 'Debes abrir caja antes de registrar cobros';

const CASH_SESSION_REQUIRED_RE = /abrir caja antes de registrar cobros/i;

/**
 * true si el error es el 422 "Debes abrir caja antes de registrar cobros".
 * Se compara el mensaje para no confundirlo con otros 422 de validación.
 */
export function isCashSessionRequiredError(err) {
  if (apiStatus(err) !== 422) return false;
  const message = err?.response?.data?.message;
  return typeof message === 'string' && CASH_SESSION_REQUIRED_RE.test(message);
}

/**
 * Total que debe declararse al cerrar la caja: efectivo esperado (fondo + cobros en
 * efectivo) + tarjeta/vouchers + otros medios. Coincide con closure.expected_amount del
 * servidor. Los pagos en línea (online_payments) no van a caja y no se suman.
 */
export function expectedDeclaredTotal(summary) {
  if (!summary) return 0;
  return (Number(summary.expected_cash) || 0)
    + (Number(summary.card_payments) || 0)
    + (Number(summary.other_payments) || 0);
}
