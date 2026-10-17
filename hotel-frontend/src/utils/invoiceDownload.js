import { generateInvoicePdf } from './invoicePdf';

/**
 * Descarga del comprobante en el portal del cliente: delega en el generador
 * compartido del módulo de facturación (src/utils/invoicePdf.js).
 */
export async function downloadInvoicePdf(invoice, hotel) {
  return generateInvoicePdf(invoice, hotel ?? invoice?.hotel);
}

export default downloadInvoicePdf;
