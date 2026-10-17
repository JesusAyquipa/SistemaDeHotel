import useCancellationPolicy from '../hooks/useCancellationPolicy';
import { policyLines } from '../utils/cancellationPolicy';

/**
 * Texto de la política de cancelación (SHE-028) para mostrar antes de pagar.
 */
export default function CancellationPolicyNotice({ className = '' }) {
  const { policy } = useCancellationPolicy();

  return (
    <div className={`bg-[#fcfcfc] border border-[#d1c5af] p-4 ${className}`}>
      <h4 className="font-mono text-xs uppercase font-bold text-[#14213d] tracking-wider mb-2 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-sm text-[#755b00]" aria-hidden="true">policy</span>
        Política de Cancelación
      </h4>
      <ul className="list-disc pl-5 space-y-1 font-sans text-xs text-[#4d4635]">
        {policyLines(policy).map((line) => <li key={line}>{line}</li>)}
      </ul>
    </div>
  );
}
