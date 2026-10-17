/**
 * Estrellas de calificación. Solo lectura por defecto; con `onChange` funciona
 * como selector accesible (radiogroup).
 */
export default function StarRating({ value = 0, onChange, size = 'text-base', label = 'Calificación', className = '' }) {
  const rounded = Math.round(Number(value) * 2) / 2;

  if (!onChange) {
    return (
      <span className={`inline-flex items-center ${className}`} role="img" aria-label={`${label}: ${Number(value).toFixed(1)} de 5`}>
        {[1, 2, 3, 4, 5].map((i) => {
          const icon = rounded >= i ? 'star' : rounded >= i - 0.5 ? 'star_half' : 'star';
          const filled = rounded >= i - 0.5;
          return (
            <span
              key={i}
              aria-hidden="true"
              className={`material-symbols-outlined ${size} ${filled ? 'text-[#c9a227]' : 'text-[#d1c5af]'}`}
              style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}
            >
              {icon}
            </span>
          );
        })}
      </span>
    );
  }

  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex items-center gap-1 ${className}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={Number(value) === i}
          aria-label={`${i} ${i === 1 ? 'estrella' : 'estrellas'}`}
          onClick={() => onChange(i)}
          className="p-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227] rounded"
        >
          <span
            aria-hidden="true"
            className={`material-symbols-outlined ${size} transition-colors ${Number(value) >= i ? 'text-[#c9a227]' : 'text-[#d1c5af] hover:text-[#a68a4d]'}`}
            style={{ fontVariationSettings: Number(value) >= i ? "'FILL' 1" : "'FILL' 0" }}
          >
            star
          </span>
        </button>
      ))}
    </div>
  );
}
