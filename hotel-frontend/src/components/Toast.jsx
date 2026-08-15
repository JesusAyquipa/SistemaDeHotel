import { useEffect } from 'react';

export default function Toast({ message, isOpen, onClose, duration = 5000 }) {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        if (onClose) onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-[#3F6B4F] text-white px-6 py-3 rounded shadow-key-tag flex items-center gap-3 z-50 transition-all duration-300 animate-bounce-short border border-emerald-700/40"
      role="alert"
    >
      <span className="material-symbols-outlined text-white text-xl">check_circle</span>
      <span className="font-body-md text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-white/80 hover:text-white text-xs font-mono p-1"
        aria-label="Cerrar notificación"
      >
        ✕
      </button>
    </div>
  );
}
