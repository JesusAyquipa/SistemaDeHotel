/**
 * Días de la semana para tarifas por temporada (SHE-018).
 * La API usa el formato de JavaScript/Carbon: 0 = domingo ... 6 = sábado.
 * La interfaz los muestra de lunes a domingo.
 */
export const WEEKDAYS = [
  { value: 1, short: 'Lun', long: 'Lunes' },
  { value: 2, short: 'Mar', long: 'Martes' },
  { value: 3, short: 'Mié', long: 'Miércoles' },
  { value: 4, short: 'Jue', long: 'Jueves' },
  { value: 5, short: 'Vie', long: 'Viernes' },
  { value: 6, short: 'Sáb', long: 'Sábado' },
  { value: 0, short: 'Dom', long: 'Domingo' },
];

export const ALL_WEEKDAYS = WEEKDAYS.map((d) => d.value);

const ORDER = new Map(WEEKDAYS.map((d, i) => [d.value, i]));

/** Enteros válidos (0..6), sin duplicados y en orden lunes → domingo. */
export function normalizeWeekdays(days) {
  if (!Array.isArray(days)) return [];
  const valid = days
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return [...new Set(valid)].sort((a, b) => ORDER.get(a) - ORDER.get(b));
}

/**
 * Valor a enviar a la API: null cuando aplica todos los días (o ninguno elegido),
 * o el arreglo ordenado de días.
 */
export function weekdaysPayload(days) {
  const list = normalizeWeekdays(days);
  if (list.length === 0 || list.length === 7) return null;
  return list;
}

/** Selección inicial del formulario a partir del valor de la API (null = todos). */
export function weekdaysFromApi(value) {
  const list = normalizeWeekdays(value);
  return list.length === 0 ? [...ALL_WEEKDAYS] : list;
}

/** Alterna un día en la selección conservando el orden lunes → domingo. */
export function toggleWeekday(days, value) {
  const list = normalizeWeekdays(days);
  return list.includes(value)
    ? list.filter((d) => d !== value)
    : normalizeWeekdays([...list, value]);
}

/** Texto legible para el listado de temporadas. */
export function describeWeekdays(days) {
  const list = normalizeWeekdays(days);
  if (list.length === 0 || list.length === 7) return 'Todos los días';
  const key = [...list].sort((a, b) => a - b).join(',');
  if (key === '0,6') return 'Solo fines de semana';
  if (key === '1,2,3,4,5') return 'Lunes a viernes';
  if (list.length === 1) return `Solo ${WEEKDAYS[ORDER.get(list[0])].long.toLowerCase()}`;
  return list.map((d) => WEEKDAYS[ORDER.get(d)].short).join(', ');
}
