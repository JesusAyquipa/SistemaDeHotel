import { useState, useEffect } from 'react';
import { fetchReceipt } from '../services/paymentService';

/**
 * Componente modal para visualizar e imprimir el Comprobante Digital de Pago (Voucher / Recibo).
 */
export default function PaymentReceiptModal({ bookingCode, onClose }) {
  const [receiptData, setReceiptData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadReceipt = async () => {
      try {
        setLoading(true);
        const data = await fetchReceipt(bookingCode);
        if (isMounted) {
          setReceiptData(data.receipt);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error al cargar comprobante:', err);
          const msg = err.response?.data?.message || 'No se pudo obtener el comprobante de pago.';
          setError(msg);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (bookingCode) {
      loadReceipt();
    }
    return () => { isMounted = false; };
  }, [bookingCode]);

  const handleCopyCode = () => {
    if (bookingCode) {
      navigator.clipboard.writeText(bookingCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#14213d]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn print:p-0 print:bg-white">
      <div className="bg-[#fbf9f4] border-2 border-[#c9a227] shadow-[6px_6px_0px_#14213d] max-w-2xl w-full flex flex-col overflow-hidden print:shadow-none print:border-none print:max-w-none">
        
        {/* Modal Header (Oculto al imprimir) */}
        <div className="bg-[#14213d] text-[#fbf9f4] p-5 text-center border-b border-[#c9a227] relative print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-[#d1c5af] hover:text-white transition-colors cursor-pointer"
            title="Cerrar"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#c9a227]/20 border border-[#c9a227] mb-2">
            <span className="material-symbols-outlined text-2xl text-[#c9a227]">
              verified
            </span>
          </div>
          
          <span className="font-mono text-[10px] text-[#c9a227] uppercase tracking-widest block font-bold">
            Comprobante Electrónico de Pago
          </span>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#fbf9f4]">
            Sheraton Lima Hotel & Convention Center
          </h2>
        </div>

        {/* Indicador de Carga */}
        {loading && (
          <div className="p-12 text-center font-mono text-xs text-[#4d4635] space-y-3">
            <span className="material-symbols-outlined text-3xl animate-spin text-[#c9a227]">
              progress_activity
            </span>
            <p>Generando comprobante de pago digital...</p>
          </div>
        )}

        {/* Mensaje de Error */}
        {!loading && error && (
          <div className="p-8 text-center space-y-4">
            <div className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-4 text-[#93000a] font-mono text-xs inline-block text-left">
              <p className="font-bold">{error}</p>
            </div>
            <div>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#14213d] text-[#fbf9f4] font-mono text-xs uppercase font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Cuerpo del Comprobante (Imprimible) */}
        {!loading && receiptData && (
          <div className="p-6 space-y-6 bg-[#fbf9f4] text-[#1b1c19]">

            {/* Cabecera Imprimible del Hotel */}
            <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-[#14213d] pb-4 gap-4">
              <div>
                <h1 className="font-serif text-xl font-bold text-[#14213d]">
                  {receiptData.hotel?.name}
                </h1>
                <p className="font-mono text-[11px] text-[#4d4635]">
                  {receiptData.hotel?.address}
                </p>
                <p className="font-mono text-[11px] text-[#78716c]">
                  RUC: {receiptData.hotel?.ruc} • Tel: {receiptData.hotel?.phone}
                </p>
              </div>

              <div className="bg-[#f5f3ee] border-2 border-[#c9a227] p-3 text-right font-mono text-xs w-full sm:w-auto">
                <span className="text-[10px] font-bold text-[#755b00] uppercase block">
                  COMPROBANTE DE PAGO
                </span>
                <span className="font-bold text-sm text-[#14213d] block">
                  {receiptData.receipt_number}
                </span>
                <span className="text-[10px] text-[#78716c] block">
                  Fecha: {new Date(receiptData.issued_at).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Código Único de Reserva Destacado */}
            <div className="bg-[#f5f3ee] border-2 border-dashed border-[#c9a227] p-4 text-center">
              <span className="font-mono text-[10px] uppercase font-bold text-[#755b00] tracking-widest block mb-1">
                CÓDIGO ÚNICO DE RESERVA (CHECK-IN)
              </span>
              <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[#14213d] tracking-wider">
                {receiptData.booking_code}
              </div>
              <div className="mt-1 print:hidden">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="font-mono text-[11px] text-[#14213d] hover:text-[#755b00] underline font-semibold cursor-pointer inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-xs">
                    {copiedCode ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedCode ? '¡Copiado!' : 'Copiar Código'}</span>
                </button>
              </div>
            </div>

            {/* Grid 2 Columnas: Huésped & Estadía */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              
              {/* Datos del Huésped */}
              <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4 space-y-1.5">
                <span className="text-[10px] font-bold text-[#755b00] uppercase block border-b border-[#d1c5af] pb-1">
                  Datos del Huésped
                </span>
                <p className="font-bold text-sm text-[#1b1c19]">{receiptData.guest?.name}</p>
                <p className="text-[11px] text-[#4d4635]">
                  {receiptData.guest?.document_type}: {receiptData.guest?.document_number}
                </p>
                <p className="text-[11px] text-[#4d4635]">{receiptData.guest?.email}</p>
                {receiptData.guest?.phone && (
                  <p className="text-[11px] text-[#4d4635]">Tel: {receiptData.guest?.phone}</p>
                )}
              </div>

              {/* Detalles de Estadía y Habitación */}
              <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4 space-y-1.5">
                <span className="text-[10px] font-bold text-[#755b00] uppercase block border-b border-[#d1c5af] pb-1">
                  Detalles de Estadía
                </span>
                <p className="font-bold text-sm text-[#1b1c19]">
                  {receiptData.room?.name} (Hab. {receiptData.room?.room_number})
                </p>
                <p className="text-[11px] text-[#4d4635]">
                  Check-In: <span className="font-bold">{receiptData.stay?.check_in}</span>
                </p>
                <p className="text-[11px] text-[#4d4635]">
                  Check-Out: <span className="font-bold">{receiptData.stay?.check_out}</span>
                </p>
                <p className="text-[11px] text-[#4d4635]">
                  Duración: {receiptData.stay?.nights} {receiptData.stay?.nights === 1 ? 'Noche' : 'Noches'}
                </p>
              </div>

            </div>

            {/* Tabla / Desglose de Transacción */}
            <div className="border border-[#d1c5af] overflow-hidden">
              <table className="w-full font-mono text-xs text-left">
                <thead className="bg-[#14213d] text-[#fbf9f4]">
                  <tr>
                    <th className="p-2.5 font-bold uppercase text-[10px]">Concepto</th>
                    <th className="p-2.5 font-bold uppercase text-[10px] text-center">Noches</th>
                    <th className="p-2.5 font-bold uppercase text-[10px] text-right">Precio/Noche</th>
                    <th className="p-2.5 font-bold uppercase text-[10px] text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d1c5af] bg-[#fbf9f4]">
                  <tr>
                    <td className="p-2.5 font-sans">
                      Alojamiento en {receiptData.room?.name} (Hab. {receiptData.room?.room_number})
                    </td>
                    <td className="p-2.5 text-center">{receiptData.stay?.nights}</td>
                    <td className="p-2.5 text-right">S/ {Number(receiptData.stay?.price_per_night).toFixed(2)}</td>
                    <td className="p-2.5 text-right font-bold">
                      S/ {(receiptData.stay?.nights * Number(receiptData.stay?.price_per_night)).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-[#f5f3ee] border-t-2 border-[#14213d]">
                  <tr>
                    <td colSpan="3" className="p-2.5 text-right font-serif font-bold text-sm text-[#14213d]">
                      TOTAL PAGADO (IGV Incluido):
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-base text-[#14213d] bg-[#c9a227]/20 border border-[#c9a227]">
                      S/ {Number(receiptData.payment?.amount).toFixed(2)} {receiptData.payment?.currency}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Información de Pago Seguro & Transacción */}
            <div className="bg-[#f5f3ee] border border-[#c9a227]/60 p-4 font-mono text-[11px] text-[#4d4635] space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-[#d1c5af] pb-2">
                <div>
                  <span className="text-[9px] uppercase font-bold text-[#78716c] block">Estado de Transacción</span>
                  <span className="inline-flex items-center gap-1 bg-[#14213d] text-[#fbf9f4] px-2 py-0.5 font-bold text-[10px] uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c9a227]" />
                    PAGO COMPLETADO Y VERIFICADO
                  </span>
                </div>

                <div>
                  <span className="text-[9px] uppercase font-bold text-[#78716c] block">Método / Tarjeta</span>
                  <span className="font-bold text-[#1b1c19]">
                    {receiptData.payment?.brand || 'Tarjeta'} •••• {receiptData.payment?.last4 || '****'}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] uppercase font-bold text-[#78716c] block">ID Transacción Pasarela</span>
                  <span className="font-bold text-[#1b1c19] text-[10px] font-mono">
                    {receiptData.transaction_id}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-[#78716c] italic text-center pt-1">
                Este comprobante digital valida la confirmación y pago de tu estadía. Presenta este documento o tu código de reserva en recepción.
              </p>
            </div>

          </div>
        )}

        {/* Footer con Acciones (Oculto al imprimir) */}
        {!loading && receiptData && (
          <div className="bg-[#f5f3ee] border-t border-[#d1c5af] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="w-full sm:w-auto px-5 py-2.5 bg-transparent border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-xs uppercase font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>Imprimir / Descargar PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#c9a227] hover:bg-[#b08b1a] text-[#14213d] font-mono text-xs uppercase font-bold border border-[#14213d] shadow-[2px_2px_0px_#14213d] cursor-pointer transition-all flex items-center justify-center gap-1"
            >
              <span>Volver al Catálogo</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
