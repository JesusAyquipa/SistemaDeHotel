/**
 * Icono SVG de la marca de la tarjeta (visa, mastercard, amex o genérico).
 */
export default function CardBrandIcon({ brand }) {
  if (brand === 'visa') {
    return (
      <svg viewBox="0 0 48 32" className="w-10 h-7" fill="none" role="img" aria-label="Visa">
        <rect width="48" height="32" rx="4" fill="#1A1F71" />
        <text x="24" y="20" textAnchor="middle" fill="#FFFFFF" fontFamily="Arial Black, sans-serif" fontSize="12" fontWeight="900">VISA</text>
      </svg>
    );
  }
  if (brand === 'mastercard') {
    return (
      <svg viewBox="0 0 48 32" className="w-10 h-7" fill="none" role="img" aria-label="Mastercard">
        <rect width="48" height="32" rx="4" fill="#252525" />
        <circle cx="19" cy="16" r="9" fill="#EB001B" />
        <circle cx="29" cy="16" r="9" fill="#F79E1B" />
        <path d="M24 9.17a9 9 0 010 13.66 9 9 0 010-13.66z" fill="#FF5F00" />
      </svg>
    );
  }
  if (brand === 'amex') {
    return (
      <svg viewBox="0 0 48 32" className="w-10 h-7" fill="none" role="img" aria-label="American Express">
        <rect width="48" height="32" rx="4" fill="#2E77BB" />
        <text x="24" y="20" textAnchor="middle" fill="#FFFFFF" fontFamily="Arial, sans-serif" fontSize="8" fontWeight="900">AMEX</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 32" className="w-10 h-7" fill="none" aria-hidden="true">
      <rect width="48" height="32" rx="4" fill="#E0DDD5" />
      <rect x="8" y="10" width="32" height="4" rx="1" fill="#B0A998" />
      <rect x="8" y="18" width="20" height="4" rx="1" fill="#B0A998" />
    </svg>
  );
}
