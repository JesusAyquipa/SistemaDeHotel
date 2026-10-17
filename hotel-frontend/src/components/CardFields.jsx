import { useId } from 'react';
import CardBrandIcon from './CardBrandIcon';
import { detectCardBrand, formatCardField } from '../utils/card';

/**
 * Campos de tarjeta reutilizables (número, titular, vencimiento, CVC) con labels accesibles.
 * `card` usa las claves de la API: card_number, card_expiry, card_cvc, card_holder.
 */
export default function CardFields({ card, onChange, errors = {}, disabled = false }) {
  const baseId = useId();
  const ids = {
    card_number: `${baseId}-number`,
    card_holder: `${baseId}-holder`,
    card_expiry: `${baseId}-expiry`,
    card_cvc: `${baseId}-cvc`,
  };
  const brand = detectCardBrand(card.card_number);

  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange({ ...card, [name]: formatCardField(name, value) }, name);
  };

  const inputClass = 'w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-sm font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none disabled:opacity-50';
  const labelClass = 'block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1';
  const errorClass = 'text-[#ba1a1a] font-mono text-[10px] mt-1';

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={ids.card_number} className={labelClass}>Número de Tarjeta *</label>
        <div className="relative">
          <input
            id={ids.card_number}
            type="text"
            name="card_number"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
            value={card.card_number}
            onChange={handleChange}
            maxLength={23}
            disabled={disabled}
            aria-invalid={!!errors.card_number}
            className={`${inputClass} pr-14 tracking-wider`}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <CardBrandIcon brand={brand} />
          </div>
        </div>
        {errors.card_number && <p className={errorClass}>{errors.card_number}</p>}
      </div>

      <div>
        <label htmlFor={ids.card_holder} className={labelClass}>Nombre del Titular *</label>
        <input
          id={ids.card_holder}
          type="text"
          name="card_holder"
          autoComplete="cc-name"
          placeholder="NOMBRE DEL TITULAR"
          value={card.card_holder}
          onChange={handleChange}
          disabled={disabled}
          aria-invalid={!!errors.card_holder}
          className={`${inputClass} uppercase`}
        />
        {errors.card_holder && <p className={errorClass}>{errors.card_holder}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={ids.card_expiry} className={labelClass}>Vencimiento (MM/YY) *</label>
          <input
            id={ids.card_expiry}
            type="text"
            name="card_expiry"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            value={card.card_expiry}
            onChange={handleChange}
            maxLength={5}
            disabled={disabled}
            aria-invalid={!!errors.card_expiry}
            className={inputClass}
          />
          {errors.card_expiry && <p className={errorClass}>{errors.card_expiry}</p>}
        </div>
        <div>
          <label htmlFor={ids.card_cvc} className={labelClass}>CVC *</label>
          <input
            id={ids.card_cvc}
            type="password"
            name="card_cvc"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="•••"
            value={card.card_cvc}
            onChange={handleChange}
            maxLength={4}
            disabled={disabled}
            aria-invalid={!!errors.card_cvc}
            className={inputClass}
          />
          {errors.card_cvc && <p className={errorClass}>{errors.card_cvc}</p>}
        </div>
      </div>
    </div>
  );
}
