/**
 * Extrae un mensaje legible de un error de axios ({ message } según el contrato de la API).
 */
export function apiErrorMessage(err, fallback = 'Ocurrió un error inesperado.') {
  const data = err?.response?.data;
  if (data?.message && typeof data.message === 'string') return data.message;
  if (data?.error && typeof data.error === 'string') return data.error;
  if (err && !err.response) return 'No se pudo conectar con el servidor. Verifique su conexión.';
  return fallback;
}

export function apiStatus(err) {
  return err?.response?.status ?? null;
}
