import { useState } from 'react';

export default function BookingSuccessModal({ bookingResult, onClose }) {
  const [copied, setCopied] = useState(false);
  const booking = bookingResult?.booking;
  const bookingCode = bookingResult?.booking_code || booking?.booking_code;
  const guest = booking?.guest;
  const room = booking?.room;
  const summary = bookingResult?.summary;

  const handleCopyCode = () => {
    if (bookingCode) {
      navigator.clipboard.writeText(bookingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#14213d]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-[#fbf9f4] border-2 border-[#c9a227] shadow-[6px_6px_0px_#14213d] max-w-2xl w-full flex flex-col overflow-hidden">
        
        {/* Header con Sello de Confirmación */}
        <div className="bg-[#14213d] text-[#fbf9f4] p-6 text-center border-b border-[#c9a227] relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#c9a227]/20 border-2 border-[#c9a227] mb-3">
            <span className="material-symbols-outlined text-3xl text-[#c9a227]">
              check_circle
            </span>
          </div>
          <span className="font-mono text-xs text-[#c9a227] uppercase tracking-widest block mb-1 font-bold">
            Sheraton Lima • Comprobante de Reserva
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#fbf9f4]">
            ¡Tu Reserva ha sido Confirmada!
          </h2>
          <p className="font-sans text-xs text-[#d1c5af] mt-1 max-w-md mx-auto">
            Hemos registrado tu estadía con éxito. Guarda el siguiente código único para tu check-in en el hotel.
          </p>
        </div>

        {/* Cuerpo del Voucher */}
        <div className="p-6 space-y-6">

          {/* Caja del Código de Reserva Único */}
          <div className="bg-[#f5f3ee] border-2 border-dashed border-[#c9a227] p-5 text-center relative">
            <span className="font-mono text-[11px] uppercase font-bold text-[#755b00] tracking-widest block mb-1">
              Código Único de Reserva
            </span>
            <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[#14213d] tracking-wider selection:bg-[#c9a227]">
              {bookingCode}
            </div>

            <div className="mt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 font-mono text-xs text-[#14213d] hover:text-[#755b00] underline font-semibold cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {copied ? 'check' : 'content_copy'}
                </span>
                <span>{copied ? '¡Copiado!' : 'Copiar Código'}</span>
              </button>
            </div>
          </div>

          {/* Detalles del Comprobante */}
          <div className="bg-[#f5f3ee] border border-[#d1c5af] p-5 space-y-4">
            
            {/* Habitación y Estado */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-[#d1c5af] gap-2">
              <div>
                <span className="font-mono text-[10px] text-[#755b00] uppercase font-bold">Habitación Seleccionada</span>
                <h3 className="font-serif text-lg font-bold text-[#1b1c19]">
                  {room?.name} (Hab. {room?.room_number})
                </h3>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-[#14213d] text-[#fbf9f4] px-3 py-1 font-mono text-xs font-bold uppercase">
                <span className="w-2 h-2 rounded-full bg-[#c9a227] animate-pulse"></span>
                <span>Estado: Reservada</span>
              </div>
            </div>

            {/* Grid de Datos Clave */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs text-[#4d4635]">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#78716c] block">Huésped Titular</span>
                <span className="font-bold text-[#1b1c19] text-sm">
                  {guest?.name} {guest?.surname}
                </span>
                <span className="block text-[11px]">{guest?.document_type}: {guest?.document_number}</span>
                <span className="block text-[11px]">{guest?.email}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-[#78716c] block">Fechas de Estadía</span>
                <span className="font-bold text-[#1b1c19] text-sm">
                  {booking?.check_in} al {booking?.check_out}
                </span>
                <span className="block text-[11px]">
                  {summary?.nights || 1} {(summary?.nights || 1) === 1 ? 'Noche' : 'Noches'} de estadía
                </span>
                <span className="block text-[11px]">Capacidad: {room?.capacity} personas</span>
              </div>
            </div>

            {/* Total Pagado / Confirmado */}
            <div className="border-t border-[#d1c5af] pt-3 flex justify-between items-center">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#78716c] block">Monto Total de la Reserva</span>
                <span className="font-mono text-xs text-[#755b00] font-semibold">Impuestos (IGV) incluidos</span>
              </div>
              <span className="font-mono text-xl font-bold text-[#14213d] bg-[#c9a227]/20 px-3 py-1 border border-[#c9a227]">
                S/ {Number(booking?.total_amount || 0).toFixed(2)}
              </span>
            </div>

          </div>

        </div>

        {/* Footer / Acciones */}
        <div className="bg-[#f5f3ee] border-t border-[#d1c5af] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto px-4 py-2.5 bg-transparent border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-xs uppercase font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <span className="material-symbols-outlined text-base">print</span>
            <span>Imprimir Comprobante</span>
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

      </div>
    </div>
  );
}
