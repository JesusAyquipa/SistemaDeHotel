import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const fixture = (name) => JSON.parse(readFileSync(join(here, '..', 'fixtures', `${name}.json`), 'utf-8'));

export const API_ORIGIN = 'http://api.e2e.test';
const TOKEN_KEY = 'auth_token';

export const USERS = {
  cliente: { id: 30, name: 'Lucía', surname: 'Ramírez', email: 'lucia@example.com', roles: ['cliente'] },
  recepcionista: { id: 2, name: 'Recepción', surname: 'Demo', email: 'recepcion@hotel.com', roles: ['recepcionista'] },
  admin: { id: 1, name: 'Admin', surname: 'Demo', email: 'admin@hotel.com', roles: ['admin'] },
};

const POLICY = { free_cancellation_hours: 48, late_cancellation_penalty_nights: 1, no_show_penalty_nights: 1, no_show_grace_hours: 2 };

/**
 * Simula TODA la API con page.route. `session` = usuario devuelto por /me (null = sin sesión).
 * `overrides` permite agregar o reemplazar respuestas: { 'GET /ruta': body | (req) => ({status, body}) }.
 * Devuelve la lista de peticiones recibidas (para aserciones).
 */
export async function mockApi(page, { session = null, overrides = {} } = {}) {
  const calls = [];
  let currentUser = session;

  const rooms = fixture('rooms');
  const frontDesk = fixture('front-desk');
  const cashSessions = fixture('cash-sessions');

  const routes = {
    'GET /ping': { message: 'pong' },
    'GET /rooms/available': rooms,
    'GET /room-types': { room_types: [{ id: 1, name: 'Suite', slug: 'suite' }, { id: 2, name: 'Doble', slug: 'doble' }] },
    'GET /settings/cancellation-policy': POLICY,
    'GET /settings': { hotel: { name: 'Hotel E2E' } },
    'GET /staff/front-desk/today': frontDesk.today,
    'GET /staff/front-desk/rack': frontDesk.rack,
    'GET /staff/activity-logs': fixture('activity-logs'),
    // SHE-014 / SHE-015: cajas
    'GET /staff/cash-sessions/current': cashSessions.current,
    'GET /staff/cash-sessions': cashSessions.list,
    'GET /staff': { data: [USERS.admin, USERS.recepcionista] },
    // SHE-026: verificación de correo para reservas sin cuenta
    'POST /booking-verification/send': { message: 'Si el correo es válido, enviamos un código' },
    'POST /booking-verification/verify': (req) => {
      const { code } = req.postDataJSON() || {};
      return code === '123456'
        ? { body: { verification_token: 'e2e'.padEnd(64, '0'), expires_at: '2030-01-01T00:30:00Z' } }
        : { status: 422, body: { message: 'Código inválido o vencido' } };
    },
    'POST /logout': { message: 'ok' },
    'POST /login': (req) => {
      const { email } = req.postDataJSON() || {};
      const user = Object.values(USERS).find((u) => u.email === email);
      if (!user) return { status: 422, body: { message: 'Credenciales incorrectas', errors: { email: ['Credenciales incorrectas'] } } };
      currentUser = user;
      return { body: { access_token: `e2e-token-${user.roles[0]}`, token_type: 'Bearer', user } };
    },
    'GET /me': () => (currentUser ? { body: { user: currentUser } } : { status: 401, body: { message: 'Unauthenticated.' } }),
    ...overrides,
  };

  const dynamic = [
    [/^GET \/rooms\/\d+\/booked-dates$/, { booked_dates: [] }],
    [/^GET \/rooms\/\d+\/reviews$/, { data: [], summary: { count: 0, average: null }, meta: { current_page: 1, last_page: 1, total: 0 } }],
    [/^GET \/rooms\/\d+$/, fixture('room-detail')],
    [/^GET \/staff\/cash-sessions\/\d+$/, cashSessions.detail],
  ];

  if (session) {
    await page.addInitScript(([key, token]) => {
      try { window.localStorage.setItem(key, token); } catch { /* noop */ }
    }, [TOKEN_KEY, `e2e-token-${session.roles[0]}`]);
  }

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.origin === API_ORIGIN && url.pathname.startsWith('/api/')) {
      const path = url.pathname.slice(4);
      const key = `${request.method()} ${path}`;
      calls.push({ key, search: url.search, body: request.postData() });

      let handler = routes[key];
      if (handler === undefined) handler = dynamic.find(([re]) => re.test(key))?.[1];
      if (handler === undefined) {
        // Endpoint no previsto: respuesta vacía pero válida para no romper la pantalla.
        handler = request.method() === 'GET' ? { data: [] } : { message: 'ok' };
      }
      const result = typeof handler === 'function' ? handler(request) : { body: handler };
      await route.fulfill({
        status: result.status ?? 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(result.body ?? {}),
      });
      return;
    }

    // Sin red externa: fuentes de Google, imágenes de Unsplash, websockets, etc.
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      await route.abort();
      return;
    }
    await route.continue();
  });

  return calls;
}
