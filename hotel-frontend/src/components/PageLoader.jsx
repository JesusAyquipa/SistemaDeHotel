/**
 * Indicador de carga accesible mientras se descarga el código de una página (SHE-040).
 */
export default function PageLoader({ label = 'Cargando…' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[50vh] w-full flex flex-col items-center justify-center gap-3 bg-[#fbf9f4] text-[#755b00]"
    >
      <span
        aria-hidden="true"
        className="h-8 w-8 rounded-full border-2 border-[#c9a227]/30 border-t-[#c9a227] animate-spin motion-reduce:animate-none"
      />
      <span className="font-mono text-xs uppercase tracking-widest">{label}</span>
    </div>
  );
}
