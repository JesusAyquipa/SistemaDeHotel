/** Convierte un Date a 'YYYY-MM-DD' en hora local. */
export function toYmd(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Noches entre dos fechas 'YYYY-MM-DD' (0 si el rango es inválido). */
export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${String(checkIn).substring(0, 10)}T00:00:00`);
  const end = new Date(`${String(checkOut).substring(0, 10)}T00:00:00`);
  const diff = Math.round((end - start) / 86400000);
  return diff > 0 ? diff : 0;
}

/** 'YYYY-MM-DD' (o datetime ISO) a 'DD/MM/YYYY'; '—' si está vacío o es inválido. */
export function formatDmy(value) {
  if (!value) return '—';
  const [y, m, d] = String(value).substring(0, 10).split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}
