import { useEffect, useState } from 'react';

/**
 * Devuelve `value` con un retraso de `delay` ms (útil para búsquedas).
 */
export default function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
