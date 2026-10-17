import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  luhnCheck,
  detectCardBrand,
  formatCardNumber,
  formatExpiry,
  formatCvc,
  formatHolder,
  validateExpiry,
  validateCvc,
  validateHolder,
  validateCard,
  cardPayload,
} from '../utils/card';

describe('utils/card', () => {
  afterEach(() => vi.useRealTimers());

  it('valida números con el algoritmo de Luhn', () => {
    expect(luhnCheck('4242 4242 4242 4242')).toBe(true);
    expect(luhnCheck('5555555555554444')).toBe(true);
    expect(luhnCheck('378282246310005')).toBe(true);
    expect(luhnCheck('4242424242424241')).toBe(false);
  });

  it('rechaza longitudes fuera de 13-19 dígitos', () => {
    expect(luhnCheck('0')).toBe(false);
    expect(luhnCheck('42424242424')).toBe(false);
    expect(luhnCheck('4'.repeat(20))).toBe(false);
  });

  it('detecta la marca de la tarjeta', () => {
    expect(detectCardBrand('4111 1111')).toBe('visa');
    expect(detectCardBrand('5105105105105100')).toBe('mastercard');
    expect(detectCardBrand('2221000000000009')).toBe('mastercard');
    expect(detectCardBrand('371449635398431')).toBe('amex');
    expect(detectCardBrand('6011111111111117')).toBeNull();
    expect(detectCardBrand('')).toBeNull();
  });

  it('formatea número, expiración, CVC y titular', () => {
    expect(formatCardNumber('4242abc424242424242')).toBe('4242 4242 4242 4242');
    expect(formatExpiry('1')).toBe('1');
    expect(formatExpiry('1229')).toBe('12/29');
    expect(formatExpiry('12/2999')).toBe('12/29');
    expect(formatCvc('12a345')).toBe('1234');
    expect(formatHolder('Juan 3Pérez')).toBe('Juan Pérez');
  });

  it('valida la fecha de expiración (formato, mes y vencimiento)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15));
    expect(validateExpiry('')).toMatch(/MM\/YY/);
    expect(validateExpiry('1/26')).toMatch(/MM\/YY/);
    expect(validateExpiry('13/27')).toBe('Mes inválido (01-12)');
    expect(validateExpiry('05/26')).toBe('La tarjeta está vencida');
    expect(validateExpiry('12/25')).toBe('La tarjeta está vencida');
    expect(validateExpiry('06/26')).toBeNull();
    expect(validateExpiry('01/30')).toBeNull();
  });

  it('exige CVC de 4 dígitos para American Express', () => {
    expect(validateCvc('12')).toMatch(/3-4/);
    expect(validateCvc('123')).toBeNull();
    expect(validateCvc('123', 'amex')).toMatch(/American Express/);
    expect(validateCvc('1234', 'amex')).toBeNull();
  });

  it('valida el nombre del titular', () => {
    expect(validateHolder('')).toMatch(/obligatorio/);
    expect(validateHolder('Juan')).toMatch(/nombre y apellido/);
    expect(validateHolder('Juan P3rez')).toBe('Ingrese un nombre válido');
    expect(validateHolder('Juaaan Pérez')).toBe('Ingrese un nombre válido');
    expect(validateHolder('María Núñez')).toBeNull();
  });

  it('validateCard devuelve los errores por campo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
    expect(validateCard({ card_number: '4242424242424242', card_expiry: '12/28', card_cvc: '123', card_holder: 'Ana Torres' })).toEqual({});
    const errors = validateCard({ card_number: '4242424242424241', card_expiry: '00/28', card_cvc: '', card_holder: 'x' });
    expect(Object.keys(errors).sort()).toEqual(['card_cvc', 'card_expiry', 'card_holder', 'card_number']);
    expect(errors.card_number).toBe('El número de tarjeta no es válido');
    expect(validateCard({ card_number: '4242', card_expiry: '12/28', card_cvc: '123', card_holder: 'Ana Torres' }).card_number).toMatch(/13-19/);
  });

  it('cardPayload envía solo dígitos y recorta el titular', () => {
    expect(cardPayload({ card_number: '4242 4242 4242 4242', card_expiry: '12/28', card_cvc: '123', card_holder: '  Ana Torres ' })).toEqual({
      card_number: '4242424242424242',
      card_expiry: '12/28',
      card_cvc: '123',
      card_holder: 'Ana Torres',
    });
  });
});
