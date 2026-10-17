import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckoutModal from '../components/CheckoutModal';
import { createCheckoutIntent, processMockPayment } from '../services/paymentService';

vi.mock('../services/paymentService', () => ({
  createCheckoutIntent: vi.fn(),
  processMockPayment: vi.fn(),
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

function renderModal(props = {}) {
  const onClose = vi.fn();
  const onPaymentSuccess = vi.fn();
  const user = userEvent.setup();
  render(
    <CheckoutModal
      room={room}
      initialDates={{ check_in: '2030-05-10', check_out: '2030-05-12' }}
      onClose={onClose}
      onPaymentSuccess={onPaymentSuccess}
      {...props}
    />,
  );
  return { user, onClose, onPaymentSuccess };
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
});
