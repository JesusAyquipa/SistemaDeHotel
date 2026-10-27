import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import StaffLayout from '../../components/StaffLayout';
import { getRoomDetails } from '../../services/roomStaffService';
import AddChargeModal from '../../components/staff/AddChargeModal';
import ProcessPaymentModal from '../../components/staff/ProcessPaymentModal';
import Toast from '../../components/Toast';
import IssueInvoiceModal from '../../components/staff/IssueInvoiceModal';
import api from '../../services/api';
import formatCurrency, { includedIgv } from '../../utils/formatCurrency';
import { nightsBetween } from '../../utils/dates';
import {
  ACTIVE_STATUSES,
  BOOKING_STATUS,
  bookingStatusLabel,
  bookingStatusBadge,
} from '../../utils/bookingStatus';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';

// Pagos que cuentan como cobrados (los reembolsos/pendientes/fallidos no suman)
const isCountedPayment = (p) => !p.status || p.status === 'completed';

/**
 * Totales del folio. Política: los precios YA incluyen 18% de IGV.
 * Si el backend envía `totals`, se usan tal cual; si no, se calculan igual que en el servidor.
 */
function computeTotals(booking, charges, payments, serverTotals) {
  if (serverTotals) {
    const total = Number(serverTotals.total) || 0;
    return {
      lodging: Number(serverTotals.lodging) || 0,
      charges: Number(serverTotals.charges) || 0,
      total,
      igv: Number(serverTotals.igv ?? includedIgv(total)),
      paid: Number(serverTotals.pagado ?? serverTotals.paid ?? 0),
      balance: Math.max(0, Number(serverTotals.saldo ?? serverTotals.balance ?? 0)),
    };
  }
  const lodging = Number(booking?.total_amount) || 0;
  const chargesTotal = charges.reduce((acc, c) => acc + (parseFloat(c.total) || 0), 0);
  const total = lodging + chargesTotal;
  const paid = payments.filter(isCountedPayment).reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  return {
    lodging,
    charges: chargesTotal,
    total,
    igv: includedIgv(total),
    paid,
    balance: Math.max(0, total - paid),
  };
}

export default function RoomAccount() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [room, setRoom] = useState(null);
  const [activeBooking, setActiveBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [charges, setCharges] = useState([]);
  const [payments, setPayments] = useState([]);
  const [serverTotals, setServerTotals] = useState(null);

  const [isAddChargeOpen, setIsAddChargeOpen] = useState(false);
  const [isProcessPaymentOpen, setIsProcessPaymentOpen] = useState(false);
  const [toast, setToast] = useState(null);
  // SHE-027: emisión de comprobante interno de la cuenta
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);

  const notify = (message, type = 'success') => setToast({ message, type });

  const loadFolio = useCallback(async (bookingId) => {
    try {
      const res = await api.get(`/staff/bookings/${bookingId}/charges`);
      setCharges(res.data.charges || []);
      setPayments(res.data.payments || []);
      setServerTotals(res.data.totals || null);
    } catch (err) {
      logError('folio:charges', err);
      setCharges([]);
      setPayments([]);
      setServerTotals(null);
      setToast({ type: 'error', message: apiErrorMessage(err, 'No se pudieron cargar los consumos de la cuenta.') });
    }
  }, []);

  const handleSelectBooking = async (b) => {
    if (!b || b.id === activeBooking?.id) return;
    setActiveBooking(b);
    setSearchParams({ booking_id: b.id }, { replace: true });
    await loadFolio(b.id);
  };

  useEffect(() => {
    let cancelled = false;
    const fetchRoom = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const data = await getRoomDetails(id);
        if (cancelled) return;
        setRoom(data.room);

        const bookingsList = data.room?.bookings || [];
        const queryBookingId = searchParams.get('booking_id');
        const queryBookingCode = searchParams.get('booking_code');

        let target = null;
        if (queryBookingId) {
          target = bookingsList.find((b) => String(b.id) === String(queryBookingId)) || null;
        } else if (queryBookingCode) {
          target = bookingsList.find((b) => b.booking_code === queryBookingCode) || null;
        }

        if (!target) {
          // Prioridad:
          // 1. Huésped actualmente en la habitación (checked_in)
          // 2. Próxima reserva confirmada activa (confirmed)
          // 3. Cualquier estado activo
          // 4. Primera reserva disponible
          target = bookingsList.find((b) => b.status === BOOKING_STATUS.CHECKED_IN)
            || bookingsList.find((b) => b.status === BOOKING_STATUS.CONFIRMED)
            || bookingsList.find((b) => ACTIVE_STATUSES.includes(b.status))
            || bookingsList[0]
            || null;
        }

        setActiveBooking(target);
        if (target) await loadFolio(target.id);
      } catch (err) {
        logError('folio:room', err);
        if (!cancelled) setLoadError(apiErrorMessage(err, 'No se pudo cargar la habitación.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRoom();
    return () => { cancelled = true; };
  }, [id, loadFolio]);

  if (loading) {
    return (
      <StaffLayout className="bg-[#e5e4de]" contentClassName="bg-[#e5e4de]">
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-[#78716c] animate-pulse">Cargando detalles...</p>
        </div>
      </StaffLayout>
    );
  }

  if (!room) {
    return (
      <StaffLayout className="bg-[#e5e4de]" contentClassName="bg-[#e5e4de]">
        <div className="flex-1 flex items-center justify-center flex-col gap-4 p-4 text-center">
          <p className="font-serif text-2xl">{loadError || 'Habitación no encontrada'}</p>
          <Link to="/recepcionista/habitaciones" className="text-[#987d35] underline font-mono">Volver</Link>
        </div>
      </StaffLayout>
    );
  }

  // Cargo base: tarifa total de la estadía (todas las noches), nunca una sola noche
  const nights = activeBooking ? nightsBetween(activeBooking.check_in, activeBooking.check_out) : 0;
  const baseCharge = activeBooking ? {
    id: 'base',
    date: activeBooking.check_in,
    concept: `Tarifa de Habitación (${nights} ${nights === 1 ? 'noche' : 'noches'})`,
    quantity: nights || 1,
    unit_price: nights > 0 ? Number(activeBooking.total_amount) / nights : Number(activeBooking.total_amount),
    total: Number(activeBooking.total_amount) || 0,
  } : null;
  const rows = baseCharge ? [baseCharge, ...charges] : charges;

  const totals = computeTotals(activeBooking, charges, payments, serverTotals);

  const handleAddCharge = async (newCharge) => {
    if (!activeBooking) {
      notify('No hay reserva activa para cargar el consumo.', 'error');
      return false;
    }
    try {
      const payload = {
        date: newCharge.date,
        quantity: newCharge.quantity,
      };
      if (newCharge.product_id) {
        // El backend toma nombre y precio del catálogo y descuenta stock
        payload.product_id = newCharge.product_id;
      } else {
        payload.concept = newCharge.concept;
        payload.unit_price = newCharge.unitPrice;
      }
      const res = await api.post(`/staff/bookings/${activeBooking.id}/charges`, payload);
      notify(res.data.message || `Consumo agregado: ${newCharge.concept}`);
      await loadFolio(activeBooking.id);
      return true;
    } catch (err) {
      logError('folio:add-charge', err);
      notify(`Error al agregar el consumo: ${apiErrorMessage(err, 'intente nuevamente.')}`, 'error');
      return false;
    }
  };

  const handleEmail = async () => {
    if (!activeBooking) return;
    notify('Enviando folio por correo...', 'info');
    try {
      const res = await api.post(`/staff/bookings/${activeBooking.id}/email-folio`);
      notify(res.data.message || 'Folio enviado por correo exitosamente');
    } catch (err) {
      logError('folio:email', err);
      notify(`Error al enviar el correo: ${apiErrorMessage(err, 'intente nuevamente.')}`, 'error');
    }
  };

  // Los errores (incluido el 422 "Debes abrir caja antes de registrar cobros") se
  // relanzan para que ProcessPaymentModal los muestre sin cerrarse.
  const handleProcessPayment = async (paymentData) => {
    if (!activeBooking) return;
    try {
      await api.post(`/staff/bookings/${activeBooking.id}/pay`, {
        amount: paymentData.amount,
        method: paymentData.method,
      });
    } catch (err) {
      logError('folio:pay', err);
      throw err;
    }
    notify(`¡Pago de ${formatCurrency(paymentData.amount)} procesado con éxito!`);
    setIsProcessPaymentOpen(false);
    await loadFolio(activeBooking.id);
  };

  return (
    <StaffLayout className="bg-[#e5e4de]" contentClassName="bg-[#e5e4de]">
      <header className="px-4 md:px-10 pt-10 pb-6 flex items-baseline gap-4">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#2d2d2a] tracking-tight">
          Detalle de Cuenta
        </h1>
      </header>

      <div className="px-4 md:px-10 mb-8 flex flex-wrap items-center gap-2 text-[#987d35] font-mono text-sm font-bold uppercase tracking-wide">
        <span className="material-symbols-outlined text-lg" aria-hidden="true">vpn_key</span>
        <span>Habitación {room.room_number} <span className="text-[#a39f96] bg-white px-2 py-0.5 ml-2 border border-[#d1c5af]">({room.name || room.bed_type})</span></span>
      </div>

      <main className="px-4 md:px-10 pb-10 flex flex-col lg:flex-row gap-10">
        {/* Panel Izquierdo: Resumen de Huésped y Selector de Reservas */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          {/* Si la habitación tiene múltiples reservas, mostrar selector rápido */}
          {room.bookings && room.bookings.length > 1 && (
            <div className="bg-white p-5 shadow-sm border border-gray-200">
              <h2 className="font-serif text-sm font-bold text-[#2d2d2a] mb-2 uppercase tracking-wide border-b border-gray-100 pb-1">
                Reservas de la Habitación ({room.bookings.length})
              </h2>
              <p className="font-mono text-[11px] text-[#78716c] mb-3">
                Seleccione la reserva a consultar o cobrar:
              </p>
              <div className="flex flex-col gap-2">
                {room.bookings.map((b) => {
                  const isSelected = activeBooking?.id === b.id;
                  const guestName = b.guest ? `${b.guest.name} ${b.guest.surname}` : 'Sin Huésped';
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleSelectBooking(b)}
                      className={`text-left p-3 border transition-all text-xs font-mono flex flex-col gap-1 cursor-pointer ${
                        isSelected
                          ? 'border-[#987d35] bg-[#987d35]/10 shadow-sm font-bold'
                          : 'border-gray-200 hover:border-[#987d35]/40 hover:bg-[#faf9f5] bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[#2d2d2a] truncate">{guestName}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border shrink-0 ${bookingStatusBadge(b.status)}`}>
                          {bookingStatusLabel(b.status)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#78716c] text-[11px]">
                        <span>{b.booking_code}</span>
                        <span>{String(b.check_in).substring(5, 10)} al {String(b.check_out).substring(5, 10)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white p-6 shadow-sm border border-gray-200">
            <h2 className="font-serif text-xl font-bold text-[#2d2d2a] mb-4 border-b border-gray-200 pb-2">
              Resumen de Huésped
            </h2>

            <div className="space-y-4 font-mono text-xs">
              <div className="flex justify-between items-center gap-2">
                <span className="text-[#a39f96] tracking-widest uppercase font-bold">Reserva</span>
                <span className="font-bold text-sm text-[#2d2d2a] text-right">
                  {activeBooking?.booking_code || '--'}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-[#a39f96] tracking-widest uppercase font-bold">Estado</span>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${bookingStatusBadge(activeBooking?.status)}`}>
                  {bookingStatusLabel(activeBooking?.status)}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-[#a39f96] tracking-widest uppercase font-bold">Nombre</span>
                <span className="font-bold text-sm text-[#2d2d2a] text-right">
                  {activeBooking ? `${activeBooking.guest?.name || ''} ${activeBooking.guest?.surname || ''}` : 'Sin Huésped'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#a39f96] tracking-widest uppercase font-bold">Check-in</span>
                <span className="text-[#2d2d2a]">{activeBooking ? String(activeBooking.check_in).substring(0, 10) : '--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#a39f96] tracking-widest uppercase font-bold">Check-out</span>
                <span className="text-[#2d2d2a]">{activeBooking ? String(activeBooking.check_out).substring(0, 10) : '--'}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-[#a39f96] tracking-widest uppercase font-bold">Agencia/Empresa</span>
                <span className="text-[#2d2d2a]">Particular</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddChargeOpen(true)}
              disabled={!activeBooking}
              className="mt-8 w-full bg-[#987d35] hover:bg-[#7a642a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-mono text-xs font-bold uppercase tracking-widest py-3 flex items-center justify-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">add_circle</span>
              Agregar Consumo
            </button>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 bg-transparent hover:bg-white border border-[#987d35] text-[#2d2d2a] font-mono text-[10px] font-bold uppercase tracking-widest py-3 flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">print</span>
              Imprimir Folio
            </button>
            <button
              type="button"
              onClick={handleEmail}
              disabled={!activeBooking}
              className="flex-1 bg-transparent hover:bg-white disabled:opacity-50 border border-[#987d35] text-[#2d2d2a] font-mono text-[10px] font-bold uppercase tracking-widest py-3 flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">mail</span>
              Enviar por Email
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsInvoiceOpen(true)}
            disabled={!activeBooking || activeBooking.status === 'pending_payment'}
            className="w-full bg-transparent hover:bg-white disabled:opacity-50 border border-[#14213d] text-[#14213d] font-mono text-[10px] font-bold uppercase tracking-widest py-3 flex items-center justify-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">receipt_long</span>
            Emitir Comprobante
          </button>

          <Link to="/recepcionista/habitaciones" className="text-center font-mono text-xs text-[#a39f96] hover:text-[#2d2d2a] underline mt-4">
            Volver al Tablero
          </Link>
        </div>

        {/* Panel Derecho: Tabla de Consumos y Totales */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          <div className="bg-white shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left font-mono text-xs">
              <thead className="bg-[#1b1c19] text-[#a39f96]">
                <tr>
                  <th scope="col" className="px-6 py-4 font-bold tracking-widest uppercase">Fecha</th>
                  <th scope="col" className="px-6 py-4 font-bold tracking-widest uppercase">Concepto</th>
                  <th scope="col" className="px-6 py-4 font-bold tracking-widest uppercase text-right">Cant.</th>
                  <th scope="col" className="px-6 py-4 font-bold tracking-widest uppercase text-right">Precio Unit.</th>
                  <th scope="col" className="px-6 py-4 font-bold tracking-widest uppercase text-right text-white">Total</th>
                </tr>
              </thead>
              <tbody className="text-[#2d2d2a] divide-y divide-gray-100">
                {rows.length > 0 ? rows.map((charge) => (
                  <tr key={charge.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(`${String(charge.date).substring(0, 10)}T12:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</td>
                    <td className="px-6 py-4 font-bold font-sans">{charge.concept}</td>
                    <td className="px-6 py-4 text-right">{charge.quantity}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">{formatCurrency(charge.unit_price)}</td>
                    <td className="px-6 py-4 text-right font-bold whitespace-nowrap">{formatCurrency(charge.total)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-[#a39f96]">
                      {activeBooking ? 'No hay consumos registrados.' : 'La habitación no tiene una reserva activa.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="self-end w-full max-w-sm bg-white p-6 shadow-sm border border-gray-200 mt-2 relative">
            <div className="absolute top-0 right-0 w-4 h-full bg-[#e5e4de] opacity-50 border-l border-white" aria-hidden="true"></div>

            <div className="space-y-2 font-mono text-xs mb-6 pr-6">
              <div className="flex justify-between items-center text-[#78716c]">
                <span>Alojamiento:</span>
                <span>{formatCurrency(totals.lodging)}</span>
              </div>
              <div className="flex justify-between items-center text-[#78716c]">
                <span>Consumos:</span>
                <span>{formatCurrency(totals.charges)}</span>
              </div>
              <div className="flex justify-between items-center text-[#78716c] border-b border-gray-200 pb-4">
                <span>IGV (18%, incluido):</span>
                <span>{formatCurrency(totals.igv)}</span>
              </div>
            </div>

            <div className="flex flex-col pr-6 mb-6">
              <span className="font-serif text-sm tracking-widest uppercase text-[#2d2d2a] font-bold">Total Cuenta:</span>
              <span className="font-serif text-2xl font-bold text-[#2d2d2a] mt-1">{formatCurrency(totals.total)}</span>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <span className="font-serif text-sm tracking-widest uppercase text-[#a39f96] font-bold">Total Pagado:</span>
                <span className="font-serif text-xl font-bold text-[#7a642a] block mt-1">{formatCurrency(totals.paid)}</span>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <span className="font-serif text-sm tracking-widest uppercase text-[#2d2d2a] font-bold">Saldo Pendiente:</span>
                <span className="font-serif text-3xl font-bold text-[#987d35] block mt-1">{formatCurrency(totals.balance)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsProcessPaymentOpen(true)}
              disabled={!activeBooking || totals.balance <= 0}
              className="w-full disabled:opacity-50 disabled:cursor-not-allowed bg-[#fcede8] hover:bg-[#f5e0d8] border border-[#d32f2f] text-[#d32f2f] font-mono text-xs font-bold uppercase tracking-widest py-3 flex items-center justify-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                {totals.balance <= 0 ? 'check_circle' : 'payments'}
              </span>
              {totals.balance <= 0 ? 'Cuenta Pagada' : 'Procesar Pago'}
            </button>
          </div>
        </div>
      </main>

      <AddChargeModal
        isOpen={isAddChargeOpen}
        onClose={() => setIsAddChargeOpen(false)}
        onAddCharge={handleAddCharge}
      />

      <ProcessPaymentModal
        isOpen={isProcessPaymentOpen}
        onClose={() => setIsProcessPaymentOpen(false)}
        onProcessPayment={handleProcessPayment}
        totalAmount={totals.balance}
      />

      <IssueInvoiceModal
        isOpen={isInvoiceOpen}
        booking={activeBooking}
        onClose={() => setIsInvoiceOpen(false)}
        onIssued={(invoice) => notify(`Comprobante ${invoice.full_number} emitido.`)}
      />

      <Toast
        message={toast?.message}
        isOpen={!!toast}
        type={toast?.type}
        onClose={() => setToast(null)}
      />
    </StaffLayout>
  );
}
