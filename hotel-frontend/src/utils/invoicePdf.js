import { HOTEL_NAME, HOTEL_RUC, HOTEL_ADDRESS, HOTEL_PHONE } from '../constants/hotel';
import formatCurrency from './formatCurrency';

/**
 * Representación impresa de un comprobante interno (boleta/factura) — SHE-027.
 * NO es un comprobante electrónico SUNAT.
 */

export const INVOICE_LEGEND = 'Representación impresa de comprobante interno – no válido ante SUNAT';

const TYPE_LABELS = {
  boleta: 'BOLETA DE VENTA',
  factura: 'FACTURA',
};

const DOC_LABELS = {
  DNI: 'DNI',
  RUC: 'RUC',
  CE: 'C.E.',
  PAS: 'Pasaporte',
};

export function invoiceNumber(invoice) {
  if (!invoice) return '';
  if (invoice.full_number) return invoice.full_number;
  return `${invoice.series}-${String(invoice.number ?? '').padStart(8, '0')}`;
}

export function invoiceTypeLabel(type) {
  return TYPE_LABELS[type] || String(type || '').toUpperCase();
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Datos del emisor: parámetro > datos enviados por el backend > constantes del frontend. */
export function resolveHotel(invoice, hotel) {
  const fromApi = invoice?.hotel || {};
  const given = hotel || {};
  return {
    name: given.name || fromApi.name || HOTEL_NAME,
    ruc: given.ruc || fromApi.ruc || HOTEL_RUC,
    address: given.address || fromApi.address || HOTEL_ADDRESS,
    phone: given.phone || fromApi.phone || HOTEL_PHONE,
  };
}

/**
 * Genera (y opcionalmente descarga) el PDF del comprobante.
 * @param {object} invoice Respuesta de la API (items, subtotal, igv, total, series, number, ...)
 * @param {object} [hotel] { name, ruc, address, phone } — opcional
 * @param {{ save?: boolean }} [options] save=false devuelve el documento sin descargarlo
 * @returns {Promise<import('jspdf').jsPDF>}
 *
 * jsPDF y jspdf-autotable se importan bajo demanda (SHE-040) para no inflar el bundle inicial.
 */
export async function generateInvoicePdf(invoice, hotel, { save = true } = {}) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const issuer = resolveHotel(invoice, hotel);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const number = invoiceNumber(invoice);

  // Emisor
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(issuer.name, 14, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(issuer.address || '', 14, 26);
  if (issuer.phone) doc.text(`Tel.: ${issuer.phone}`, 14, 31);

  // Recuadro del comprobante
  const boxX = pageWidth - 84;
  doc.setDrawColor(201, 162, 39);
  doc.setLineWidth(0.6);
  doc.rect(boxX, 12, 70, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`RUC ${issuer.ruc}`, boxX + 35, 19, { align: 'center' });
  doc.text(`${invoiceTypeLabel(invoice.type)} INTERNA`, boxX + 35, 26, { align: 'center' });
  doc.setFontSize(11);
  doc.text(number, boxX + 35, 33, { align: 'center' });

  // Datos del cliente
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  let y = 48;
  const row = (label, value) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value ?? ''), 52, y);
    y += 5;
  };
  row('Fecha de emisión:', formatDate(invoice.issued_at));
  row(invoice.type === 'factura' ? 'Razón social:' : 'Cliente:', invoice.customer_name);
  row(`${DOC_LABELS[invoice.customer_doc_type] || invoice.customer_doc_type}:`, invoice.customer_doc_number);
  if (invoice.customer_address) row('Dirección:', invoice.customer_address);
  if (invoice.booking_code || invoice.booking?.booking_code) row('Reserva:', invoice.booking_code || invoice.booking?.booking_code);
  row('Moneda:', 'Soles (PEN)');

  if (invoice.status === 'voided') {
    doc.setTextColor(186, 26, 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`ANULADO${invoice.voided_reason ? ` — ${invoice.voided_reason}` : ''}`, 14, y + 2);
    doc.setTextColor(0, 0, 0);
    y += 7;
  }

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  autoTable(doc, {
    startY: y + 2,
    head: [['Cant.', 'Descripción', 'P. unit.', 'Valor venta', 'IGV', 'Importe']],
    body: items.map((item) => [
      item.quantity,
      item.description,
      formatCurrency(item.unit_price),
      formatCurrency(item.base),
      formatCurrency(item.igv),
      formatCurrency(item.total),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [20, 33, 61] },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
  });

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY ?? y) + 4,
    margin: { left: pageWidth - 94 },
    tableWidth: 80,
    body: [
      ['Op. gravada (base)', formatCurrency(invoice.subtotal)],
      ['IGV (18%)', formatCurrency(invoice.igv)],
      [{ content: 'IMPORTE TOTAL', styles: { fontStyle: 'bold' } }, { content: formatCurrency(invoice.total), styles: { fontStyle: 'bold' } }],
    ],
    theme: 'plain',
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' } },
  });

  const finalY = (doc.lastAutoTable?.finalY ?? y) + 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Precios con IGV incluido.', 14, finalY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(117, 91, 0);
  doc.text(INVOICE_LEGEND, pageWidth / 2, doc.internal.pageSize.getHeight() - 12, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  if (save) doc.save(`${number || 'comprobante'}.pdf`);
  return doc;
}

export default generateInvoicePdf;
