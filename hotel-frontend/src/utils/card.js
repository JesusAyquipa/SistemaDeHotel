/**
 * Utilidades compartidas para el formulario de tarjeta (formato y validación).
 * Los datos de tarjeta solo se envían al backend; nunca se registran ni almacenan.
 */

const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ'\s]+$/;
const REPEATING_REGEX = /(.)\1{2,}/;

export const EMPTY_CARD = { card_number: '', card_expiry: '', card_cvc: '', card_holder: '' };

export function formatCardNumber(value) {
  const cleaned = String(value).replace(/\D/g, '').slice(0, 19);
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

export function formatExpiry(value) {
  const cleaned = String(value).replace(/\D/g, '').slice(0, 4);
  if (cleaned.length >= 3) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  return cleaned;
}

export function formatCvc(value) {
  return String(value).replace(/\D/g, '').slice(0, 4);
}

export function formatHolder(value) {
  return String(value).replace(/[0-9]/g, '');
}

/** Aplica el formato adecuado según el nombre del campo. */
export function formatCardField(name, value) {
  switch (name) {
    case 'card_number': return formatCardNumber(value);
    case 'card_expiry': return formatExpiry(value);
    case 'card_cvc': return formatCvc(value);
    case 'card_holder': return formatHolder(value);
    default: return value;
  }
}

export function cardDigits(number) {
  return String(number || '').replace(/\D/g, '');
}

export function luhnCheck(number) {
  const digits = cardDigits(number);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function detectCardBrand(number) {
  const cleaned = cardDigits(number);
  if (/^4/.test(cleaned)) return 'visa';
  if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return 'mastercard';
  if (/^3[47]/.test(cleaned)) return 'amex';
  return null;
}

export function detectCardBank(number) {
  const cleaned = cardDigits(number);
  if (cleaned.length < 4) return null;
  if (/^(4145|4154|4312|4557|4969|4280|5155|5406|5289)/.test(cleaned)) return 'BCP';
  if (/^(4143|4214|4213|5122|5491|5169|5300|5198)/.test(cleaned)) return 'Interbank';
  if (/^(4220|4551|4555|5256|5188)/.test(cleaned)) return 'BBVA';
  if (/^(4321|4894|5160|5438|5273)/.test(cleaned)) return 'Scotiabank';
  if (/^(3600|3000|4556|4122)/.test(cleaned)) return 'Diners / Pichincha';
  return null;
}

export function validateExpiry(expiry) {
  if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry)) return 'Ingrese la fecha de expiración (MM/YY)';
  const [mm, yy] = expiry.split('/');
  const expMonth = parseInt(mm, 10);
  const expYear = parseInt(yy, 10) + 2000;
  const now = new Date();
  const currYear = now.getFullYear();
  const currMonth = now.getMonth() + 1;
  if (expMonth < 1 || expMonth > 12) return 'Mes inválido (01-12)';
  if (expYear < currYear || (expYear === currYear && expMonth < currMonth)) return 'La tarjeta está vencida';
  return null;
}

export function validateCvc(cvc, brand = null) {
  if (!cvc || !/^\d{3,4}$/.test(cvc)) return 'Ingrese el código CVC (3-4 dígitos)';
  if (brand === 'amex' && cvc.length !== 4) return 'American Express requiere un CVC de 4 dígitos';
  return null;
}

export function validateHolder(holder) {
  const h = String(holder || '').trim();
  if (!h) return 'Nombre del titular es obligatorio';
  if (h.length < 5 || !h.includes(' ')) return 'Ingrese nombre y apellido completo';
  if (!NAME_REGEX.test(h) || REPEATING_REGEX.test(h)) return 'Ingrese un nombre válido';
  return null;
}

/**
 * Valida todos los campos de tarjeta. Devuelve un objeto { campo: mensaje } (vacío si es válido).
 */
export function validateCard(card) {
  const errors = {};
  const digits = cardDigits(card.card_number);
  if (digits.length < 13) {
    errors.card_number = 'Ingrese un número de tarjeta válido (13-19 dígitos)';
  } else if (!luhnCheck(digits)) {
    errors.card_number = 'El número de tarjeta no es válido';
  }
  const brand = detectCardBrand(digits);
  const expiryError = validateExpiry(card.card_expiry);
  if (expiryError) errors.card_expiry = expiryError;
  const cvcError = validateCvc(card.card_cvc, brand);
  if (cvcError) errors.card_cvc = cvcError;
  const holderError = validateHolder(card.card_holder);
  if (holderError) errors.card_holder = holderError;
  return errors;
}

/** Payload de tarjeta listo para enviar a la API (número solo dígitos). */
export function cardPayload(card) {
  return {
    card_number: cardDigits(card.card_number),
    card_expiry: card.card_expiry,
    card_cvc: card.card_cvc,
    card_holder: String(card.card_holder || '').trim(),
  };
}
