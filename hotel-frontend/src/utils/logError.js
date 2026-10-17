/**
 * Registro de errores seguro.
 *
 * Nunca imprime el objeto de error de axios completo: `err.config.data` puede
 * contener datos sensibles (números de tarjeta, CVC, contraseñas, tokens).
 * En desarrollo solo se muestra el código HTTP y un mensaje; en producción no
 * se registra nada en la consola.
 */
export default function logError(context, err) {
  if (!import.meta.env.DEV) return;
  const status = err?.response?.status ?? 'sin respuesta';
  console.warn(`[${context}] HTTP ${status}`);
}

export { logError };
