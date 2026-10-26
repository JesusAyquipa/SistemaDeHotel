import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CashSessionWidget from '../components/staff/CashSessionWidget';
import { AuthContext } from '../context/AuthContext';
import { getCurrentCashSession, openCashSession } from '../services/cashSessionService';
import { closeRegister } from '../services/reportService';

vi.mock('../services/cashSessionService', () => ({
  getCurrentCashSession: vi.fn(),
  openCashSession: vi.fn(),
}));
vi.mock('../services/reportService', () => ({
  closeRegister: vi.fn(),
}));

const RECEPTION = { user: { id: 2, name: 'Recepción', roles: ['recepcionista'] }, loading: false };
const normalize = (s) => s.replace(/\s/g, ' ');

const OPEN_SESSION = {
  session: { id: 9, status: 'open', opened_at: '2030-05-10T08:00:00-05:00', opening_amount: '100.00' },
  summary: { opening_amount: 100, cash_payments: 250.5, card_payments: 300, other_payments: 0, expected_cash: 350.5 },
};

function renderWidget({ auth = RECEPTION, ...props } = {}) {
  const user = userEvent.setup();
  render(
    <AuthContext.Provider value={auth}>
      <CashSessionWidget {...props} />
    </AuthContext.Provider>,
  );
  return { user };
}

describe('CashSessionWidget (SHE-014)', () => {
  beforeEach(() => {
    getCurrentCashSession.mockResolvedValue({ session: null, summary: null });
  });

  it('no se muestra a usuarios sin rol de personal', () => {
    const { container } = render(
      <AuthContext.Provider value={{ user: { id: 3, roles: ['cliente'] }, loading: false }}>
        <CashSessionWidget />
      </AuthContext.Provider>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(getCurrentCashSession).not.toHaveBeenCalled();
  });

  it('sin caja abierta ofrece abrirla y valida el monto inicial', async () => {
    openCashSession.mockResolvedValue({ id: 10, status: 'open' });
    const onNotify = vi.fn();
    const { user } = renderWidget({ onNotify });

    const openBtn = await screen.findByRole('button', { name: /Abrir caja/ });
    expect(screen.getByText(/No tienes una caja abierta/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cerrar caja/ })).not.toBeInTheDocument();

    await user.click(openBtn);
    const dialog = screen.getByRole('dialog', { name: 'Abrir caja' });
    const amount = within(dialog).getByLabelText(/Monto inicial/);
    expect(amount).toHaveFocus();

    // Monto vacío: no llama a la API
    await user.click(within(dialog).getByRole('button', { name: /Abrir caja/ }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/monto inicial válido/);
    expect(openCashSession).not.toHaveBeenCalled();

    getCurrentCashSession.mockResolvedValue(OPEN_SESSION);
    await user.type(amount, '100');
    await user.type(within(dialog).getByLabelText(/Notas/), 'Turno mañana');
    await user.click(within(dialog).getByRole('button', { name: /Abrir caja/ }));

    expect(openCashSession).toHaveBeenCalledWith({ opening_amount: 100, notes: 'Turno mañana' });
    expect(onNotify).toHaveBeenCalledWith(expect.stringMatching(/Caja abierta/), 'success');
    expect(await screen.findByRole('button', { name: /Cerrar caja/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('muestra el aviso si el usuario ya tiene una caja abierta (409)', async () => {
    openCashSession.mockRejectedValue({ response: { status: 409, data: { message: 'Ya tienes una caja abierta' } } });
    const { user } = renderWidget({ onNotify: vi.fn() });
    await user.click(await screen.findByRole('button', { name: /Abrir caja/ }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Monto inicial/), '50');
    await user.click(within(dialog).getByRole('button', { name: /Abrir caja/ }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Ya tienes una caja abierta.');
  });

  it('con caja abierta muestra fondo y efectivo esperado', async () => {
    getCurrentCashSession.mockResolvedValue(OPEN_SESSION);
    renderWidget();
    expect(await screen.findByRole('button', { name: /Cerrar caja/ })).toBeInTheDocument();
    expect(screen.getByText('Abierta')).toBeInTheDocument();
    expect(normalize(screen.getByTestId('expected-cash').textContent)).toBe('S/ 350.50');
    expect(normalize(screen.getByText('Fondo inicial').nextSibling.textContent)).toBe('S/ 100.00');
    expect(screen.queryByRole('button', { name: /^Abrir caja/ })).not.toBeInTheDocument();
  });

  it('cierra la caja con el modal existente y recarga el estado', async () => {
    getCurrentCashSession.mockResolvedValueOnce(OPEN_SESSION).mockResolvedValue({ session: null, summary: null });
    closeRegister.mockResolvedValue({ message: 'ok', session: { id: 9, status: 'closed' } });
    const onClosed = vi.fn();
    const onNotify = vi.fn();
    const { user } = renderWidget({ onClosed, onNotify });

    await user.click(await screen.findByRole('button', { name: /Cerrar caja/ }));
    const dialog = screen.getByRole('dialog');
    // Resumen de la sesión: total esperado = efectivo esperado + vouchers
    expect(within(dialog).getByText('Cobros con Tarjeta / Vouchers')).toBeInTheDocument();
    expect(normalize(within(dialog).getByText('Total Esperado').nextSibling.textContent)).toBe('S/ 650.50');

    await user.type(within(dialog).getByLabelText('Efectivo en Gaveta'), '350.5');
    await user.type(within(dialog).getByLabelText(/Total en Vouchers/), '300');
    expect(within(dialog).getByText(/Cuadre Perfecto/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Confirmar Cierre de Caja/ }));

    expect(closeRegister).toHaveBeenCalledWith({ cash_amount: 350.5, voucher_amount: 300, counted_amount: 650.5 });
    expect(onClosed).toHaveBeenCalled();
    expect(onNotify).toHaveBeenCalledWith('Cierre de caja registrado.', 'success');
    expect(await screen.findByRole('button', { name: /Abrir caja/ })).toBeInTheDocument();
  });

  it('muestra el mensaje 422 si se intenta cerrar sin caja abierta', async () => {
    getCurrentCashSession.mockResolvedValue(OPEN_SESSION);
    closeRegister.mockRejectedValue({ response: { status: 422, data: { message: 'Debes abrir caja antes de cerrarla' } } });
    const { user } = renderWidget({ onNotify: vi.fn() });
    await user.click(await screen.findByRole('button', { name: /Cerrar caja/ }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Efectivo en Gaveta'), '1');
    await user.type(within(dialog).getByLabelText(/Total en Vouchers/), '0');
    await user.click(within(dialog).getByRole('button', { name: /Confirmar Cierre de Caja/ }));
    expect(await within(dialog).findByText('Debes abrir caja antes de cerrarla')).toBeInTheDocument();
  });

  it('el total a declarar suma efectivo, tarjeta y otros medios; los pagos en línea son informativos', async () => {
    getCurrentCashSession.mockResolvedValue({
      session: OPEN_SESSION.session,
      summary: { ...OPEN_SESSION.summary, other_payments: 49.5, online_payments: 1200 },
    });
    const { user } = renderWidget({ onNotify: vi.fn() });
    await screen.findByRole('button', { name: /Cerrar caja/ });
    // 350.50 + 300 + 49.50
    expect(normalize(screen.getByTestId('expected-total').textContent)).toBe('S/ 700.00');
    expect(normalize(screen.getByText('Otros medios').nextSibling.textContent)).toBe('S/ 49.50');
    const online = screen.getByTestId('online-payments');
    expect(online).toHaveTextContent('Pagos en línea (no van a caja)');
    expect(normalize(online.textContent)).toContain('S/ 1,200.00');

    await user.click(screen.getByRole('button', { name: /Cerrar caja/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/no se declaran/i)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Otros Medios/)).toBeInTheDocument();
    expect(normalize(within(dialog).getByText('Total Esperado').nextSibling.textContent)).toBe('S/ 700.00');
    expect(within(dialog).getByText('Pagos en línea (no van a caja)')).toBeInTheDocument();
  });

  it('error al consultar la caja: mensaje genérico y reintento', async () => {
    getCurrentCashSession.mockRejectedValueOnce({ response: { status: 500, data: { message: 'stack trace' } } });
    const { user } = renderWidget();
    expect(await screen.findByText('No se pudo consultar el estado de tu caja.')).toBeInTheDocument();
    expect(screen.queryByText('stack trace')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: /Abrir caja/ })).toBeInTheDocument();
    expect(getCurrentCashSession).toHaveBeenCalledTimes(2);
  });
});
