const formatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatea un monto en soles peruanos (S/).
 */
export default function formatCurrency(value) {
  const n = Number(value);
  return formatter.format(Number.isFinite(n) ? n : 0);
}

export { formatCurrency };

/** Tasa de IGV (Perú). Los precios del hotel YA incluyen IGV. */
export const IGV_RATE = 0.18;

/** Porción de IGV incluida en un monto que ya lo contiene. */
export function includedIgv(total) {
  const t = Number(total) || 0;
  return t - t / (1 + IGV_RATE);
}
