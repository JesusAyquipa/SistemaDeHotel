import { toYmd } from './dates';

/** Ruta de la cuenta (folio) de una habitación según el rol. */
export const roomAccountPath = (isAdmin, roomId) => (isAdmin
  ? `/admin/habitaciones/${roomId}/cuenta`
  : `/recepcionista/habitaciones/${roomId}/cuenta`);

/** 'YYYY-MM-DD' -> Date local a medianoche. */
export const parseYmd = (ymd) => new Date(`${String(ymd).substring(0, 10)}T00:00:00`);

/** Suma días a una fecha 'YYYY-MM-DD' y devuelve 'YYYY-MM-DD'. */
export const addDaysYmd = (ymd, days) => {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + days);
  return toYmd(d);
};

/** Diferencia en días entre dos fechas 'YYYY-MM-DD' (b - a). */
export const diffDays = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);

export const todayYmd = () => toYmd(new Date());
