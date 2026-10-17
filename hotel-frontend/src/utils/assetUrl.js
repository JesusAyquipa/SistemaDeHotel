/**
 * Resuelve rutas relativas del backend (ej. "/storage/profiles/x.jpg") contra la URL
 * del servidor definida en VITE_API_BASE_URL. Las URLs absolutas (http/https/data/blob)
 * se devuelven sin cambios.
 */
function getBackendOrigin() {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (raw) {
    return raw.replace(/\/+$/, '').replace(/\/api$/, '');
  }
  // Solo en desarrollo se asume el backend local por defecto.
  return import.meta.env.DEV ? 'http://localhost:8000' : '';
}

export const BACKEND_ORIGIN = getBackendOrigin();

export default function assetUrl(path) {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${BACKEND_ORIGIN}${normalized}`;
}
