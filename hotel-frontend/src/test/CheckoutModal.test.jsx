import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckoutModal from '../components/CheckoutModal';
import { AuthContext } from '../context/AuthContext';
import { createCheckoutIntent, processMockPayment } from '../services/paymentService';
import { sendBookingVerificationCode, verifyBookingCode } from '../services/bookingVerificationService';

vi.mock('../services/paymentService', () => ({
  createCheckoutIntent: vi.fn(),
  processMockPayment: vi.fn(),
}));
vi.mock('../services/bookingVerificationService', () => ({
  sendBookingVerificationCode: vi.fn(),
  verifyBookingCode: vi.fn(),
}));
vi.mock('../services/rooms', () => ({
  getRoomBookedDates: vi.fn().mockResolvedValue([]),
}));
vi.mock('../hooks/useCancellationPolicy', async () => {
  const { DEFAULT_CANCELLATION_POLICY } = await import('../utils/cancellationPolicy');
  return { default: () => ({ policy: DEFAULT_CANCELLATION_POLICY, loaded: true }) };
});

const room = {
  id: 7,
  room_number: '301',
  type: 'suite',
  price_per_night: 250,
  capacity: 2,
  image_url: null,
};

function futureYm() {
  const d = new Date();
  return `12/${String((d.getFullYear() + 3) % 100).padStart(2, '0')}`;
}

const LOGGED_IN = { user: { id: 30, name: 'Lucía', roles: ['cliente'] }, loading: false };
const ANONYMOUS = { user: null, loading: false };
const TOKEN = 't'.repeat(64);

/** auth: valor del AuthContext (por defecto, cliente con sesión iniciada). */
function renderModal(props = {}, { auth = LOGGED_IN, userOptions } = {}) {
  const onClose = vi.fn();
  const onPaymentSuccess = vi.fn();
  const user = userEvent.setup(userOptions);
  render(
    <AuthContext.Provider value={auth}>
      <CheckoutModal
        room={room}
        initialDates={{ check_in: '2030-05-10', check_out: '2030-05-12' }}
        onClose={onClose}
        onPaymentSuccess={onPaymentSuccess}
        {...props}
      />
    </AuthContext.Provider>,
  );
  return { user, onClose, onPaymentSuccess };
}

async function verifyEmail(user) {
  await user.click(screen.getByRole('button', { name: 'Enviar código' }));
  await user.type(await screen.findByLabelText('Código de verificación'), '123456');
  await user.click(screen.getByRole('button', { name: 'Verificar' }));
  await screen.findByText('Correo verificado');
}

async function fillGuest(user) {
  await user.type(screen.getByLabelText('Nombres *'), 'Lucía');
  await user.type(screen.getByLabelText('Apellidos *'), 'Ramírez');
  await user.type(screen.getByLabelText('N° de Documento *'), '45678912');
  await user.type(screen.getByLabelText('Correo Electrónico *'), 'lucia@example.com');
}

describe('CheckoutModal', () => {
  beforeEach(() => {
    createCheckoutIntent.mockResolvedValue({ booking_code: 'RES-TEST1234', expires_at: null });
    processMockPayment.mockResolvedValue({ success: true, receipt_number: 'REC-1' });
  });

  it('paso 0: valida los datos del huésped antes de crear la reserva', async () => {
    const { user } = renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Continuar al Pago Seguro/ }));
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('Los apellidos son obligatorios')).toBeInTheDocument();
    expect(screen.getByText('El correo electrónico es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('El número de documento es obligatorio')).toBeInTheDocument();
    expect(createCheckoutIntent).not.toHaveBeenCalled();
  });

  it('paso 0: rechaza DNI y correo con formato inválido', async () => {
    const { user } = renderModal();
    await user.type(screen.getByLabelText('Nombres *'), 'Lucía');
    await user.type(screen.getByLabelText('Apellidos *'), 'Ramírez');
    await user.type(screen.getByLabelText('N° de Documento *'), '123');
    await user.type(screen.getByLabelText('Correo Electrónico *'), 'lucia@');
    await user.click(screen.getByRole('button', { name: /Continuar al Pago Seguro/ }));
    expect(screen.getByText('El DNI debe tener 8 dígitos numéricos')).toBeInTheDocument();
    expect(screen.getByText('Ingrese un correo electrónico válido')).toBeInTheDocument();
    expect(createCheckoutIntent).not.toHaveBeenCalled();
  });

  it('flujo completo: crea el intent, valida la tarjeta y confirma el pago', async () => {
    const { user } = renderModal();
    await fillGuest(user);
    await user.click(screen.getByRole('button', { name: /Continuar al Pago Seguro/ }));

    expect(createCheckoutIntent).toHaveBeenCalledWith(expect.objectContaining({
      room_id: 7,
      check_in: '2030-05-10',
      check_out: '2030-05-12',
      guest_name: 'Lucía',
      guest_email: 'lucia@example.com',
      document_number: '45678912',
      coupon_code: null,
    }));

    // Paso 1: tarjeta
    const cardInput = await screen.findByLabelText(/Número de Tarjeta/);
    const payButton = screen.getByRole('button', { name: /^Pagar/ });
    expect(payButton).toHaveTextContent('500.00');

    await user.click(payButton);
    expect(screen.getByText(/Ingrese un número de tarjeta válido/)).toBeInTheDocument();
    expect(processMockPayment).not.toHaveBeenCalled();

    await user.type(cardInput, '4242424242424242');
    expect(cardInput).toHaveValue('4242 4242 4242 4242');
    await user.type(screen.getByLabelText(/Nombre del Titular/), 'Lucia Ramirez');
    await user.type(screen.getByLabelText(/Expiración|Vencimiento|MM\/YY/i), futureYm().replace('/', ''));
    await user.type(screen.getByLabelText(/CVC|CVV/i), '123');
    await user.click(screen.getByRole('button', { name: /^Pagar/ }));

    expect(processMockPayment).toHaveBeenCalledWith({
      booking_code: 'RES-TEST1234',
      card_number: '4242424242424242',
      card_expiry: futureYm(),
      card_cvc: '123',
      card_holder: 'Lucia Ramirez',
    });
    expect(await screen.findByText('¡Pago Confirmado!')).toBeInTheDocument();
    expect(screen.getByText('RES-TEST1234')).toBeInTheDocument();
  });

  it('muestra el error de la API y permanece en el paso 0', async () => {
    createCheckoutIntent.mockRejectedValueOnce({ response: { status: 422, data: { message: 'No es posible procesar la reserva' } } });
    const { user } = renderModal();
    await fillGuest(user);
    await user.click(screen.getByRole('button', { name: /Continuar al Pago Seguro/ }));
    expect(await screen.findByText('No es posible procesar la reserva')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Número de Tarjeta/)).not.toBeInTheDocument();
  });

  it('Escape cierra el modal', async () => {
    const { user, onClose } = renderModal();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('con sesión iniciada no pide verificar el correo ni envía token', async () => {
    const { user } = renderModal();
    expect(screen.queryByRole('button', { name: /Enviar código/ })).not.toBeInTheDocument();
    await fillGuest(user);
    await user.click(screen.getByRole('button', { name: /Continuar al Pago Seguro/ }));
    expect(createCheckoutIntent).toHaveBeenCalledTimes(1);
    expect(createCheckoutIntent.mock.calls[0][0]).not.toHaveProperty('verification_token');
  });
});

describe('CheckoutModal: verificación de correo sin sesión (SHE-026)', () => {
  beforeEach(() => {
    createCheckoutIntent.mockResolvedValue({ booking_code: 'RES-ANON0001', expires_at: null });
    sendBookingVerificationCode.mockResolvedValue({ message: 'Si el correo es válido, enviamos un código' });
    verifyBookingCode.mockResolvedValue({ verification_token: TOKEN, expires_at: '2030-01-01T00:30:00Z' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bloquea el paso siguiente hasta verificar el correo', async () => {
    const { user } = renderModal({}, { auth: ANONYMOUS });
    const continueBtn = screen.getByRole('button', { name: /Continuar al Pago Seguro/ });
    expect(continueBtn).toBeDisabled();
    expect(screen.getByText('Verifica tu correo para continuar.')).toBeInTheDocument();

    // Sin un correo válido no se puede pedir el código
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeDisabled();
    await fillGuest(user);
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeEnabled();
    expect(continueBtn).toBeDisabled();
    expect(createCheckoutIntent).not.toHaveBeenCalled();
  });

  it('envía el código, lo verifica y manda el token en el checkout-intent', async () => {
    const { user } = renderModal({}, { auth: ANONYMOUS });
    await fillGuest(user);
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    expect(sendBookingVerificationCode).toHaveBeenCalledWith('lucia@example.com');

    const codeInput = await screen.findByLabelText('Código de verificación');
    expect(codeInput).toHaveAttribute('inputmode', 'numeric');
    expect(codeInput).toHaveAttribute('autocomplete', 'one-time-code');
    await user.type(codeInput, '12a34567');
    expect(codeInput).toHaveValue('123456');

    await user.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(verifyBookingCode).toHaveBeenCalledWith('lucia@example.com', '123456');
    expect(await screen.findByText('Correo verificado')).toBeInTheDocument();

    const continueBtn = screen.getByRole('button', { name: /Continuar al Pago Seguro/ });
    expect(continueBtn).toBeEnabled();
    await user.click(continueBtn);
    expect(createCheckoutIntent).toHaveBeenCalledWith(expect.objectContaining({
      guest_email: 'lucia@example.com',
      verification_token: TOKEN,
    }));
    expect(await screen.findByLabelText(/Número de Tarjeta/)).toBeInTheDocument();
  });

  it('muestra un mensaje genérico si el código es inválido y no avanza', async () => {
    verifyBookingCode.mockRejectedValueOnce({ response: { status: 422, data: { message: 'SQLSTATE detalle interno' } } });
    const { user } = renderModal({}, { auth: ANONYMOUS });
    await fillGuest(user);
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    await user.type(await screen.findByLabelText('Código de verificación'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verificar' }));

    expect(await screen.findByText(/Código inválido o vencido/)).toBeInTheDocument();
    expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument();
    expect(screen.queryByText('Correo verificado')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar al Pago Seguro/ })).toBeDisabled();
  });

  it('cambiar el correo invalida la verificación', async () => {
    const { user } = renderModal({}, { auth: ANONYMOUS });
    await fillGuest(user);
    await verifyEmail(user);

    await user.type(screen.getByLabelText('Correo Electrónico *'), 'x');
    expect(screen.queryByText('Correo verificado')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar al Pago Seguro/ })).toBeDisabled();
  });

  it('permite reenviar el código solo tras la cuenta regresiva de 60 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = renderModal({}, { auth: ANONYMOUS, userOptions: { advanceTimers: vi.advanceTimersByTime } });
    await fillGuest(user);
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));

    const resend = await screen.findByRole('button', { name: /Reenviar código \(\d+ s\)/ });
    expect(resend).toBeDisabled();

    for (let i = 0; i < 61; i += 1) {
      // Cada segundo programa el siguiente tick de la cuenta regresiva
      await act(async () => { vi.advanceTimersByTime(1000); });
    }
    const ready = screen.getByRole('button', { name: 'Reenviar código' });
    expect(ready).toBeEnabled();
    await user.click(ready);
    expect(sendBookingVerificationCode).toHaveBeenCalledTimes(2);
  });

  it('si la API exige verificación (422) vuelve a pedir el código', async () => {
    createCheckoutIntent.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Verifica tu correo para continuar', requires_verification: true } } });
    const { user } = renderModal({}, { auth: ANONYMOUS });
    await fillGuest(user);
    await verifyEmail(user);
    await user.click(screen.getByRole('button', { name: /Continuar al Pago Seguro/ }));

    expect(await screen.findByRole('button', { name: 'Enviar código' })).toBeEnabled();
    expect(screen.queryByText('Correo verificado')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar al Pago Seguro/ })).toBeDisabled();
  });

  it('con sesión local, si la API exige verificación (422) fuerza el código y conserva los datos', async () => {
    createCheckoutIntent
      .mockRejectedValueOnce({ response: { status: 422, data: { message: 'Verifica tu correo para continuar', requires_verification: true } } })
      .mockResolvedValueOnce({ booking_code: 'RES-FORCED01', expires_at: null });
    const { user } = renderModal({}, { auth: LOGGED_IN });
    expect(screen.queryByRole('button', { name: 'Enviar código' })).not.toBeInTheDocument();
    await fillGuest(user);
    await user.click(screen.getByRole('button', { name: /Continuar al Pago Seguro/ }));

    // Aparece el paso del código aunque exista auth.user, y los datos ingresados siguen ahí
    expect(await screen.findByRole('button', { name: 'Enviar código' })).toBeEnabled();
    expect(screen.getByText(/Para continuar, confirmaremos que el correo es tuyo/)).toBeInTheDocument();
    expect(screen.getByLabelText('Nombres *')).toHaveValue('Lucía');
    expect(screen.getByLabelText('Correo Electrónico *')).toHaveValue('lucia@example.com');
    expect(screen.getByRole('button', { name: /Continuar al Pago Seguro/ })).toBeDisabled();

    await verifyEmail(user);
    await user.click(screen.getByRole('button', { name: /Continuar al Pago Seguro/ }));
    expect(createCheckoutIntent).toHaveBeenLastCalledWith(expect.objectContaining({
      guest_name: 'Lucía',
      verification_token: TOKEN,
    }));
    expect(await screen.findByLabelText(/Número de Tarjeta/)).toBeInTheDocument();
  });

  it('tras consumir el token, si cambian los datos bloquea continuar hasta verificar de nuevo', async () => {
    const { user } = renderModal({}, { auth: ANONYMOUS });
    await fillGuest(user);
    await verifyEmail(user);
    await user.click(screen.getByRole('button', { name: /Continuar al Pago Seguro/ }));
    await screen.findByLabelText(/Número de Tarjeta/);
    expect(createCheckoutIntent).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Volver/ }));
    // Mismos datos: se reutiliza la reserva pendiente, el botón sigue habilitado
    expect(screen.getByRole('button', { name: /Continuar al Pago Seguro/ })).toBeEnabled();

    await user.type(screen.getByLabelText('Apellidos *'), 'z');
    expect(screen.getByRole('button', { name: /Continuar al Pago Seguro/ })).toBeDisabled();
    expect(screen.getByText(/El código anterior ya se usó/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^(Reenviar|Enviar) código/ })).toBeInTheDocument();
    expect(screen.queryByText('Correo verificado')).not.toBeInTheDocument();

    // Al volver a los datos originales, la reserva pendiente vuelve a ser reutilizable
    await user.type(screen.getByLabelText('Apellidos *'), '{Backspace}');
    expect(screen.getByRole('button', { name: /Continuar al Pago Seguro/ })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /Continuar al Pago Seguro/ }));
    expect(await screen.findByLabelText(/Número de Tarjeta/)).toBeInTheDocument();
    expect(createCheckoutIntent).toHaveBeenCalledTimes(1);
  });

  it('si la reserva pendiente expira tras usar el token, exige verificar otra vez', async () => {
    processMockPayment.mockRejectedValueOnce({ response: { status: 410, data: { message: 'La reserva temporal expiró.' } } });
    const { user } = renderModal({}, { auth: ANONYMOUS });
    await fillGuest(user);
    await verifyEmail(user);
    await user.click(screen.getByRole('button', { name: /Continuar al Pago Seguro/ }));
    await user.type(await screen.findByLabelText(/Número de Tarjeta/), '4242424242424242');
    await user.type(screen.getByLabelText(/Nombre del Titular/), 'Lucia Ramirez');
    await user.type(screen.getByLabelText(/Expiración|Vencimiento|MM\/YY/i), futureYm().replace('/', ''));
    await user.type(screen.getByLabelText(/CVC|CVV/i), '123');
    await user.click(screen.getByRole('button', { name: /^Pagar/ }));

    expect(await screen.findByText(/Vuelva al paso anterior/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar al Pago Seguro/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^(Reenviar|Enviar) código/ })).toBeInTheDocument();
  });
});
