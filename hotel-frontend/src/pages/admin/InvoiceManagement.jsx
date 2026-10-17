import { useCallback, useEffect, useState } from 'react';
import StaffLayout from '../../components/StaffLayout';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { listInvoices, voidInvoice } from '../../services/billingService';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { generateInvoicePdf, invoiceNumber, INVOICE_LEGEND } from '../../utils/invoicePdf';
import formatCurrency from '../../utils/formatCurrency';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';

const EMPTY_FILTERS = { type: '', status: '', date_from: '', date_to: '' };

const STATUS_META = {
  issued: { label: 'Emitido', classes: 'bg-[#3F6B4F]/10 text-[#3F6B4F] border-[#3F6B4F]/30' },
  voided: { label: 'Anulado', classes: 'bg-[#ba1a1a]/10 text-[#93000a] border-[#ba1a1a]/30' },
};

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Comprobantes internos (SHE-027): listado, filtros, descarga de PDF y anulación.
 */
export default function InvoiceManagement() {
  const [invoices, setInvoices] = useState([]);
  const [hotel, setHotel] = useState(null);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);

  const [voidTarget, setVoidTarget] = useState(null);
  const [voiding, setVoiding] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listInvoices({ ...filters, search: debouncedSearch, page });
      setInvoices(data?.data || []);
      setHotel(data?.hotel || null);
      setMeta({
        current_page: data?.current_page || 1,
        last_page: data?.last_page || 1,
        total: data?.total || 0,
        from: data?.from || 0,
        to: data?.to || 0,
      });
    } catch (err) {
      logError('invoices:list', err);
      setError(apiErrorMessage(err, 'No se pudieron cargar los comprobantes.'));
    } finally {
      setLoading(false);
    }
  }, [filters, debouncedSearch, page]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearch('');
    setPage(1);
  };

  const handleDownload = async (invoice) => {
    try {
      await generateInvoicePdf({ ...invoice, booking_code: invoice.booking?.booking_code }, hotel);
    } catch (err) {
      logError('invoices:pdf', err);
      setToast({ type: 'error', message: 'No se pudo generar el PDF.' });
    }
  };

  const confirmVoid = async (reason) => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      await voidInvoice(voidTarget.id, reason);
      setToast({ type: 'success', message: `Comprobante ${invoiceNumber(voidTarget)} anulado.` });
      setVoidTarget(null);
      fetchInvoices();
    } catch (err) {
      logError('invoices:void', err);
      setToast({ type: 'error', message: apiErrorMessage(err, 'No se pudo anular el comprobante.') });
    } finally {
      setVoiding(false);
    }
  };

  const hasFilters = search.trim() !== '' || Object.values(filters).some((v) => v !== '');
  const inputClasses = 'w-full bg-white border border-[#d1c5af] px-2 py-1.5 text-sm font-sans focus:border-[#14213d] focus:outline-none';
  const labelClasses = 'block font-mono text-[10px] uppercase font-bold text-[#78716c] mb-1';

  return (
    <StaffLayout>
      <header className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4">
        <p className="text-[10px] font-mono tracking-widest text-[#78716c] uppercase font-bold mb-1">
          Facturación · Administración
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2d2d2a] tracking-tight">Comprobantes</h1>
        <p className="font-sans text-sm text-[#4d4635] mt-1">
          Boletas y facturas internas emitidas por recepción. {INVOICE_LEGEND}.
        </p>
      </header>

      <main className="px-4 sm:px-8 pb-8">
        <section aria-label="Filtros" className="bg-white p-4 mb-6 shadow-sm border border-[#e4e2dd]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <label htmlFor="inv-search" className={labelClasses}>Buscar</label>
              <input
                id="inv-search"
                type="search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="N° (B001-12), cliente, documento o reserva"
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="inv-type" className={labelClasses}>Tipo</label>
              <select id="inv-type" value={filters.type} onChange={(e) => updateFilter('type', e.target.value)} className={inputClasses}>
                <option value="">Todos</option>
                <option value="boleta">Boleta</option>
                <option value="factura">Factura</option>
              </select>
            </div>
            <div>
              <label htmlFor="inv-status" className={labelClasses}>Estado</label>
              <select id="inv-status" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)} className={inputClasses}>
                <option value="">Todos</option>
                <option value="issued">Emitidos</option>
                <option value="voided">Anulados</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="inv-from" className={labelClasses}>Desde</label>
                <input id="inv-from" type="date" value={filters.date_from} onChange={(e) => updateFilter('date_from', e.target.value)} className={inputClasses} />
              </div>
              <div>
                <label htmlFor="inv-to" className={labelClasses}>Hasta</label>
                <input id="inv-to" type="date" value={filters.date_to} min={filters.date_from || undefined} onChange={(e) => updateFilter('date_to', e.target.value)} className={inputClasses} />
              </div>
            </div>
          </div>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="mt-3 font-mono text-[10px] uppercase font-bold tracking-widest text-[#c9a227] hover:text-[#987d35]">
              Limpiar filtros
            </button>
          )}
        </section>

        {error && (
          <div role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-4 mb-6 text-[#93000a] font-mono text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">error</span>
            <span>{error}</span>
          </div>
        )}

        <section className="bg-white shadow-sm border border-[#e4e2dd]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-[#f5f3ee] border-b border-[#d1c5af]">
                <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-[#4d4635]">
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Emisión</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Reserva</th>
                  <th className="px-4 py-3 text-right">Base</th>
                  <th className="px-4 py-3 text-right">IGV</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && invoices.length === 0 && [1, 2, 3, 4].map((i) => (
                  <tr key={`sk-${i}`} className="border-b border-[#e4e2dd]">
                    <td colSpan={9} className="px-4 py-3"><div className="h-4 bg-[#eae8e3] animate-pulse" /></td>
                  </tr>
                ))}
                {!loading && invoices.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center font-mono text-xs text-[#78716c]">
                      No hay comprobantes para los filtros seleccionados.
                    </td>
                  </tr>
                )}
                {invoices.map((inv) => {
                  const status = STATUS_META[inv.status] || STATUS_META.issued;
                  return (
                    <tr key={inv.id} className={`border-b border-[#e4e2dd] align-top hover:bg-[#fbf9f4] ${loading ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-[#14213d] whitespace-nowrap">{invoiceNumber(inv)}</div>
                        <div className="font-mono text-[10px] uppercase text-[#78716c]">{inv.type === 'factura' ? 'Factura' : 'Boleta'}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-[#4d4635]">{formatDateTime(inv.issued_at)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#1b1c19] truncate max-w-[220px]">{inv.customer_name}</div>
                        <div className="font-mono text-[10px] text-[#78716c]">{inv.customer_doc_type} {inv.customer_doc_number}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#4d4635] whitespace-nowrap">{inv.booking?.booking_code || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-right">{formatCurrency(inv.subtotal)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-right">{formatCurrency(inv.igv)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-right font-bold text-[#14213d]">{formatCurrency(inv.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 border font-mono text-[10px] uppercase font-bold tracking-wider ${status.classes}`}>
                          {status.label}
                        </span>
                        {inv.status === 'voided' && inv.voided_reason && (
                          <div className="font-sans text-[11px] text-[#93000a] mt-1 max-w-[180px] break-words">{inv.voided_reason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownload(inv)}
                            className="inline-flex items-center gap-1 px-2 py-1 border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-[10px] uppercase font-bold"
                            aria-label={`Descargar PDF de ${invoiceNumber(inv)}`}
                          >
                            <span className="material-symbols-outlined text-sm" aria-hidden="true">picture_as_pdf</span>
                            PDF
                          </button>
                          {inv.status === 'issued' && (
                            <button
                              type="button"
                              onClick={() => setVoidTarget(inv)}
                              className="inline-flex items-center gap-1 px-2 py-1 border border-[#ba1a1a]/40 hover:bg-[#ffdad6] text-[#93000a] font-mono text-[10px] uppercase font-bold"
                              aria-label={`Anular ${invoiceNumber(inv)}`}
                            >
                              <span className="material-symbols-outlined text-sm" aria-hidden="true">block</span>
                              Anular
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#d1c5af] bg-[#f5f3ee]">
            <p className="font-mono text-[11px] text-[#4d4635]">
              {meta.total > 0 ? `Mostrando ${meta.from}–${meta.to} de ${meta.total} comprobantes` : 'Sin comprobantes'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || meta.current_page <= 1}
                className="px-3 py-1.5 border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-xs uppercase font-bold disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="font-mono text-xs text-[#4d4635]">{meta.current_page} / {meta.last_page}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                disabled={loading || meta.current_page >= meta.last_page}
                className="px-3 py-1.5 border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-xs uppercase font-bold disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>
      </main>

      <ConfirmDialog
        isOpen={!!voidTarget}
        title={`Anular ${voidTarget ? invoiceNumber(voidTarget) : ''}`}
        message="El comprobante quedará anulado (no se reutiliza su número). Luego podrá emitir uno nuevo para la reserva."
        confirmLabel="Anular comprobante"
        variant="danger"
        requireReason
        reasonLabel="Motivo de la anulación"
        busy={voiding}
        onCancel={() => setVoidTarget(null)}
        onConfirm={confirmVoid}
      />

      <Toast message={toast?.message} isOpen={!!toast} type={toast?.type} onClose={() => setToast(null)} />
    </StaffLayout>
  );
}
