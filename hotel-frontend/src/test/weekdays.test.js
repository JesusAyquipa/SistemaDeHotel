import { describe, it, expect } from 'vitest';
import {
  ALL_WEEKDAYS,
  WEEKDAYS,
  describeWeekdays,
  normalizeWeekdays,
  toggleWeekday,
  weekdaysFromApi,
  weekdaysPayload,
} from '../utils/weekdays';
import { csvCell, toCsv } from '../utils/csv';
import { normalizeCashSessionList } from '../services/cashSessionService';

describe('utils/weekdays (SHE-018)', () => {
  it('muestra Lun..Dom y los mapea a 1..6,0', () => {
    expect(WEEKDAYS.map((d) => d.short)).toEqual(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);
    expect(ALL_WEEKDAYS).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it('normaliza: descarta inválidos y duplicados, ordena lunes → domingo', () => {
    expect(normalizeWeekdays([0, 6, 6, 7, -1, '3', 'x', 1.5])).toEqual([3, 6, 0]);
    expect(normalizeWeekdays(null)).toEqual([]);
  });

  it('payload: null cuando aplica todos los días o ninguno', () => {
    expect(weekdaysPayload(ALL_WEEKDAYS)).toBeNull();
    expect(weekdaysPayload([])).toBeNull();
    expect(weekdaysPayload([0, 6])).toEqual([6, 0]);
  });

  it('desde la API: null/vacío = todos los días', () => {
    expect(weekdaysFromApi(null)).toEqual(ALL_WEEKDAYS);
    expect(weekdaysFromApi([])).toEqual(ALL_WEEKDAYS);
    expect(weekdaysFromApi([5, 1])).toEqual([1, 5]);
  });

  it('alterna días', () => {
    expect(toggleWeekday([1, 2], 2)).toEqual([1]);
    expect(toggleWeekday([1], 0)).toEqual([1, 0]);
  });

  it('describe la selección', () => {
    expect(describeWeekdays(null)).toBe('Todos los días');
    expect(describeWeekdays(ALL_WEEKDAYS)).toBe('Todos los días');
    expect(describeWeekdays([6, 0])).toBe('Solo fines de semana');
    expect(describeWeekdays([1, 2, 3, 4, 5])).toBe('Lunes a viernes');
    expect(describeWeekdays([3])).toBe('Solo miércoles');
    expect(describeWeekdays([0, 1, 5])).toBe('Lun, Vie, Dom');
  });
});

describe('utils/csv', () => {
  it('escapa comillas, separadores y evita fórmulas', () => {
    expect(csvCell('Ana "La" Pérez, hija')).toBe('"Ana ""La"" Pérez, hija"');
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell(-12.5)).toBe('-12.5');
    expect(csvCell(null)).toBe('');
    expect(toCsv([['a', 1], ['b', 2]])).toBe('a,1\r\nb,2');
  });
});

describe('services/cashSessionService: normalizeCashSessionList', () => {
  it('acepta el paginador de Laravel con totales en meta', () => {
    const res = normalizeCashSessionList({
      data: [{ id: 1 }],
      current_page: 2, last_page: 3, total: 41, from: 21, to: 40,
      meta: { totals: { expected: '100.50', counted: 90, difference: '-10.50' } },
    });
    expect(res.items).toHaveLength(1);
    expect(res.pagination).toEqual({ current_page: 2, last_page: 3, total: 41, from: 21, to: 40 });
    expect(res.totals).toEqual({ expected: 100.5, counted: 90, difference: -10.5 });
  });

  it('acepta un recurso con meta de paginación y valores vacíos', () => {
    const res = normalizeCashSessionList({ data: [], meta: { current_page: 1, last_page: 1, total: 0, expected_amount: 5 } });
    expect(res.pagination.total).toBe(0);
    expect(res.totals).toEqual({ expected: 5, counted: 0, difference: 0 });
    expect(normalizeCashSessionList(null).items).toEqual([]);
  });
});
