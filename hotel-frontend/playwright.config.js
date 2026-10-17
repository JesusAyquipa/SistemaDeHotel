import { defineConfig, devices } from '@playwright/test';

/**
 * E2E (SHE-039). Se prueba el build de producción (`vite build` + `vite preview`).
 * TODA la API se simula con page.route (ver e2e/support/mockApi.js): no se necesita backend.
 * La URL de la API apunta a un host ficticio para que ninguna petición salga a la red.
 */
const PORT = 4173;
const API_ORIGIN = 'http://api.e2e.test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_API_BASE_URL: API_ORIGIN },
  },
});
