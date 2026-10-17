import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { estimateRefund, policyLines, nightsOf, DEFAULT_CANCELLATION_POLICY } from '../utils/cancellationPolicy';

const booking = { check_in: '2026-03-10', check_out: '2026-03-13', total_amount: 600 };

describe('utils/cancellationPolicy', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('cuenta las noches de la reserva (mínimo 1)', () => {
    expect(nightsOf(booking)).toBe(3);
    expect(nightsOf({ check_in: '2026-03-10', check_out: '2026-03-10' })).toBe(1);
  });

  it('ventana gratuita: reembolso del 100%', () => {
    vi.setSystemTime(new Date(2026, 2, 5, 10, 0));
    expect(estimateRefund(DEFAULT_CANCELLATION_POLICY, booking)).toEqual({
      window: 'free', penalty: 0, refund: 600, percentage: 100, paid: 600,
    });
  });

  it('cancelación tardía: retiene las noches de penalidad', () => {
    vi.setSystemTime(new Date(2026, 2, 9, 10, 0)); // 14 h antes de la llegada (< 48 h)
    const r = estimateRefund(DEFAULT_CANCELLATION_POLICY, booking);
    expect(r.window).toBe('late');
    expect(r.penalty).toBe(200);
    expect(r.refund).toBe(400);
    expect(r.percentage).toBe(67);
  });

  it('mismo día / no-show: usa la penalidad de no-show y el monto pagado real', () => {
    vi.setSystemTime(new Date(2026, 2, 10, 15, 0));
    const r = estimateRefund({ no_show_penalty_nights: 2 }, booking, 300);
    expect(r.window).toBe('no_show');
    expect(r.penalty).toBe(400);
    expect(r.refund).toBe(0);
    expect(r.paid).toBe(300);
  });

  it('policyLines describe la política configurada', () => {
    const lines = policyLines({ free_cancellation_hours: 24, late_cancellation_penalty_nights: 2, no_show_penalty_nights: 0 });
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('24 horas');
    expect(lines[1]).toContain('2 noches');
    expect(lines[2]).toContain('sin penalidad');
    expect(policyLines()[1]).toContain('1 noche.');
  });
});
