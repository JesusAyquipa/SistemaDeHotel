import { describe, it, expect } from 'vitest';
import formatCurrency, { includedIgv, IGV_RATE } from '../utils/formatCurrency';
import { nightsBetween, formatDmy, toYmd } from '../utils/dates';
import { apiErrorMessage, apiStatus } from '../utils/apiError';
import { couponDiscount } from '../utils/coupon';

const normalize = (s) => s.replace(/\s/g, ' ');

describe('utils/formatCurrency', () => {
  it('formatea en soles con 2 decimales', () => {
    expect(normalize(formatCurrency(1234.5))).toBe('S/ 1,234.50');
    expect(normalize(formatCurrency('99'))).toBe('S/ 99.00');
  });

  it('usa 0 para valores no numéricos', () => {
    expect(normalize(formatCurrency('abc'))).toBe('S/ 0.00');
    expect(normalize(formatCurrency(undefined))).toBe('S/ 0.00');
  });

  it('calcula el IGV incluido (18%)', () => {
    expect(IGV_RATE).toBe(0.18);
    expect(includedIgv(118)).toBeCloseTo(18, 6);
    expect(includedIgv('x')).toBe(0);
  });
});

describe('utils/dates', () => {
  it('nightsBetween cuenta noches y devuelve 0 en rangos inválidos', () => {
    expect(nightsBetween('2026-01-10', '2026-01-13')).toBe(3);
    expect(nightsBetween('2026-01-13T10:00:00', '2026-01-14')).toBe(1);
    expect(nightsBetween('2026-01-13', '2026-01-10')).toBe(0);
    expect(nightsBetween('', '2026-01-10')).toBe(0);
  });

  it('formatDmy y toYmd', () => {
    expect(formatDmy('2026-03-07')).toBe('07/03/2026');
    expect(formatDmy('2026-03-07T12:00:00Z')).toBe('07/03/2026');
    expect(formatDmy(null)).toBe('—');
    expect(toYmd(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('utils/apiError', () => {
  it('prioriza message, luego error, luego fallback', () => {
    expect(apiErrorMessage({ response: { data: { message: 'No autorizado' } } })).toBe('No autorizado');
    expect(apiErrorMessage({ response: { data: { error: 'Falla' } } })).toBe('Falla');
    expect(apiErrorMessage({ response: { data: {} } }, 'Otro')).toBe('Otro');
    expect(apiErrorMessage({ message: 'Network Error' })).toMatch(/No se pudo conectar/);
    expect(apiStatus({ response: { status: 409 } })).toBe(409);
    expect(apiStatus(null)).toBeNull();
  });
});

describe('utils/coupon', () => {
  it('couponDiscount: porcentaje, monto fijo y tope en el subtotal', () => {
    expect(couponDiscount(null, 100)).toBe(0);
    expect(couponDiscount({ discount_type: 'percentage', discount_value: '10' }, 250)).toBe(25);
    expect(couponDiscount({ discount_type: 'fixed', discount_value: '40' }, 250)).toBe(40);
    expect(couponDiscount({ discount_type: 'fixed', discount_value: '400' }, 250)).toBe(250);
  });
});
