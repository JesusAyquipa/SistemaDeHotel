import { useEffect, useRef } from 'react';

const TYPE_STYLES = {
  success: { classes: 'bg-[#3F6B4F] border-emerald-700/40', icon: 'check_circle' },
  error: { classes: 'bg-[#93000a] border-[#ba1a1a]/60', icon: 'error' },
  info: { classes: 'bg-[#14213d] border-[#c9a227]/60', icon: 'info' },
};

/**
 * Notificación flotante.
 * Props: message, isOpen, onClose, duration, type ('success' | 'error' | 'info')
 */
export default function Toast({ message, isOpen, onClose, duration = 5000, type = 'success' }) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        if (onCloseRef.current) onCloseRef.current();
      }, duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen, duration, message]);

  if (!isOpen || !message) return null;

  const style = TYPE_STYLES[type] || TYPE_STYLES.success;

  return (
    <div
      className={`fixed top-6 left-1/2 transform -translate-x-1/2 ${style.classes} text-white px-6 py-3 rounded shadow-key-tag flex items-center gap-3 z-[70] transition-all duration-300 animate-bounce-short border max-w-[calc(100vw-2rem)]`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      <span className="material-symbols-outlined text-white text-xl" aria-hidden="true">{style.icon}</span>
      <span className="font-body-md text-sm font-medium">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 text-white/80 hover:text-white text-xs font-mono p-1"
        aria-label="Cerrar notificación"
      >
        ✕
      </button>
    </div>
  );
}
