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

  test('recepcionista ve su caja cerrada en Hoy y puede abrirla', async ({ page }) => {
    let opened = false;
    const calls = await mockApi(page, {
      session: USERS.recepcionista,
      overrides: {
        'GET /staff/cash-sessions/current': () => ({
          body: opened
            ? { session: { id: 20, status: 'open', opened_at: '2030-05-10T08:00:00-05:00', opening_amount: '80.00' }, summary: { opening_amount: 80, cash_payments: 0, card_payments: 0, other_payments: 0, expected_cash: 80 } }
            : { session: null, summary: null },
        }),
        'POST /staff/cash-sessions/open': () => { opened = true; return { status: 201, body: { session: { id: 20, status: 'open' } } }; },
      },
    });
    await page.goto('/recepcionista/hoy');
    const widget = page.getByRole('region', { name: 'Mi caja' });
    await expect(widget.getByText(/No tienes una caja abierta/)).toBeVisible();
    await widget.getByRole('button', { name: /Abrir caja/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Abrir caja' });
    await dialog.getByLabel(/Monto inicial/).fill('80');
    await dialog.getByRole('button', { name: /Abrir caja/ }).click();
    await expect(widget.getByRole('button', { name: /Cerrar caja/ })).toBeVisible();
    const openCall = calls.find((c) => c.key === 'POST /staff/cash-sessions/open');
    expect(JSON.parse(openCall.body)).toMatchObject({ opening_amount: 80 });
  });

  test('admin revisa el historial de cajas y el detalle de pagos', async ({ page }) => {
    const calls = await mockApi(page, { session: USERS.admin });
    await page.goto('/admin/cajas');
    await expect(page.getByRole('heading', { level: 1, name: 'Historial de cajas' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cajas' }).first()).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('cell', { name: 'Recepción Demo', exact: true })).toBeVisible();
    await expect(page.getByText('Totales (2 cajas)')).toBeVisible();

    await page.getByRole('button', { name: /Ver detalle de la caja 12/ }).click();
    const drawer = page.getByRole('dialog', { name: 'Caja #12' });
    await expect(drawer.getByText('RES-E2EINH02')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    expect(calls.some((c) => c.key === 'GET /staff/cash-sessions/12')).toBe(true);
  });

  test('un recepcionista no puede entrar a la auditoría (redirige al inicio)', async ({ page }) => {
    await mockApi(page, { session: USERS.recepcionista });
    await page.goto('/admin/auditoria');
    await expect(page).toHaveURL(/\/$/);
  });
});
