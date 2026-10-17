import { useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import { checkInBooking, checkOutBooking } from '../services/frontDeskService';
import { apiErrorMessage } from '../utils/apiError';
import logError from '../utils/logError';

const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Check-in / check-out reutilizables (Rack y panel "Hoy"), con el mismo flujo que
 * Recepción: motivo obligatorio para salida anticipada y saldo pendiente (forzar solo admin).
 *
 * @param {{ isAdmin: boolean, notify: (msg: string, type?: string) => void, onDone?: () => void }} options
 * @returns {{ checkIn: Function, checkOut: Function, busyCode: string|null, dialogs: JSX.Element }}
 */
export default function useFrontDeskActions({ isAdmin, notify, onDone }) {
  const [busyCode, setBusyCode] = useState(null);
  // { booking, requireReason?, balanceMessage?, reason? }
  const [checkoutDialog, setCheckoutDialog] = useState(null);
  // Confirmación de check-in de huésped en lista negra
  const [blacklistConfirm, setBlacklistConfirm] = useState(null);

  const doCheckIn = async (booking) => {
    setBusyCode(booking.booking_code);
    try {
      const res = await checkInBooking(booking.booking_code);
      notify(res.message || 'Check-in realizado.', 'success');
      onDone?.();
    } catch (err) {
      logError('front-desk:check-in', err);
      notify(apiErrorMessage(err, 'Error al procesar el check-in.'), 'error');
    } finally {
      setBusyCode(null);
    }
  };

  const checkIn = (booking) => {
    if (!booking) return;
    if (booking.guest?.is_blacklisted || booking.blacklisted) {
      setBlacklistConfirm(booking);
      return;
    }
    doCheckIn(booking);
  };

  const performCheckOut = async (booking, { reason = null, force = false } = {}) => {
    setBusyCode(booking.booking_code);
    try {
      const res = await checkOutBooking(booking.booking_code, { reason, force });
      setCheckoutDialog(null);
      notify(res.message || 'Check-out realizado.', 'success');
      onDone?.();
    } catch (err) {
      logError('front-desk:check-out', err);
      const data = err?.response?.data;
      if (data?.requires_reason) {
        setCheckoutDialog({ booking, requireReason: true });
      } else if (data?.requires_payment || data?.balance > 0) {
        setCheckoutDialog({ booking, balanceMessage: data.message || 'La cuenta tiene saldo pendiente.', reason });
      } else {
        setCheckoutDialog(null);
        notify(apiErrorMessage(err, 'Error al procesar el check-out.'), 'error');
      }
    } finally {
      setBusyCode(null);
    }
  };

  const checkOut = (booking) => {
    if (!booking) return;
    const checkOutDate = String(booking.check_out).substring(0, 10);
    if (todayYmd() < checkOutDate) {
      setCheckoutDialog({ booking, requireReason: true });
      return;
    }
    performCheckOut(booking);
  };

  const dialogBooking = checkoutDialog?.booking;

  const dialogs = (
    <>
      <ConfirmDialog
        isOpen={!!checkoutDialog?.requireReason}
        title="Salida anticipada"
        message={`La reserva ${dialogBooking?.booking_code || ''} sale antes de la fecha programada. Indique el motivo.`}
        requireReason
        reasonLabel="Motivo de la salida anticipada"
        confirmLabel="Confirmar Check-Out"
        busy={!!busyCode}
        onCancel={() => setCheckoutDialog(null)}
        onConfirm={(reason) => performCheckOut(dialogBooking, { reason })}
      />
      <ConfirmDialog
        isOpen={!!checkoutDialog?.balanceMessage}
        title="Saldo pendiente"
        message={`${checkoutDialog?.balanceMessage || ''}${isAdmin ? '\n\nComo administrador puede forzar el check-out (quedará registrado).' : '\n\nRegistre el pago en la cuenta de la habitación antes del check-out.'}`}
        confirmLabel={isAdmin ? 'Forzar Check-Out' : 'Entendido'}
        cancelLabel="Cerrar"
        variant={isAdmin ? 'danger' : 'default'}
        busy={!!busyCode}
        onCancel={() => setCheckoutDialog(null)}
        onConfirm={() => {
          if (isAdmin) performCheckOut(dialogBooking, { reason: checkoutDialog?.reason, force: true });
          else setCheckoutDialog(null);
        }}
      />
      <ConfirmDialog
        isOpen={!!blacklistConfirm}
        title="Huésped en lista negra"
        message={`${blacklistConfirm?.guest?.name || blacklistConfirm?.guest_name || 'El huésped'} ${blacklistConfirm?.guest?.surname || ''} figura en la lista negra${blacklistConfirm?.guest?.blacklist_reason ? ` (motivo: ${blacklistConfirm.guest.blacklist_reason})` : ''}.\n\n¿Desea continuar con el check-in de todos modos?`}
        confirmLabel="Continuar check-in"
        variant="danger"
        busy={!!busyCode}
        onCancel={() => setBlacklistConfirm(null)}
        onConfirm={() => {
          const b = blacklistConfirm;
          setBlacklistConfirm(null);
          doCheckIn(b);
        }}
      />
    </>
  );

  return { checkIn, checkOut, busyCode, dialogs };
}
