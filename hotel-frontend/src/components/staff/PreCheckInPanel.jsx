import { formatDmy } from '../../utils/dates';

/**
 * Datos del pre check-in online enviados por el huésped (solo lectura, SHE-036).
 */
export default function PreCheckInPanel({ preCheckIn }) {
  if (!preCheckIn) {
    return (
      <div className="border border-dashed border-[#D1CEC5] px-4 py-3 text-xs font-mono text-[#14213D]/60 flex items-center gap-2">
        <span className="material-symbols-outlined text-base" aria-hidden="true">pending_actions</span>
        El huésped no ha completado el pre check-in online.
      </div>
    );
  }

  const companions = preCheckIn.companions || [];

  return (
    <section aria-labelledby="precheck-title" className="border border-[#2E7A4A]/40 bg-[#e8f5e9]/50 p-4">
      <h3 id="precheck-title" className="font-mono text-xs uppercase tracking-widest font-bold text-[#1b5e20] flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-base" aria-hidden="true">how_to_reg</span>
        Pre check-in online · enviado {formatDmy(preCheckIn.submitted_at)}
      </h3>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <dt className="text-[10px] font-mono uppercase text-[#14213D]/60">Llegada estimada</dt>
          <dd className="font-medium">{preCheckIn.arrival_time || '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-mono uppercase text-[#14213D]/60">Documento</dt>
          <dd className="font-medium break-all">{preCheckIn.document_type} {preCheckIn.document_number}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-mono uppercase text-[#14213D]/60">Nacionalidad</dt>
          <dd className="font-medium">{preCheckIn.nationality || '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-mono uppercase text-[#14213D]/60">Dirección</dt>
          <dd className="font-medium break-words">{preCheckIn.address || '—'}</dd>
        </div>
      </dl>
      {companions.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-mono uppercase text-[#14213D]/60 mb-1">Acompañantes ({companions.length})</p>
          <ul className="text-sm space-y-0.5">
            {companions.map((c, i) => (
              <li key={i}>{c.name} {c.surname} <span className="font-mono text-xs text-[#14213D]/70">· {c.document_type} {c.document_number}</span></li>
            ))}
          </ul>
        </div>
      )}
      {preCheckIn.special_requests && (
        <div className="mt-3">
          <p className="text-[10px] font-mono uppercase text-[#14213D]/60 mb-1">Solicitudes especiales</p>
          <p className="text-sm whitespace-pre-line break-words">{preCheckIn.special_requests}</p>
        </div>
      )}
    </section>
  );
}
