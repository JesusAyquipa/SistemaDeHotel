import { useEffect, useId, useRef, useState } from 'react';
import useEscapeKey from '../hooks/useEscapeKey';

/**
 * Diálogo de confirmación accesible y reutilizable.
 *
 * Props:
 *  - isOpen, title, message
 *  - confirmLabel, cancelLabel
 *  - variant: 'danger' | 'default'
 *  - requireReason: muestra un campo de texto obligatorio (se pasa a onConfirm(reason))
 *  - reasonLabel
 *  - onConfirm(reason?), onCancel()
 */
export default function ConfirmDialog({
  isOpen,
  title = 'Confirmar acción',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  requireReason = false,
  reasonLabel = 'Motivo',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const descId = useId();
  const reasonId = useId();
  const firstFocusRef = useRef(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  useEscapeKey(() => { if (!busy) onCancel?.(); }, isOpen);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setReasonError('');
      // Enfocar el primer control al abrir
      const t = setTimeout(() => firstFocusRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireReason) {
      if (!reason.trim()) {
        setReasonError('Este campo es obligatorio.');
        return;
      }
      onConfirm?.(reason.trim());
      return;
    }
    onConfirm?.();
  };

  const confirmClasses = variant === 'danger'
    ? 'bg-[#ba1a1a] hover:bg-[#93000a] text-white border-[#93000a]'
    : 'bg-[#14213d] hover:bg-[#0a1628] text-[#fbf9f4] border-[#c9a227]';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#14213d]/60 backdrop-blur-xs p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel?.(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? descId : undefined}
        className="bg-[#fbf9f4] border border-[#d1c5af] shadow-[4px_4px_0px_rgba(20,33,61,0.25)] max-w-md w-full"
      >
        <div className="px-6 py-4 border-b border-[#d1c5af] bg-[#f5f3ee]">
          <h2 id={titleId} className="font-serif text-lg font-bold text-[#14213d]">{title}</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          {message && (
            <p id={descId} className="font-sans text-sm text-[#4d4635] whitespace-pre-line">{message}</p>
          )}
          {requireReason && (
            <div>
              <label htmlFor={reasonId} className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                {reasonLabel} *
              </label>
              <textarea
                id={reasonId}
                ref={firstFocusRef}
                rows={3}
                value={reason}
                onChange={(e) => { setReason(e.target.value); setReasonError(''); }}
                aria-invalid={!!reasonError}
                className="w-full bg-white border border-[#d1c5af] p-2 text-sm font-sans focus:border-[#14213d] focus:outline-none resize-none"
              />
              {reasonError && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{reasonError}</p>}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-[#d1c5af] bg-[#f5f3ee] flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button
            type="button"
            ref={requireReason ? undefined : firstFocusRef}
            onClick={onCancel}
            disabled={busy}
            className="px-5 py-2 border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-xs uppercase font-bold tracking-wider disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`px-5 py-2 border font-mono text-xs uppercase font-bold tracking-wider disabled:opacity-50 ${confirmClasses}`}
          >
            {busy ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
