import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

/**
 * Cliente de WebSockets (Laravel Reverb).
 *
 * Solo se conecta si VITE_REVERB_APP_KEY está definida. Si falta, `echo` es null
 * y los componentes deben comprobarlo antes de suscribirse (ver `isEchoEnabled`).
 */
const key = import.meta.env.VITE_REVERB_APP_KEY;

function createEcho() {
  if (!key) return null;
  try {
    window.Pusher = Pusher;
    const port = Number(import.meta.env.VITE_REVERB_PORT) || 8080;
    return new Echo({
      broadcaster: 'reverb',
      key,
      wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
      wsPort: port,
      wssPort: port,
      forceTLS: (import.meta.env.VITE_REVERB_SCHEME || 'https') === 'https',
      enabledTransports: ['ws', 'wss'],
    });
  } catch {
    return null;
  }
}

export const echo = createEcho();

export const isEchoEnabled = () => echo !== null;

export default echo;
