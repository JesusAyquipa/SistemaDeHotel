/**
 * Marcas del huésped (SHE-033): estrella VIP y aviso de lista negra.
 * Acepta tanto el formato del huésped (is_vip / is_blacklisted) como el del rack (vip / blacklisted).
 */
function isVip(entity) {
  return !!(entity?.is_vip ?? entity?.vip);
}

function isBlacklisted(entity) {
  return !!(entity?.is_blacklisted ?? entity?.blacklisted);
}

export function VipStar({ className = 'text-base' }) {
  return (
    <span
      className={`material-symbols-outlined text-[#c9a227] align-middle ${className}`}
      style={{ fontVariationSettings: "'FILL' 1" }}
      role="img"
      aria-label="Huésped VIP"
      title="Huésped VIP"
    >
      star
    </span>
  );
}

export default function GuestFlags({ guest, compact = false, showReason = false }) {
  const vip = isVip(guest);
  const blacklisted = isBlacklisted(guest);
  if (!vip && !blacklisted) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      {vip && (compact ? <VipStar className="text-sm" /> : (
        <span className="inline-flex items-center gap-0.5 bg-[#fff8e1] border border-[#c9a227] text-[#755b00] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider">
          <VipStar className="text-xs" /> VIP
        </span>
      ))}
      {blacklisted && (
        <span
          className="inline-flex items-center gap-0.5 bg-[#ffdad6] border border-[#ba1a1a] text-[#93000a] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
          title={guest?.blacklist_reason || 'Huésped en lista negra'}
        >
          <span className="material-symbols-outlined text-xs" aria-hidden="true">block</span>
          {compact ? <span className="sr-only">Lista negra</span> : 'Lista negra'}
          {showReason && guest?.blacklist_reason ? `: ${guest.blacklist_reason}` : ''}
        </span>
      )}
    </span>
  );
}
