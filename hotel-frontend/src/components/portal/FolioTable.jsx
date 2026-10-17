import formatCurrency from '../../utils/formatCurrency';
import { formatDmy } from '../../utils/dates';

const PAYMENT_STATUS = {
  completed: 'Pagado',
  pending: 'Pendiente',
  failed: 'Rechazado',
  cancelled: 'Anulado',
  refund_pending: 'Reembolso pendiente',
  refunded: 'Reembolsado',
};

function methodLabel(p) {
  const m = String(p.payment_method || '').toLowerCase();
  const base = m === 'card' || m === 'tarjeta' ? 'Tarjeta' : m === 'cash' || m === 'efectivo' ? 'Efectivo' : p.payment_method || '—';
  return p.last4 ? `${base} •••• ${p.last4}` : base;
}

/**
 * Estado de cuenta del huésped: alojamiento + consumos, pagos y reembolsos.
 */
export default function FolioTable({ folio }) {
  if (!folio) return null;
  const { charges = [], payments = [], refunds = [], totals = {}, booking = {} } = folio;

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto border border-[#d1c5af]">
        <table className="w-full text-sm">
          <caption className="sr-only">Cargos de la reserva</caption>
          <thead className="bg-[#f5f3ee]">
            <tr className="font-mono text-[10px] uppercase tracking-wider text-[#4d4635]">
              <th scope="col" className="text-left px-3 py-2">Fecha</th>
              <th scope="col" className="text-left px-3 py-2">Concepto</th>
              <th scope="col" className="text-right px-3 py-2">Cant.</th>
              <th scope="col" className="text-right px-3 py-2">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eae8e3]">
            <tr>
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{formatDmy(booking.check_in)}</td>
              <td className="px-3 py-2">Alojamiento ({booking.nights} {booking.nights === 1 ? 'noche' : 'noches'})</td>
              <td className="px-3 py-2 text-right font-mono">1</td>
              <td className="px-3 py-2 text-right font-mono">{formatCurrency(totals.lodging)}</td>
            </tr>
            {charges.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{formatDmy(c.date)}</td>
                <td className="px-3 py-2 break-words">{c.concept}</td>
                <td className="px-3 py-2 text-right font-mono">{c.quantity}</td>
                <td className="px-3 py-2 text-right font-mono">{formatCurrency(c.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-[#fbf9f4] font-mono text-xs">
            <tr>
              <td colSpan={3} className="px-3 py-1.5 text-right text-[#4d4635]">Base imponible</td>
              <td className="px-3 py-1.5 text-right">{formatCurrency(totals.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="px-3 py-1.5 text-right text-[#4d4635]">IGV (18%, incluido)</td>
              <td className="px-3 py-1.5 text-right">{formatCurrency(totals.igv)}</td>
            </tr>
            <tr className="font-bold text-sm text-[#14213d] border-t border-[#d1c5af]">
              <td colSpan={3} className="px-3 py-2 text-right">Total</td>
              <td className="px-3 py-2 text-right">{formatCurrency(totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="overflow-x-auto border border-[#d1c5af]">
        <table className="w-full text-sm">
          <caption className="sr-only">Pagos y reembolsos</caption>
          <thead className="bg-[#f5f3ee]">
            <tr className="font-mono text-[10px] uppercase tracking-wider text-[#4d4635]">
              <th scope="col" className="text-left px-3 py-2">Fecha</th>
              <th scope="col" className="text-left px-3 py-2">Movimiento</th>
              <th scope="col" className="text-left px-3 py-2">Estado</th>
              <th scope="col" className="text-right px-3 py-2">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eae8e3]">
            {payments.length === 0 && refunds.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-[#4d4635]">Sin pagos registrados.</td></tr>
            )}
            {payments.map((p) => (
              <tr key={`p-${p.id}`}>
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{formatDmy(p.paid_at || p.created_at)}</td>
                <td className="px-3 py-2">
                  Pago — {methodLabel(p)}
                  {p.receipt_number && <span className="block font-mono text-[10px] text-[#4d4635]">{p.receipt_number}</span>}
                </td>
                <td className="px-3 py-2 text-xs">{PAYMENT_STATUS[p.status] || p.status}</td>
                <td className="px-3 py-2 text-right font-mono">{formatCurrency(p.amount)}</td>
              </tr>
            ))}
            {refunds.map((r) => (
              <tr key={`r-${r.id}`} className="text-[#755b00]">
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{formatDmy(r.created_at)}</td>
                <td className="px-3 py-2">Reembolso{r.reason ? ` — ${r.reason}` : ''}</td>
                <td className="px-3 py-2 text-xs">{PAYMENT_STATUS[r.status] || r.status}</td>
                <td className="px-3 py-2 text-right font-mono">−{formatCurrency(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-[#f5f3ee] border border-[#d1c5af] p-3">
          <dt className="font-mono text-[10px] uppercase text-[#4d4635]">Pagado</dt>
          <dd className="font-mono font-bold text-[#3F6B4F]">{formatCurrency(totals.pagado)}</dd>
        </div>
        <div className="bg-[#f5f3ee] border border-[#d1c5af] p-3">
          <dt className="font-mono text-[10px] uppercase text-[#4d4635]">Reembolsos</dt>
          <dd className="font-mono font-bold text-[#755b00]">{formatCurrency(totals.refunds)}</dd>
        </div>
        <div className="bg-[#f5f3ee] border border-[#d1c5af] p-3">
          <dt className="font-mono text-[10px] uppercase text-[#4d4635]">Saldo</dt>
          <dd className={`font-mono font-bold ${Number(totals.saldo) > 0 ? 'text-[#ba1a1a]' : 'text-[#14213d]'}`}>{formatCurrency(totals.saldo)}</dd>
        </div>
      </dl>
    </div>
  );
}
