import { useState, useEffect, useCallback } from 'react';
import StaffLayout from '../../components/StaffLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import Toast from '../../components/Toast';
import IssueInvoiceModal from '../../components/staff/IssueInvoiceModal';
import PreCheckInPanel from '../../components/staff/PreCheckInPanel';
import { markNoShow } from '../../services/billingService';
import api from '../../services/api';
import { getBookingByCode } from '../../services/bookingService';
import { useAuth } from '../../context/AuthContext';
import {
  ACTIVE_STATUSES,
  BOOKING_STATUS,
  bookingStatusLabel,
  bookingStatusBadge,
} from '../../utils/bookingStatus';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';
import GuestFlags from '../../components/staff/GuestFlags';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const dateOnly = (value) => new Date(`${String(value).substring(0, 10)}T00:00:00`);

export default function ReceptionistBooking() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin');

  const [searchQuery, setSearchQuery] = useState('');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [bookingsList, setBookingsList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);

  const [toast, setToast] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  // Diálogo de check-out: { requireReason, balanceMessage }
  const [checkoutDialog, setCheckoutDialog] = useState(null);
  // SHE-027: tras el check-out se ofrece emitir el comprobante interno
  const [invoiceBooking, setInvoiceBooking] = useState(null);
  // SHE-028: confirmación de no-show
  const [noShowOpen, setNoShowOpen] = useState(false);

  const fetchBookingsList = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const response = await api.get('/staff/bookings');
      setBookingsList((response.data.bookings || []).filter((b) => ACTIVE_STATUSES.includes(b.status)));
    } catch (err) {
      logError('reception:list', err);
      setListError(apiErrorMessage(err, 'No se pudo cargar la lista de reservas.'));
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchBookingsList();
  }, [fetchBookingsList]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const code = searchQuery.trim();
    if (!code) return;

    setLoading(true);
    setError(null);
    setBooking(null);

    try {
      const data = await getBookingByCode(code);
      setBooking(data.booking);
    } catch (err) {
      logError('reception:search', err);
      setError('No se encontró la reserva con ese código o hubo un error.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFromList = (b) => {
    setBooking(b);
    setSearchQuery(b.booking_code);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isEarlyCheckIn = () => !!booking && startOfToday() < dateOnly(booking.check_in);
  const isEarlyCheckOut = () => !!booking && startOfToday() < dateOnly(booking.check_out);

  const handleCheckIn = async () => {
    if (!booking) return;
    if (isEarlyCheckIn()) {
      setToast({ type: 'error', message: 'No se puede realizar el check-in antes de la fecha programada.' });
      return;
    }
    setActionBusy(true);
    try {
      const response = await api.post(`/staff/bookings/${encodeURIComponent(booking.booking_code)}/check-in`);
      setToast({ type: 'success', message: response.data.message || 'Check-in realizado.' });
      setBooking(response.data.booking);
      fetchBookingsList();
    } catch (err) {
      logError('reception:check-in', err);
      setToast({ type: 'error', message: apiErrorMessage(err, 'Error al procesar el check-in.') });
    } finally {
      setActionBusy(false);
    }
  };

  const performCheckOut = async ({ reason = null, force = false } = {}) => {
    setActionBusy(true);
    try {
      const response = await api.post(`/staff/bookings/${encodeURIComponent(booking.booking_code)}/check-out`, {
        early_checkout_reason: reason || undefined,
        force: force || undefined,
      });
      setCheckoutDialog(null);
      setToast({ type: 'success', message: response.data.message || 'Check-out realizado.' });
      setInvoiceBooking({ ...booking, ...response.data.booking, guest: response.data.booking?.guest || booking.guest });
      setBooking(response.data.booking);
      fetchBookingsList();
    } catch (err) {
      logError('reception:check-out', err);
      const data = err?.response?.data;
      if (data?.requires_reason) {
        setCheckoutDialog({ requireReason: true });
      } else if (data?.requires_payment || data?.balance > 0) {
        // Saldo pendiente: informar y, si es admin, permitir forzar
        setCheckoutDialog({ balanceMessage: data.message || 'La cuenta tiene saldo pendiente.', reason });
      } else {
        setCheckoutDialog(null);
        setToast({ type: 'error', message: apiErrorMessage(err, 'Error al procesar el check-out.') });
      }
    } finally {
      setActionBusy(false);
    }
  };

  const canMarkNoShow = () => !!booking
    && booking.status === BOOKING_STATUS.CONFIRMED
    && dateOnly(booking.check_in) <= startOfToday();

  const performNoShow = async () => {
    setActionBusy(true);
    try {
      const data = await markNoShow(booking.booking_code);
      setNoShowOpen(false);
      setToast({ type: 'success', message: `${data.message} Penalidad: S/ ${Number(data.penalty_amount || 0).toFixed(2)}.` });
      setBooking(data.booking);
      fetchBookingsList();
    } catch (err) {
      logError('reception:no-show', err);
      setNoShowOpen(false);
      setToast({ type: 'error', message: apiErrorMessage(err, 'No se pudo marcar el no-show.') });
    } finally {
      setActionBusy(false);
    }
  };

  const handleCheckOut = () => {
    if (!booking) return;
    if (isEarlyCheckOut()) {
      setCheckoutDialog({ requireReason: true });
      return;
    }
    performCheckOut();
  };

  return (
    <StaffLayout>
      <div className="flex-1 p-4 md:p-12">
        <div className="flex flex-col w-full py-8 md:py-12 gap-8 bg-[#EDEBE6] rounded border border-[#d1c5af] p-4 md:p-8">
          <div className="flex flex-col gap-4">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#14213D] tracking-tight">Recepción: Check-in / Check-out</h1>
            <p className="text-lg text-[#14213D]/70 max-w-2xl">Gestione la entrada y salida de los huéspedes del hotel.</p>
          </div>

          {/* Buscador */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 sm:items-end bg-[#F7F6F3] p-6 border border-[#D1CEC5]">
            <div className="flex flex-col gap-2 flex-1">
              <label htmlFor="rb-code" className="font-mono text-xs font-medium text-[#14213D]/60 uppercase tracking-widest">Código de Reserva</label>
              <input
                id="rb-code"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ej. RES-A1B2C3D4"
                className="bg-transparent border-b-2 border-[#D1CEC5] focus:border-[#14213D] outline-none py-2 text-[#14213D] transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#14213D] text-white font-mono text-sm font-medium px-6 py-2 h-[42px] uppercase tracking-widest hover:bg-[#2a3c63] transition-all disabled:opacity-50"
            >
              {loading ? 'Buscando...' : 'Buscar Reserva'}
            </button>
          </form>

          {error && (
            <div role="alert" className="bg-[#ba1a1a]/10 border border-[#ba1a1a]/30 text-[#ba1a1a] p-4 rounded text-sm">
              {error}
            </div>
          )}

          {/* Detalles de la Reserva y Acciones */}
          {booking && (
            <div className="bg-[#F7F6F3] border border-[#D1CEC5] p-6 flex flex-col gap-6">
              <h2 className="font-serif text-2xl font-bold text-[#14213D] border-b border-[#D1CEC5] pb-2">Detalles de la Reserva</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-mono uppercase text-[#14213D]/60">Huésped</p>
                  <p className="font-medium text-lg">{booking.guest?.name} {booking.guest?.surname} <GuestFlags guest={booking.guest} /></p>
                  <p className="text-sm text-[#14213D]/80">Doc: {booking.guest?.document_number}</p>
                  {booking.guest?.is_blacklisted && (
                    <p role="alert" className="mt-2 bg-[#ffdad6] border border-[#ba1a1a]/40 text-[#93000a] text-xs p-2">
                      <strong>Lista negra:</strong> {booking.guest.blacklist_reason || 'consulte con administración antes del check-in.'}
                    </p>
                  )}
                  {Array.isArray(booking.guest?.preferences) && booking.guest.preferences.length > 0 && (
                    <p className="mt-1 text-xs text-[#14213D]/70">Preferencias: {booking.guest.preferences.join(', ')}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-mono uppercase text-[#14213D]/60">Habitación</p>
                  <p className="font-medium text-lg">{booking.room?.name || 'No asignada'}</p>
                  <p className="text-sm text-[#14213D]/80">N° {booking.room?.room_number}</p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase text-[#14213D]/60">Fechas</p>
                  <p className="font-medium">In: {String(booking.check_in).substring(0, 10)}</p>
                  <p className="font-medium">Out: {String(booking.check_out).substring(0, 10)}</p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase text-[#14213D]/60">Estado Actual</p>
                  <span className={`inline-block mt-1 px-3 py-1 border font-mono text-xs font-bold uppercase rounded ${bookingStatusBadge(booking.status)}`}>
                    {bookingStatusLabel(booking.status)}
                  </span>
                </div>
              </div>

              {/* SHE-036: datos del pre check-in online (solo lectura) */}
              {booking.status === BOOKING_STATUS.CONFIRMED && 'pre_check_in' in booking && (
                <PreCheckInPanel preCheckIn={booking.pre_check_in} />
              )}

              <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-[#D1CEC5] mt-2">
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={actionBusy || booking.status !== BOOKING_STATUS.CONFIRMED || isEarlyCheckIn()}
                  title={
                    booking.status === BOOKING_STATUS.PENDING_PAYMENT
                      ? 'No se puede hacer check-in sin haber completado el pago primero.'
                      : (isEarlyCheckIn() ? 'No se puede hacer check-in antes de la fecha programada' : '')
                  }
                  className="flex-1 bg-[#2E7A4A] text-white font-mono text-sm font-medium px-6 py-3 uppercase tracking-widest hover:bg-[#3f9e63] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[2px_2px_0px_0px_rgba(20,33,61,0.1)] active:translate-y-[1px] active:shadow-none"
                >
                  Realizar Check-In
                </button>
                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={actionBusy || booking.status !== BOOKING_STATUS.CHECKED_IN}
                  className="flex-1 bg-[#755b00] text-white font-mono text-sm font-medium px-6 py-3 uppercase tracking-widest hover:bg-[#c9a227] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[2px_2px_0px_0px_rgba(20,33,61,0.1)] active:translate-y-[1px] active:shadow-none"
                >
                  Realizar Check-Out
                </button>
              </div>
              {(canMarkNoShow() || booking.status === BOOKING_STATUS.CHECKED_OUT) && (
                <div className="flex flex-col sm:flex-row gap-4">
                  {canMarkNoShow() && (
                    <button
                      type="button"
                      onClick={() => setNoShowOpen(true)}
                      disabled={actionBusy}
                      className="flex-1 border border-[#ba1a1a] text-[#93000a] font-mono text-xs font-bold px-6 py-2 uppercase tracking-widest hover:bg-[#ffdad6] transition-all disabled:opacity-40"
                    >
                      Marcar No-Show
                    </button>
                  )}
                  {booking.status === BOOKING_STATUS.CHECKED_OUT && (
                    <button
                      type="button"
                      onClick={() => setInvoiceBooking(booking)}
                      className="flex-1 border border-[#14213D] text-[#14213D] font-mono text-xs font-bold px-6 py-2 uppercase tracking-widest hover:bg-[#eae8e3] transition-all inline-flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base" aria-hidden="true">receipt_long</span>
                      Emitir comprobante
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Lista de Reservas (Atajo) */}
          <div className="bg-[#F7F6F3] border border-[#D1CEC5] p-4 md:p-6 flex flex-col gap-6 mt-4">
            <h2 className="font-serif text-xl font-bold text-[#14213D] border-b border-[#D1CEC5] pb-2">Próximos Ingresos / Salidas</h2>
            {listError && (
              <div role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-3 text-[#93000a] font-mono text-xs flex items-center justify-between gap-2">
                <span>{listError}</span>
                <button type="button" onClick={fetchBookingsList} className="underline font-bold uppercase">Reintentar</button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#14213D] text-[#F7F6F3]">
                    <th scope="col" className="font-mono text-[10px] font-normal uppercase tracking-widest py-3 px-4">Reserva</th>
                    <th scope="col" className="font-mono text-[10px] font-normal uppercase tracking-widest py-3 px-4">Huésped</th>
                    <th scope="col" className="font-mono text-[10px] font-normal uppercase tracking-widest py-3 px-4">Doc</th>
                    <th scope="col" className="font-mono text-[10px] font-normal uppercase tracking-widest py-3 px-4">Fechas</th>
                    <th scope="col" className="font-mono text-[10px] font-normal uppercase tracking-widest py-3 px-4">Estado</th>
                    <th scope="col" className="font-mono text-[10px] font-normal uppercase tracking-widest py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-[#14213D]">
                  {loadingList ? (
                    <tr><td colSpan="6" className="py-4 text-center font-mono text-xs">Cargando...</td></tr>
                  ) : bookingsList.length === 0 ? (
                    <tr><td colSpan="6" className="py-4 text-center font-mono text-xs">{listError ? '—' : 'No hay reservas activas.'}</td></tr>
                  ) : (
                    bookingsList.map((b) => (
                      <tr key={b.id} className="border-b border-[#D1CEC5]/50 hover:bg-[#14213D]/5 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs font-bold">{b.booking_code}</td>
                        <td className="py-3 px-4 text-sm">{b.guest?.name} {b.guest?.surname}</td>
                        <td className="py-3 px-4 text-xs">{b.guest?.document_number}</td>
                        <td className="py-3 px-4 text-xs font-mono whitespace-nowrap">{String(b.check_in).substring(5, 10)} al {String(b.check_out).substring(5, 10)}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-1 border text-[10px] font-mono font-bold uppercase rounded whitespace-nowrap ${bookingStatusBadge(b.status)}`}>
                            {bookingStatusLabel(b.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleSelectFromList(b)}
                            className="text-[#755b00] font-mono text-[10px] uppercase font-bold hover:text-[#c9a227] tracking-wider"
                            aria-label={`Seleccionar reserva ${b.booking_code}`}
                          >
                            Seleccionar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Check-out anticipado: motivo obligatorio */}
      <ConfirmDialog
        isOpen={!!checkoutDialog?.requireReason}
        title="Salida anticipada"
        message="El huésped está realizando el check-out antes de la fecha programada. Indique el motivo."
        requireReason
        reasonLabel="Motivo de la salida anticipada"
        confirmLabel="Confirmar Check-Out"
        busy={actionBusy}
        onCancel={() => setCheckoutDialog(null)}
        onConfirm={(reason) => performCheckOut({ reason })}
      />

      {/* Saldo pendiente */}
      <ConfirmDialog
        isOpen={!!checkoutDialog?.balanceMessage}
        title="Saldo pendiente"
        message={`${checkoutDialog?.balanceMessage || ''}${isAdmin ? '\n\nComo administrador puede forzar el check-out (quedará registrado).' : '\n\nRegistre el pago en la cuenta de la habitación antes del check-out.'}`}
        confirmLabel={isAdmin ? 'Forzar Check-Out' : 'Entendido'}
        cancelLabel="Cerrar"
        variant={isAdmin ? 'danger' : 'default'}
        busy={actionBusy}
        onCancel={() => setCheckoutDialog(null)}
        onConfirm={() => {
          if (isAdmin) performCheckOut({ reason: checkoutDialog?.reason, force: true });
          else setCheckoutDialog(null);
        }}
      />

      {/* No-show (SHE-028) */}
      <ConfirmDialog
        isOpen={noShowOpen}
        title="Marcar no-show"
        message="El huésped no se presentó. Se aplicará la penalidad de la política de cancelación, se registrará el reembolso del saldo restante (pendiente de aprobación) y se liberará la habitación."
        confirmLabel="Marcar No-Show"
        variant="danger"
        busy={actionBusy}
        onCancel={() => setNoShowOpen(false)}
        onConfirm={performNoShow}
      />

      {/* Comprobante tras el check-out (SHE-027) */}
      <IssueInvoiceModal
        isOpen={!!invoiceBooking}
        booking={invoiceBooking}
        onClose={() => setInvoiceBooking(null)}
      />

      <Toast message={toast?.message} isOpen={!!toast} type={toast?.type} onClose={() => setToast(null)} />
    </StaffLayout>
  );
}
