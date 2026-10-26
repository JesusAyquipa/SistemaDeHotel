import { test, expect } from '@playwright/test';
import { mockApi, USERS } from './support/mockApi.js';

test.describe('Flujo público de reserva', () => {
  test('inicio → habitaciones → detalle → abre el checkout', async ({ page }) => {
    const calls = await mockApi(page, { session: USERS.cliente });

    await page.goto('/');
    await page.getByRole('link', { name: 'Reservar Ahora' }).click();

    await expect(page).toHaveURL(/\/habitaciones$/);
    await expect(page.getByRole('heading', { name: 'Suite Presidencial Colonial' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Doble Clásica' })).toBeVisible();
    expect(calls.some((c) => c.key === 'GET /rooms/available')).toBe(true);

    await page.getByRole('link', { name: 'Ver detalle de Suite Presidencial Colonial' }).click();
    await expect(page).toHaveURL(/\/habitaciones\/101$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Suite Presidencial Colonial' })).toBeVisible();
    await expect(page.getByText('Wi-Fi de alta velocidad')).toBeVisible();

    await page.getByRole('button', { name: /Reservar ahora/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Continuar al Pago Seguro/ })).toBeVisible();

    // Validación del paso 0 sin tocar la API de pagos
    await dialog.getByRole('button', { name: /Continuar al Pago Seguro/ }).click();
    await expect(dialog.getByText('El nombre es obligatorio')).toBeVisible();
    expect(calls.some((c) => c.key === 'POST /payments/checkout-intent')).toBe(false);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('sin sesión se reserva como invitado verificando el correo con un código (SHE-026)', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/habitaciones/101');
    await expect(page.getByText(/Puedes reservar como invitado/)).toBeVisible();

    await page.getByRole('button', { name: /Reservar ahora/i }).click();
    await expect(page).toHaveURL(/\/habitaciones\/101$/);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Correo Electrónico *').fill('invitado@example.com');
    await dialog.getByRole('button', { name: 'Enviar código' }).click();
    expect(calls.some((c) => c.key === 'POST /booking-verification/send')).toBe(true);

    const code = dialog.getByLabel('Código de verificación');
    await code.fill('000000');
    await dialog.getByRole('button', { name: 'Verificar' }).click();
    await expect(dialog.getByText('Correo verificado')).toBeHidden();

    await code.fill('123456');
    await dialog.getByRole('button', { name: 'Verificar' }).click();
    await expect(dialog.getByText('Correo verificado')).toBeVisible();
  });
});
