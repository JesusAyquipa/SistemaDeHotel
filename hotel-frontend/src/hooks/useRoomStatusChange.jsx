import { useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import { apiStatus } from '../utils/apiError';

/** ¿El error es un 409 que un administrador puede forzar (reservas afectadas)? */
export function isForceableError(err) {
  return apiStatus(err) === 409 && !!err?.response?.data?.requires_force;
}

/**
 * Flujo de cambio de estado de habitación (SHE-017):
 *  - pasar a `mantenimiento` pide un motivo obligatorio;
 *  - si el servidor responde 409 con reservas afectadas, un administrador puede "Forzar".
 *
 * @param {Object} params
 * @param {boolean} params.isAdmin
 * @param {(change: Object, options: {reason?: string, force?: boolean}) => Promise<any>} params.submit
 *   Realiza el cambio (actualización optimista + API). Debe devolver el error (o null si tuvo éxito).
 * @returns {{ requestChange: (change: Object) => void, dialogs: JSX.Element }}
 *   `change` = { roomId, roomNumber, newStatus, oldStatus }
 */
export default function useRoomStatusChange({ isAdmin, submit }) {
  const [reasonFor, setReasonFor] = useState(null);
  const [forceFor, setForceFor] = useState(null);

  const run = async (change, options = {}) => {
    const err = await submit(change, options);
    if (err && isAdmin && isForceableError(err)) {
      setForceFor({ change, options, data: err.response.data });
    }
  };

  const requestChange = (change) => {
    if (change.newStatus === 'mantenimiento') {
      setReasonFor(change);
      return;
    }
    run(change);
  };

  const affected = forceFor?.data?.affected_bookings || [];
  const forceMessage = forceFor
    ? `${forceFor.data.message}\n\n${affected
      .map((b) => `• ${b.booking_code} — ${b.guest_name || 'Huésped'} (${String(b.check_in).substring(0, 10)} → ${String(b.check_out).substring(0, 10)})`)
      .join('\n')}\n\nComo administrador puede forzar el cambio. Las reservas deberán reasignarse manualmente.`
    : '';

  const dialogs = (
    <>
      <ConfirmDialog
        isOpen={!!reasonFor}
        title="Poner habitación en mantenimiento"
        message={reasonFor ? `La Habitación ${reasonFor.roomNumber} dejará de estar disponible para nuevas reservas. Indique el motivo (quedará registrado en la bitácora).` : ''}
        requireReason
        reasonLabel="Motivo del mantenimiento"
        confirmLabel="Pasar a mantenimiento"
        onCancel={() => setReasonFor(null)}
        onConfirm={(reason) => {
          const change = reasonFor;
          setReasonFor(null);
          run(change, { reason });
        }}
      />
      <ConfirmDialog
        isOpen={!!forceFor}
        title="Reservas afectadas"
        message={forceMessage}
        variant="danger"
        confirmLabel="Forzar"
        onCancel={() => setForceFor(null)}
        onConfirm={() => {
          const pending = forceFor;
          setForceFor(null);
          run(pending.change, { ...pending.options, force: true });
        }}
      />
    </>
  );

  return { requestChange, dialogs };
}
