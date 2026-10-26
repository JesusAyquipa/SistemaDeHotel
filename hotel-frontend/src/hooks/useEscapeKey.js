import { useEffect, useRef } from 'react';

/**
 * Ejecuta `onEscape` al presionar la tecla Escape mientras `active` sea true.
 *
 * Con `{ exclusive: true }` el listener se registra en fase de captura sobre `window`
 * y detiene la propagación: útil para un modal abierto encima de otro modal, de modo
 * que Escape cierre solo el de arriba.
 */
export default function useEscapeKey(onEscape, active = true, { exclusive = false } = {}) {
  const handlerRef = useRef(onEscape);

  useEffect(() => {
    handlerRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape' || !handlerRef.current) return;
      if (exclusive) e.stopPropagation();
      handlerRef.current(e);
    };
    const target = exclusive ? window : document;
    target.addEventListener('keydown', onKeyDown, exclusive);
    return () => target.removeEventListener('keydown', onKeyDown, exclusive);
  }, [active, exclusive]);
}
