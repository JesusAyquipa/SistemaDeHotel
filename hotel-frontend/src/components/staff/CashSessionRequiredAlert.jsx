import { useState } from 'react';
import { createPortal } from 'react-dom';
import { OpenCashModal } from './CashSessionWidget';
import { CASH_SESSION_REQUIRED_MESSAGE } from '../../utils/cashSession';

/**
 * Aviso para cobros del personal sin caja abierta (422 del backend).
 * Ofrece abrir la caja ahí mismo, sin perder lo que se estaba cobrando.
 *
 * Props:
 *  - onOpened(): se llama cuando la caja se abrió correctamente (p. ej. para limpiar el aviso).
 *  - className: clases extra del contenedor.
 */
export default function CashSessionRequiredAlert({ onOpened, className = '' }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      role="alert"
      className={`bg-[#fff3cd] border border-[#c9a227] text-[#5c4400] p-3 text-sm flex flex-col sm:flex-row sm:items-center gap-3 ${className}`}
    >
      <p className="flex items-start gap-2 flex-1 min-w-0">
        <span className="material-symbols-outlined text-base shrink-0" aria-hidden="true">lock</span>
        <span>
          <strong className="block">{CASH_SESSION_REQUIRED_MESSAGE}.</strong>
          Abre tu caja con el fondo inicial y vuelve a confirmar el cobro.
        </span>
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 bg-[#14213d] text-[#fbf9f4] border border-[#c9a227] hover:bg-[#0a1628] font-mono text-xs uppercase tracking-wider font-bold cursor-pointer shrink-0"
      >
        <span className="material-symbols-outlined text-base" aria-hidden="true">lock_open</span>
        Abrir caja
      </button>

      {open && createPortal(
        <OpenCashModal
          onClose={() => setOpen(false)}
          onOpened={() => {
            setOpen(false);
            onOpened?.();
          }}
        />,
        document.body,
      )}
    </div>
  );
}
