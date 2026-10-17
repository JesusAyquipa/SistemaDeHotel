import { test, expect } from '@playwright/test';
import { mockApi, USERS } from './support/mockApi.js';

test.describe('Personal del hotel', () => {
  test('recepcionista inicia sesión, aterriza en Hoy y abre el Rack', async ({ page }) => {
    const calls = await mockApi(page);

    await page.goto('/login');
    await page.getByLabel('Correo Electrónico *').fill(USERS.recepcionista.email);
    await page.getByLabel('Contraseña *').fill('secreto-demo');
    await page.getByRole('button', { name: /Iniciar Sesión/ }).click();

    await expect(page).toHaveURL(/\/recepcionista\/hoy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Hoy' })).toBeVisible();
    await expect(page.getByText('RES-E2EARR01').first()).toBeVisible();
    expect(calls.filter((c) => c.key === 'POST /login')).toHaveLength(1);

    await page.getByRole('link', { name: 'Rack' }).first().click();
    await expect(page).toHaveURL(/\/recepcionista\/rack$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Rack de ocupación' })).toBeVisible();
    await expect(page.getByText('501').first()).toBeVisible();
    expect(calls.some((c) => c.key === 'GET /staff/front-desk/rack')).toBe(true);
  });

  test('credenciales inválidas muestran el error y no navegan', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');
    await page.getByLabel('Correo Electrónico *').fill('nadie@hotel.com');
    await page.getByLabel('Contraseña *').fill('clave-incorrecta');
    await page.getByRole('button', { name: /Iniciar Sesión/ }).click();
    await expect(page.getByText('Credenciales incorrectas')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('admin abre la bitácora de auditoría', async ({ page }) => {
    const calls = await mockApi(page, { session: USERS.admin });
    await page.goto('/admin/auditoria');
    await expect(page.getByRole('heading', { level: 1, name: 'Bitácora de Auditoría' })).toBeVisible();
    await expect(page.getByText('Check-in de la reserva RES-E2EINH02')).toBeVisible();
    expect(calls.some((c) => c.key === 'GET /staff/activity-logs')).toBe(true);
  });

  test('un recepcionista no puede entrar a la auditoría (redirige al inicio)', async ({ page }) => {
    await mockApi(page, { session: USERS.recepcionista });
    await page.goto('/admin/auditoria');
    await expect(page).toHaveURL(/\/$/);
  });
});
