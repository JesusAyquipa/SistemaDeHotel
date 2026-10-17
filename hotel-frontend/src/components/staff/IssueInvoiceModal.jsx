import { useId, useState } from 'react';
import useEscapeKey from '../../hooks/useEscapeKey';
import { issueInvoice } from '../../services/billingService';
import { DOC_TYPES, documentError } from '../../utils/peruDocuments';
import { generateInvoicePdf, invoiceNumber } from '../../utils/invoicePdf';
import formatCurrency from '../../utils/formatCurrency';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';

function initialForm(booking) {
  const guest = booking?.guest || {};
  const docType = DOC_TYPES.some((d) => d.value === guest.document_type) ? guest.document_type : 'DNI';
  return {
    type: 'boleta',
    customer_doc_type: docType === 'RUC' ? 'DNI' : docType,
    customer_doc_number: docType === 'RUC' ? '' : (guest.document_number || ''),
    customer_name: [guest.name, guest.surname].filter(Boolean).join(' '),
    customer_address: guest.address || '',
  };
}

/**
 * Emisión de comprobante interno (boleta/factura) para una reserva — SHE-027.
 * Props: isOpen, booking ({id, booking_code, guest?}), onClose(), onIssued(invoice)
 */
export default function IssueInvoiceModal({ isOpen, booking, onClose, onIssued }) {
  const titleId = useId();
  const [form, setForm] = useState(() => initialForm(booking));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState(null);

  // Reinicia el formulario solo al abrir o cambiar de reserva (no en cada render del padre).
  const openKey = isOpen && booking ? String(booking.id) : null;
  const [lastOpenKey, setLastOpenKey] = useState(null);
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    if (openKey !== null) {
      setForm(initialForm(booking));
      setErrors({});
      setServerError('');
      setIssued(null);
    }
  }

  useEscapeKey(() => { if (!busy) onClose(); }, !!isOpen);

  if (!isOpen || !booking) return null;

  const isFactura = form.type === 'factura';
  const docOptions = isFactura ? DOC_TYPES.filter((d) => d.value === 'RUC') : DOC_TYPES;

  const setType = (type) => {
    setForm((prev) => ({
      ...prev,
      type,
      customer_doc_type: type === 'factura' ? 'RUC' : (prev.customer_doc_type === 'RUC' ? 'DNI' : prev.customer_doc_type),
      customer_doc_number: type === 'factura' || prev.customer_doc_type === 'RUC' ? '' : prev.customer_doc_number,
      customer_name: type === 'factura' ? '' : (prev.customer_name || initialForm(booking).customer_name),
    }));
    setErrors({});
  };

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    const docErr = documentError(form.customer_doc_type, form.customer_doc_number);
    if (docErr) next.customer_doc_number = docErr;
    if (isFactura && form.customer_doc_type !== 'RUC') next.customer_doc_type = 'La factura requiere RUC.';
    if (!form.customer_name.trim()) next.customer_name = isFactura ? 'Ingrese la razón social.' : 'Ingrese el nombre del cliente.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setServerError('');
    try {
      const invoice = await issueInvoice(booking.id, {
        type: form.type,
        customer_doc_type: form.customer_doc_type,
        customer_doc_number: form.customer_doc_number.trim(),
        customer_name: form.customer_name.trim(),
        customer_address: form.customer_address.trim() || undefined,
      });
      setIssued(invoice);
      if (onIssued) onIssued(invoice);
    } catch (err) {
      logError('invoice:issue', err);
      const apiErrors = err?.response?.data?.errors;
      if (apiErrors) {
        setErrors(Object.fromEntries(Object.entries(apiErrors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
      }
      setServerError(apiErrorMessage(err, 'No se pudo emitir el comprobante.'));
    } finally {
      setBusy(false);
    }
  };

  const inputClasses = 'w-full bg-white border border-[#d1c5af] px-3 py-2 text-sm font-sans focus:border-[#14213d] focus:outline-none';
  const labelClasses = 'block font-mono text-[10px] uppercase font-bold text-[#78716c] mb-1';
  const errorClasses = 'mt-1 font-mono text-[11px] text-[#93000a]';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#14213d]/80 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-[#fbf9f4] max-w-lg w-full border border-[#d1c5af] shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-[#d1c5af] flex justify-between items-center bg-[#eae8e3]">
          <div>
            <h2 id={titleId} className="font-serif text-xl font-bold text-[#14213d]">Emitir comprobante</h2>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">Reserva {booking.booking_code}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="text-[#4d4635] hover:text-[#1b1c19]" aria-label="Cerrar">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        {issued ? (
          <div className="p-6 text-center">
            <span className="material-symbols-outlined text-5xl text-[#3F6B4F]" aria-hidden="true">receipt_long</span>
            <h3 className="font-serif text-2xl font-bold text-[#1b1c19] mt-2">{invoiceNumber(issued)}</h3>
            <p className="font-sans text-sm text-[#4d4635] mt-1">
              {issued.type === 'factura' ? 'Factura' : 'Boleta'} emitida por {formatCurrency(issued.total)}
            </p>
            <p className="font-mono text-[10px] text-[#78716c] mt-2">Comprobante interno – no válido ante SUNAT.</p>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-[#eae8e3] text-[#14213d] font-mono text-xs uppercase font-bold hover:bg-[#d1c5af]">
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => generateInvoicePdf(issued).catch((err) => logError('invoices:pdf', err))}
                className="flex-1 px-4 py-2 bg-[#14213d] text-[#fbf9f4] border border-[#c9a227] font-mono text-xs uppercase font-bold hover:bg-[#0a1628] inline-flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">download</span>
                Descargar PDF
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
            <fieldset>
              <legend className={labelClasses}>Tipo de comprobante</legend>
              <div className="grid grid-cols-2 border border-[#d1c5af]" role="radiogroup">
                {[{ value: 'boleta', label: 'Boleta' }, { value: 'factura', label: 'Factura' }].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={form.type === opt.value}
                    onClick={() => setType(opt.value)}
                    className={`py-2 font-mono text-xs uppercase font-bold tracking-wider transition-colors ${form.type === opt.value ? 'bg-[#14213d] text-[#fbf9f4]' : 'bg-white text-[#4d4635] hover:bg-[#eae8e3]'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="inv-doc-type" className={labelClasses}>Documento</label>
                <select
                  id="inv-doc-type"
                  value={form.customer_doc_type}
                  onChange={(e) => update('customer_doc_type', e.target.value)}
                  disabled={isFactura}
                  className={inputClasses}
                >
                  {docOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                {errors.customer_doc_type && <p className={errorClasses}>{errors.customer_doc_type}</p>}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="inv-doc-number" className={labelClasses}>Número</label>
                <input
                  id="inv-doc-number"
                  value={form.customer_doc_number}
                  onChange={(e) => update('customer_doc_number', e.target.value.replace(/\s/g, ''))}
                  inputMode={['DNI', 'RUC'].includes(form.customer_doc_type) ? 'numeric' : 'text'}
                  maxLength={form.customer_doc_type === 'RUC' ? 11 : form.customer_doc_type === 'DNI' ? 8 : 15}
                  aria-invalid={!!errors.customer_doc_number}
                  className={inputClasses}
                  placeholder={form.customer_doc_type === 'RUC' ? '20XXXXXXXXX' : ''}
                />
                {errors.customer_doc_number && <p className={errorClasses}>{errors.customer_doc_number}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="inv-name" className={labelClasses}>{isFactura ? 'Razón social' : 'Nombre del cliente'}</label>
              <input
                id="inv-name"
                value={form.customer_name}
                onChange={(e) => update('customer_name', e.target.value)}
                maxLength={200}
                aria-invalid={!!errors.customer_name}
                className={inputClasses}
              />
              {errors.customer_name && <p className={errorClasses}>{errors.customer_name}</p>}
            </div>

            <div>
              <label htmlFor="inv-address" className={labelClasses}>Dirección {isFactura ? '(fiscal)' : '(opcional)'}</label>
              <input
                id="inv-address"
                value={form.customer_address}
                onChange={(e) => update('customer_address', e.target.value)}
                maxLength={255}
                className={inputClasses}
              />
            </div>

            <p className="font-mono text-[10px] text-[#78716c]">
              Incluye hospedaje y consumos registrados. Precios con IGV (18%) incluido. Comprobante interno – no se envía a SUNAT.
            </p>

            {serverError && (
              <div role="alert" className="bg-[#ffdad6] text-[#93000a] p-3 text-xs font-mono font-bold border border-[#ba1a1a]/30">
                {serverError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} disabled={busy} className="flex-1 px-4 py-2 bg-[#eae8e3] text-[#14213d] font-mono text-xs uppercase font-bold hover:bg-[#d1c5af] disabled:opacity-50">
                Ahora no
              </button>
              <button type="submit" disabled={busy} className="flex-1 px-4 py-2 bg-[#c9a227] text-[#4b3a00] font-mono text-xs uppercase font-bold hover:bg-[#b8921f] disabled:opacity-50">
                {busy ? 'Emitiendo...' : `Emitir ${isFactura ? 'factura' : 'boleta'}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
