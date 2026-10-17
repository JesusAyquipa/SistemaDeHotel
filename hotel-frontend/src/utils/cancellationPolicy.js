/**
 * Política de cancelación (SHE-028): textos y estimación de reembolso en el cliente.
 * El cálculo replica App\Services\RefundPolicy; el servidor es la fuente de verdad.
 */

export const DEFAULT_CANCELLATION_POLICY = {
  free_cancellation_hours: 48,
  late_cancellation_penalty_nights: 1,
  no_show_penalty_nights: 1,
  no_show_grace_hours: 2,
};

const dateOnly = (value) => new Date(`${String(value).substring(0, 10)}T00:00:00`);

const nightsLabel = (n) => `${n} ${Number(n) === 1 ? 'noche' : 'noches'}`;

export function nightsOf(booking) {
  const diff = Math.round((dateOnly(booking.check_out) - dateOnly(booking.check_in)) / 86400000);
  return Math.max(1, diff || 1);
}

/** Textos legibles de la política. */
export function policyLines(policy = DEFAULT_CANCELLATION_POLICY) {
  const p = { ...DEFAULT_CANCELLATION_POLICY, ...(policy || {}) };
  const lines = [];
  if (Number(p.free_cancellation_hours) > 0) {
    lines.push(`Cancelación gratuita hasta ${p.free_cancellation_hours} horas antes del día de llegada (reembolso del 100%).`);
  } else {
    lines.push('Cancelación gratuita hasta antes del día de llegada.');
  }
  lines.push(
    Number(p.late_cancellation_penalty_nights) > 0
      ? `Cancelaciones posteriores: se retiene el importe de ${nightsLabel(p.late_cancellation_penalty_nights)}.`
      : 'Cancelaciones posteriores: sin penalidad.'
  );
  lines.push(
    Number(p.no_show_penalty_nights) > 0
      ? `No presentarse (no-show) o cancelar el mismo día de llegada: se retiene el importe de ${nightsLabel(p.no_show_penalty_nights)}.`
      : 'No presentarse (no-show): sin penalidad.'
  );
  return lines;
}

/**
 * Estimación del reembolso al cancelar ahora.
 * @param {object} policy
 * @param {{check_in, check_out, total_amount}} booking
 * @param {number|null} paid Monto cobrado aún no reembolsado (si se desconoce, se usa total_amount).
 * @returns {{window:'free'|'late'|'no_show', penalty:number, refund:number, percentage:number, paid:number}}
 */
export function estimateRefund(policy, booking, paid = null) {
  const p = { ...DEFAULT_CANCELLATION_POLICY, ...(policy || {}) };
  const total = Number(booking?.total_amount) || 0;
  const base = paid === null || paid === undefined ? total : Math.max(0, Number(paid) || 0);
  const hours = (dateOnly(booking.check_in) - new Date()) / 3600000;

  let window = 'no_show';
  if (hours >= Number(p.free_cancellation_hours)) window = 'free';
  else if (hours > 0) window = 'late';

  const nights = nightsOf(booking);
  const penaltyNights = window === 'free' ? 0
    : Math.min(nights, Number(window === 'late' ? p.late_cancellation_penalty_nights : p.no_show_penalty_nights) || 0);
  const nightly = Math.round((total / nights) * 100) / 100;
  const penalty = Math.min(Math.round(penaltyNights * nightly * 100) / 100, total);
  const refund = Math.max(0, Math.round((base - penalty) * 100) / 100);
  const percentage = base > 0 ? Math.round((refund / base) * 100) : (window === 'free' ? 100 : 0);

  return { window, penalty, refund, percentage, paid: base };
}
