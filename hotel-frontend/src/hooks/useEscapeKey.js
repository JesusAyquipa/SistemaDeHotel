import { useEffect, useRef } from 'react';

/**
 * Ejecuta `onEscape` al presionar la tecla Escape mientras `active` sea true.
 */
export default function useEscapeKey(onEscape, active = true) {
  const handlerRef = useRef(onEscape);

  useEffect(() => {
    handlerRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && handlerRef.current) handlerRef.current(e);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active]);
}
