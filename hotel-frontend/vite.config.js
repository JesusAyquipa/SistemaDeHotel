/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
    // No se usa `allowedHosts: true` (desactiva la protección contra DNS rebinding).
    // Si se accede al servidor de desarrollo por otro host, agréguelo aquí explícitamente.
    allowedHosts: ['localhost', '127.0.0.1', 'frontend'],
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  // Pruebas unitarias / de componentes (SHE-039). Las E2E (Playwright) viven en e2e/.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
    restoreMocks: true,
  },
})
