import api from '../services/api';
import { apiErrorMessage } from './apiError';

/**
 * Valida un cupón contra la API pública. Devuelve el cupón o lanza un Error con mensaje legible.
 */
export async function validateCoupon(code) {
  const trimmed = String(code || '').trim();
  if (!trimmed) throw new Error('Ingrese un código de cupón');
  try {
    const res = await api.post('/coupons/validate', { code: trimmed });
    return res.data.coupon;
  } catch (err) {
    throw new Error(apiErrorMessage(err, 'Cupón inválido'), { cause: err });
  }
}

/** Calcula el descuento de un cupón sobre un subtotal (nunca mayor al subtotal). */
export function couponDiscount(coupon, subTotal) {
  if (!coupon) return 0;
  const value = parseFloat(coupon.discount_value) || 0;
  const discount = coupon.discount_type === 'percentage' ? subTotal * (value / 100) : value;
  return Math.min(Math.max(0, discount), subTotal);
}
