/**
 * Validación de documentos peruanos (igual que App\Support\PeruDocument en el backend).
 */

const RUC_PREFIXES = ['10', '15', '17', '20'];
const RUC_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function isValidDni(value) {
  return /^\d{8}$/.test(String(value ?? ''));
}

/** RUC: 11 dígitos, prefijo 10/15/17/20 y dígito verificador módulo 11. */
export function isValidRuc(value) {
  const ruc = String(value ?? '');
  if (!/^\d{11}$/.test(ruc) || !RUC_PREFIXES.includes(ruc.substring(0, 2))) return false;

  const sum = RUC_WEIGHTS.reduce((acc, weight, i) => acc + Number(ruc[i]) * weight, 0);
  let check = 11 - (sum % 11);
  if (check === 10) check = 0;
  else if (check === 11) check = 1;

  return check === Number(ruc[10]);
}

export const DOC_TYPES = [
  { value: 'DNI', label: 'DNI' },
  { value: 'RUC', label: 'RUC' },
  { value: 'CE', label: 'Carné de extranjería' },
  { value: 'PAS', label: 'Pasaporte' },
];

/** Devuelve un mensaje de error o null si el documento es válido. */
export function documentError(type, value) {
  const v = String(value ?? '').trim();
  switch (type) {
    case 'DNI':
      return isValidDni(v) ? null : 'El DNI debe tener 8 dígitos.';
    case 'RUC':
      return isValidRuc(v) ? null : 'RUC inválido: 11 dígitos, inicia en 10, 15, 17 o 20 y dígito verificador correcto.';
    case 'CE':
      return /^[A-Za-z0-9]{8,12}$/.test(v) ? null : 'El carné de extranjería debe tener entre 8 y 12 caracteres.';
    case 'PAS':
      return /^[A-Za-z0-9]{6,15}$/.test(v) ? null : 'El pasaporte debe tener entre 6 y 15 caracteres.';
    default:
      return 'Seleccione un tipo de documento.';
  }
}
