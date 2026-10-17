import { useState, useEffect, useCallback, useMemo } from 'react';
import EditBookingModal from '../../components/staff/EditBookingModal';
import StaffLayout from '../../components/StaffLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import Toast from '../../components/Toast';
import api from '../../services/api';
import { cancelBooking } from '../../services/bookingService';
import {
  bookingStatusLabel,
  bookingStatusBadge,
  BOOKING_STATUS_OPTIONS,
  MODIFIABLE_STATUSES,
} from '../../utils/bookingStatus';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';

export default function BookingManagement() {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/staff/bookings', {
        params: statusFilter ? { status: statusFilter } : undefined,
      });
      setBookings(response.data.bookings || []);
    } catch (err) {
      logError('bookings:list', err);
      setError(apiErrorMessage(err, 'Error al cargar las reservas.'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const roomTypes = useMemo(
    () => [...new Set(bookings.map((b) => b.room?.bed_type).filter(Boolean))],
    [bookings]
  );

  const visibleBookings = useMemo(
    () => bookings.filter((b) => !roomTypeFilter || b.room?.bed_type === roomTypeFilter),
    [bookings, roomTypeFilter]
  );

  const openEditModal = (booking = null) => {
    setSelectedBooking(booking);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setSelectedBooking(null);
    setIsEditModalOpen(false);
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const response = await cancelBooking(cancelTarget.booking_code);
      setToast({ type: 'success', message: response.message || 'Reserva cancelada con éxito' });
      fetchBookings();
    } catch (err) {
      logError('bookings:cancel', err);
      setToast({ type: 'error', message: apiErrorMessage(err, 'Hubo un error al intentar cancelar la reserva') });
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  const selectClass = 'bg-transparent border-b-2 border-[#D1CEC5] focus:border-[#14213D] outline-none py-2 pr-8 text-[#14213D] appearance-none transition-colors cursor-pointer';

  return (
    <StaffLayout>
      <div className="flex-1 p-4 md:p-12">
        <div className="flex flex-col w-full py-8 md:py-12 gap-8 bg-[#EDEBE6] rounded border border-[#d1c5af] p-4 md:p-8">
          <div className="flex flex-col gap-4">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#14213D] tracking-tight">Gestión de Reservas</h1>
            <p className="text-lg text-[#14213D]/70 max-w-2xl">Administre y supervise todas las reservas del hotel.</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#F7F6F3] p-6 border border-[#D1CEC5]">
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="bm-status" className="font-mono text-xs font-medium text-[#14213D]/60 uppercase tracking-widest">Estado</label>
                <div className="relative">
                  <select id="bm-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
                    <option value="">Todos</option>
                    {BOOKING_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-[#14213D] pointer-events-none" aria-hidden="true">expand_more</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="bm-roomtype" className="font-mono text-xs font-medium text-[#14213D]/60 uppercase tracking-widest">Tipo de Habitación</label>
                <div className="relative">
                  <select id="bm-roomtype" value={roomTypeFilter} onChange={(e) => setRoomTypeFilter(e.target.value)} className={`${selectClass} capitalize`}>
                    <option value="">Todas</option>
                    {roomTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-[#14213D] pointer-events-none" aria-hidden="true">expand_more</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => openEditModal(null)}
              className="bg-[#755b00] text-white font-mono text-sm font-medium px-6 py-3 uppercase tracking-widest hover:bg-[#c9a227] transition-all shadow-[2px_2px_0px_0px_rgba(20,33,61,0.1)] active:translate-y-[1px] active:shadow-none whitespace-nowrap"
              type="button"
            >
              + Nueva Reserva Manual
            </button>
          </div>

          {error && (
            <div role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-4 text-[#93000a] font-mono text-xs flex items-center justify-between gap-2">
              <span>{error}</span>
              <button type="button" onClick={fetchBookings} className="underline font-bold uppercase">Reintentar</button>
            </div>
          )}

          <div className="flex flex-col gap-6 bg-[#F7F6F3] p-4 md:p-8 border border-[#D1CEC5]">
            <h2 className="font-serif text-xl font-semibold text-[#14213D] flex items-center gap-2">Listado de Reservas</h2>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#14213D] text-[#F7F6F3]">
                    <th scope="col" className="font-mono text-xs font-normal uppercase tracking-widest py-3 px-4">Código de Reserva</th>
                    <th scope="col" className="font-mono text-xs font-normal uppercase tracking-widest py-3 px-4">Huésped</th>
                    <th scope="col" className="font-mono text-xs font-normal uppercase tracking-widest py-3 px-4">Fechas (In/Out)</th>
                    <th scope="col" className="font-mono text-xs font-normal uppercase tracking-widest py-3 px-4">Habitación</th>
                    <th scope="col" className="font-mono text-xs font-normal uppercase tracking-widest py-3 px-4">Estado</th>
                    <th scope="col" className="font-mono text-xs font-normal uppercase tracking-widest py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-[#14213D]">
                  {loading ? (
                    <tr><td colSpan="6" className="py-4 text-center">Cargando reservas...</td></tr>
                  ) : visibleBookings.length === 0 ? (
                    <tr><td colSpan="6" className="py-4 text-center font-mono text-xs">No hay reservas para los filtros seleccionados.</td></tr>
                  ) : (
                    visibleBookings.map((booking) => {
                      const canModify = MODIFIABLE_STATUSES.includes(booking.status);
                      return (
                        <tr key={booking.id} className="border-b border-[#D1CEC5]/50 hover:bg-[#14213D]/5 transition-colors">
                          <td className="py-4 px-4 font-medium">{booking.booking_code}</td>
                          <td className="py-4 px-4 text-[#14213D]/70">
                            {booking.guest ? `${booking.guest.name} ${booking.guest.surname}` : 'Desconocido'}
                          </td>
                          <td className="py-4 px-4 text-[#14213D]/70 whitespace-nowrap">
                            {String(booking.check_in).substring(0, 10)} - {String(booking.check_out).substring(0, 10)}
                          </td>
                          <td className="py-4 px-4">{booking.room ? `${booking.room.room_number} · ${booking.room.name}` : 'No asignada'}</td>
                          <td className="py-4 px-4">
                            <span className={`${bookingStatusBadge(booking.status)} border px-2 py-1 font-mono text-xs font-medium uppercase tracking-wider rounded-sm whitespace-nowrap`}>
                              {bookingStatusLabel(booking.status)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              className="text-[#755b00] hover:text-[#c9a227] transition-colors p-1 ml-1 disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label={`Editar reserva ${booking.booking_code}`}
                              title="Editar"
                              disabled={!canModify}
                              onClick={() => openEditModal(booking)}
                            >
                              <span className="material-symbols-outlined text-lg" aria-hidden="true">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCancelTarget(booking)}
                              disabled={!canModify}
                              className="text-[#ba1a1a] hover:opacity-80 transition-colors p-1 ml-1 disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label={`Cancelar reserva ${booking.booking_code}`}
                              title="Cancelar"
                            >
                              <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isEditModalOpen && (
        <EditBookingModal
          isOpen={isEditModalOpen}
          onClose={closeEditModal}
          onSuccess={fetchBookings}
          booking={selectedBooking}
        />
      )}

      <ConfirmDialog
        isOpen={!!cancelTarget}
        title="Cancelar reserva"
        message={cancelTarget ? `¿Está seguro que desea cancelar la reserva ${cancelTarget.booking_code}? Se aplicará la política de reembolso vigente.` : ''}
        confirmLabel="Sí, cancelar"
        cancelLabel="Volver"
        variant="danger"
        busy={cancelling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      />

      <Toast message={toast?.message} isOpen={!!toast} type={toast?.type} onClose={() => setToast(null)} />
    </StaffLayout>
  );
}
