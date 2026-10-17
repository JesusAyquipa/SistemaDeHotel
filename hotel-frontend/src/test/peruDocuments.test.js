import { describe, it, expect } from 'vitest';
import { isValidDni, isValidRuc, documentError, DOC_TYPES } from '../utils/peruDocuments';

describe('utils/peruDocuments', () => {
  it('DNI: exactamente 8 dígitos', () => {
    expect(isValidDni('12345678')).toBe(true);
    expect(isValidDni('1234567')).toBe(false);
    expect(isValidDni('1234567a')).toBe(false);
    expect(isValidDni(null)).toBe(false);
  });

  it('RUC: acepta RUC con dígito verificador correcto', () => {
    expect(isValidRuc('20100047218')).toBe(true);
    expect(isValidRuc('20131312955')).toBe(true);
    expect(isValidRuc('10467793549')).toBe(true);
  });

  it('RUC: rechaza dígito verificador, prefijo o longitud inválidos', () => {
    expect(isValidRuc('20100047219')).toBe(false);
    expect(isValidRuc('30100047218')).toBe(false);
    expect(isValidRuc('2010004721')).toBe(false);
    expect(isValidRuc('')).toBe(false);
  });

  it('documentError devuelve mensajes por tipo', () => {
    expect(documentError('DNI', ' 12345678 ')).toBeNull();
    expect(documentError('DNI', '123')).toMatch(/8 dígitos/);
    expect(documentError('RUC', '20100047218')).toBeNull();
    expect(documentError('RUC', '20100047210')).toMatch(/RUC inválido/);
    expect(documentError('CE', 'AB123456')).toBeNull();
    expect(documentError('CE', 'AB12')).toMatch(/8 y 12/);
    expect(documentError('PAS', 'X12345')).toBeNull();
    expect(documentError('PAS', 'X1')).toMatch(/6 y 15/);
    expect(documentError('OTRO', '1')).toMatch(/Seleccione/);
  });

  it('expone los tipos de documento soportados', () => {
    expect(DOC_TYPES.map((d) => d.value)).toEqual(['DNI', 'RUC', 'CE', 'PAS']);
  });
});
