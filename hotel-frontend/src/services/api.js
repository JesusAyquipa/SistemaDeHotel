import axios from 'axios';
import { BACKEND_ORIGIN } from '../utils/assetUrl';

export const TOKEN_KEY = 'auth_token';

/**
 * Cliente HTTP de la API (autenticación por token Bearer de Sanctum, sin cookies).
 *
 * NOTA DE SEGURIDAD: el token se guarda en localStorage para simplificar la demo.
 * Esto lo expone ante cualquier XSS en el sitio; la alternativa más robusta sería
 * una cookie httpOnly + SameSite con el flujo SPA de Sanctum. Por eso:
 *  - no se usa dangerouslySetInnerHTML ni se renderiza HTML de terceros, y
 *  - ante un 401 el token se elimina inmediatamente.
 */
const api = axios.create({
  baseURL: `${BACKEND_ORIGIN}/api`,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // almacenamiento no disponible (modo privado, etc.)
  }
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Endpoints donde un 401 NO debe provocar redirección (se manejan en el propio flujo).
const NO_REDIRECT_ON_401 = ['/login', '/register', '/me', '/logout'];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      const url = error.config?.url || '';
      const path = url.split('?')[0];
      const hadToken = !!getStoredToken();
      setStoredToken(null);
      const skip = NO_REDIRECT_ON_401.some((p) => path === p || path.endsWith(p));
      if (!skip && hadToken && window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
