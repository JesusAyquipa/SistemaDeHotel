import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProcessPaymentModal from '../components/staff/ProcessPaymentModal';
import { openCashSession } from '../services/cashSessionService';
import { isCashSessionRequiredError, expectedDeclaredTotal } from '../utils/cashSession';

vi.mock('../services/cashSessionService', () => ({
  getCurrentCashSession: vi.fn(),
  openCashSession: vi.fn(),
}));

const CASH_422 = { response: { status: 422, data: { message: 'Debes abrir caja antes de registrar cobros' } } };

function renderModal(props = {}) {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const onProcessPayment = vi.fn();
  render(
    <ProcessPaymentModal isOpen onClose={onClose} onProcessPayment={onProcessPayment} totalAmount={150} {...props} />,
  );
  return { user, onClose, onProcessPayment: props.onProcessPayment || onProcessPayment };
}

describe('utils/cashSession', () => {
  it('reconoce solo el 422 de caja requerida', () => {
    expect(isCashSessionRequiredError(CASH_422)).toBe(true);
    expect(isCashSessionRequiredError({ response: { status: 422, data: { message: 'El monto es obligatorio' } } })).toBe(false);
    expect(isCashSessionRequiredError({ response: { status: 500, data: { message: 'Debes abrir caja antes de registrar cobros' } } })).toBe(false);
    expect(isCashSessionRequiredError(new Error('network'))).toBe(false);
    expect(isCashSessionRequiredError(null)).toBe(false);
  });

  it('el total a declarar incluye otros medios y excluye pagos en línea', () => {
    expect(expectedDeclaredTotal(null)).toBe(0);
    expect(expectedDeclaredTotal({ expected_cash: '100.50', card_payments: 20, other_payments: '9.5', online_payments: 999 })).toBe(130);
    expect(expectedDeclaredTotal({ expected_cash: 10 })).toBe(10);
  });
});

describe('ProcessPaymentModal: cobro sin caja abierta', () => {
  beforeEach(() => {
    openCashSession.mockResolvedValue({ id: 3, status: 'open' });
  });

  it('muestra el aviso con la opción de abrir caja y permite reintentar el cobro', async () => {
    const onProcessPayment = vi.fn().mockRejectedValueOnce(CASH_422).mockResolvedValueOnce(undefined);
    const { user } = renderModal({ onProcessPayment });

    await user.click(screen.getByRole('button', { name: 'Confirmar Pago' }));
    expect(onProcessPayment).toHaveBeenCalledWith({ amount: 150, method: 'Efectivo' });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Debes abrir caja antes de registrar cobros');

    await user.click(within(alert).getByRole('button', { name: /Abrir caja/ }));
    const dialog = screen.getByRole('dialog', { name: 'Abrir caja' });
    await user.type(within(dialog).getByLabelText(/Monto inicial/), '50');
    await user.click(within(dialog).getByRole('button', { name: /Abrir caja/ }));

    expect(openCashSession).toHaveBeenCalledWith({ opening_amount: 50, notes: undefined });
    // El submit del modal de caja no dispara el formulario de cobro de fondo
    expect(onProcessPayment).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('status')).toHaveTextContent('Caja abierta');
    expect(screen.queryByRole('dialog', { name: 'Abrir caja' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Debes abrir caja/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirmar Pago' }));
    expect(onProcessPayment).toHaveBeenCalledTimes(2);
  });

  it('Escape en el modal de caja cierra solo ese modal', async () => {
    const onProcessPayment = vi.fn().mockRejectedValueOnce(CASH_422);
    const { user, onClose } = renderModal({ onProcessPayment });
    await user.click(screen.getByRole('button', { name: 'Confirmar Pago' }));
    await user.click(within(await screen.findByRole('alert')).getByRole('button', { name: /Abrir caja/ }));
    expect(screen.getByRole('dialog', { name: 'Abrir caja' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Abrir caja' })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /Procesar Pago/ })).toBeInTheDocument();
  });

  it('otros errores muestran un mensaje sin ofrecer abrir caja', async () => {
    const onProcessPayment = vi.fn().mockRejectedValueOnce({ response: { status: 500, data: {} } });
    const { user } = renderModal({ onProcessPayment });
    await user.click(screen.getByRole('button', { name: 'Confirmar Pago' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo registrar el pago');
    expect(screen.queryByRole('button', { name: /Abrir caja/ })).not.toBeInTheDocument();
  });

  it('deshabilita el botón mientras procesa (sin doble cobro)', async () => {
    let resolve;
    const onProcessPayment = vi.fn(() => new Promise((r) => { resolve = r; }));
    const { user } = renderModal({ onProcessPayment });
    await user.click(screen.getByRole('button', { name: 'Confirmar Pago' }));
    const busyBtn = screen.getByRole('button', { name: /Procesando/ });
    expect(busyBtn).toBeDisabled();
    await user.click(busyBtn);
    expect(onProcessPayment).toHaveBeenCalledTimes(1);
    resolve();
    expect(await screen.findByRole('button', { name: 'Confirmar Pago' })).toBeEnabled();
  });
});
