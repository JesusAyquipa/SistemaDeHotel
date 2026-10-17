/**
 * Estados canónicos de reserva (contrato de la API) con etiquetas en español
 * y clases de Tailwind para los badges.
 */
export const BOOKING_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  NO_SHOW: 'no_show',
};

const STATUS_META = {
  pending_payment: {
    label: 'Pago Pendiente',
    badge: 'bg-[#fff3e0] text-[#e65100] border-[#ff9800]',
  },
  confirmed: {
    label: 'Confirmada',
    badge: 'bg-[#e8f5e9] text-[#1b5e20] border-[#4caf50]',
  },
  checked_in: {
    label: 'En Curso (Check-in)',
    badge: 'bg-[#e3f2fd] text-[#1565c0] border-[#2196f3]',
  },
  checked_out: {
    label: 'Finalizada',
    badge: 'bg-[#f5f5f5] text-[#616161] border-[#9e9e9e]',
  },
  cancelled: {
    label: 'Cancelada',
    badge: 'bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]',
  },
  expired: {
    label: 'Expirada',
    badge: 'bg-[#eeeeee] text-[#757575] border-[#bdbdbd]',
  },
  no_show: {
    label: 'No se presentó',
    badge: 'bg-[#fce4ec] text-[#880e4f] border-[#c2185b]',
  },
};

const FALLBACK_BADGE = 'bg-gray-100 text-gray-800 border-gray-300';

export function bookingStatusLabel(status) {
  return STATUS_META[status]?.label ?? (status ? String(status) : 'Desconocido');
}

export function bookingStatusBadge(status) {
  return STATUS_META[status]?.badge ?? FALLBACK_BADGE;
}

/** Reservas que el huésped puede modificar o cancelar. */
export const MODIFIABLE_STATUSES = [BOOKING_STATUS.PENDING_PAYMENT, BOOKING_STATUS.CONFIRMED];

/** Reservas relevantes para recepción (check-in / check-out). */
export const ACTIVE_STATUSES = [
  BOOKING_STATUS.PENDING_PAYMENT,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
];

export const BOOKING_STATUS_OPTIONS = Object.keys(STATUS_META).map((value) => ({
  value,
  label: STATUS_META[value].label,
}));
