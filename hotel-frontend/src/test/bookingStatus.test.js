import { describe, it, expect } from 'vitest';
import {
  BOOKING_STATUS,
  bookingStatusLabel,
  bookingStatusBadge,
  BOOKING_STATUS_OPTIONS,
  MODIFIABLE_STATUSES,
  ACTIVE_STATUSES,
} from '../utils/bookingStatus';

describe('utils/bookingStatus', () => {
  it('traduce los estados canónicos al español', () => {
    expect(bookingStatusLabel('pending_payment')).toBe('Pago Pendiente');
    expect(bookingStatusLabel('confirmed')).toBe('Confirmada');
    expect(bookingStatusLabel('checked_out')).toBe('Finalizada');
    expect(bookingStatusLabel('no_show')).toBe('No se presentó');
  });

  it('usa el valor crudo o "Desconocido" para estados no contemplados', () => {
    expect(bookingStatusLabel('legacy')).toBe('legacy');
    expect(bookingStatusLabel(null)).toBe('Desconocido');
    expect(bookingStatusBadge('legacy')).toContain('bg-gray-100');
    expect(bookingStatusBadge('cancelled')).toContain('#ffdad6');
  });

  it('las opciones de filtro cubren todos los estados', () => {
    expect(BOOKING_STATUS_OPTIONS.map((o) => o.value).sort()).toEqual(Object.values(BOOKING_STATUS).sort());
  });

  it('solo pending_payment y confirmed son modificables por el huésped', () => {
    expect(MODIFIABLE_STATUSES).toEqual(['pending_payment', 'confirmed']);
    expect(ACTIVE_STATUSES).toContain('checked_in');
    expect(ACTIVE_STATUSES).not.toContain('cancelled');
  });
});
