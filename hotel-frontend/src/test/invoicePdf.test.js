import { describe, it, expect } from 'vitest';
import { generateInvoicePdf, invoiceNumber, invoiceTypeLabel, resolveHotel, INVOICE_LEGEND } from '../utils/invoicePdf';

const invoice = {
  type: 'factura',
  series: 'F001',
  number: 42,
  customer_doc_type: 'RUC',
  customer_doc_number: '20100047218',
  customer_name: 'Empresa Demo SAC',
  customer_address: 'Av. Siempre Viva 123',
  booking_code: 'RES-ABC123',
  issued_at: '2026-10-01T10:00:00Z',
  status: 'voided',
  voided_reason: 'Error en datos',
  subtotal: 254.24,
  igv: 45.76,
  total: 300,
  items: [{ quantity: 1, description: 'Hospedaje 1 noche', unit_price: 300, base: 254.24, igv: 45.76, total: 300 }],
};

describe('utils/invoicePdf', () => {
  it('compone el número de serie con 8 dígitos', () => {
    expect(invoiceNumber(invoice)).toBe('F001-00000042');
    expect(invoiceNumber({ full_number: 'B001-00000007' })).toBe('B001-00000007');
    expect(invoiceNumber(null)).toBe('');
    expect(invoiceTypeLabel('boleta')).toBe('BOLETA DE VENTA');
    expect(invoiceTypeLabel('nota')).toBe('NOTA');
  });

  it('resuelve los datos del emisor con prioridad parámetro > API > constantes', () => {
    const issuer = resolveHotel({ hotel: { name: 'API Hotel', ruc: '20131312955' } }, { name: 'Param Hotel' });
    expect(issuer.name).toBe('Param Hotel');
    expect(issuer.ruc).toBe('20131312955');
    expect(issuer.address).toBeTruthy();
  });

  it('genera el PDF (smoke test con jsPDF) sin descargarlo', async () => {
    const doc = await generateInvoicePdf(invoice, { name: 'Hotel Test', ruc: '20100047218', address: 'Lima' }, { save: false });
    expect(doc.getNumberOfPages()).toBe(1);
    const out = doc.output();
    expect(out.startsWith('%PDF-')).toBe(true);
    expect(out).toContain('F001-00000042');
    expect(out).toContain('ANULADO');
    expect(INVOICE_LEGEND).toMatch(/no válido ante SUNAT/);
  });
});
