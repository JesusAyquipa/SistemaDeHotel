import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getMyBookings } from '../services/bookingService';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import CancelBookingModal from '../components/CancelBookingModal';
import ModifyBookingModal from '../components/ModifyBookingModal';
import StarRating from '../components/reviews/StarRating';
import { bookingStatusLabel, bookingStatusBadge, MODIFIABLE_STATUSES, BOOKING_STATUS } from '../utils/bookingStatus';
import formatCurrency from '../utils/formatCurrency';
import { nightsBetween, toYmd } from '../utils/dates';
import { apiErrorMessage } from '../utils/apiError';

const PRECHECK_WINDOW_DAYS = 7;

const FILTERS = [
  { key: 'upcoming', label: 'Próximas' },
  { key: 'past', label: 'Pasadas' },
  { key: 'all', label: 'Todas' },
];

const UPCOMING = [BOOKING_STATUS.PENDING_PAYMENT, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN];

function formatLong(ymd) {
  if (!ymd) return '—';
  return new Date(`${String(ymd).substring(0, 10)}T00:00:00`).toLocaleDateString('es-PE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** Días desde hoy hasta la fecha (negativo si ya pasó). */
function daysUntil(ymd) {
  const today = new Date(`${toYmd(new Date())}T00:00:00`);
  const d = new Date(`${String(ymd).substring(0, 10)}T00:00:00`);
  return Math.round((d - today) / 86400000);
}

function preCheckInState(booking) {
  if (booking.status !== BOOKING_STATUS.CONFIRMED) return null;
  if (booking.pre_check_in) return 'done';
  const days = daysUntil(booking.check_in);
  if (days >= 0 && days <= PRECHECK_WINDOW_DAYS) return 'open';
  return null;
}

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('upcoming');

  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [modifyModalBooking, setModifyModalBooking] = useState(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMyBookings();
      setBookings(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Error al cargar tus reservas.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const visible = useMemo(() => {
    if (filter === 'all') return bookings;
    return bookings.filter((b) => (filter === 'upcoming' ? UPCOMING.includes(b.status) : !UPCOMING.includes(b.status)));
  }, [bookings, filter]);

  const counts = useMemo(() => ({
    upcoming: bookings.filter((b) => UPCOMING.includes(b.status)).length,
    past: bookings.filter((b) => !UPCOMING.includes(b.status)).length,
    all: bookings.length,
  }), [bookings]);

  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] flex flex-col font-sans">
      <PublicHeader />

      <main className="flex-grow max-w-[1200px] mx-auto w-full px-4 sm:px-6 py-12">
        <div className="mb-6 border-b border-[#d1c5af] pb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-[#1b1c19]">Mis Reservas</h1>
            <p className="font-sans text-sm text-[#4d4635] mt-2">
              Consulta tu estado de cuenta, completa tu pre check-in, descarga comprobantes y comparte tu experiencia.
            </p>
          </div>
          <div role="tablist" aria-label="Filtrar reservas" className="flex border border-[#d1c5af] bg-white">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider cursor-pointer transition-colors ${filter === f.key ? 'bg-[#14213d] text-white' : 'text-[#4d4635] hover:bg-[#eae8e3]'}`}
              >
                {f.label} <span className="opacity-70">({counts[f.key]})</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div role="alert" className="bg-[#ffdad6] text-[#93000a] p-4 text-sm font-mono border border-[#ba1a1a]/30 mb-8">
            <span className="material-symbols-outlined align-middle mr-2" aria-hidden="true">error</span>
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse bg-[#eae8e3] h-56 border border-[#d1c5af]"></div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20 bg-[#f5f3ee] border border-[#d1c5af]">
            <span className="material-symbols-outlined text-6xl text-[#d1c5af] mb-4" aria-hidden="true">luggage</span>
            <h3 className="font-serif text-xl font-bold text-[#4d4635] mb-2">
              {bookings.length === 0 ? 'No tienes reservas' : 'No hay reservas en esta vista'}
            </h3>
            <p className="font-sans text-sm text-[#755b00]">
              {bookings.length === 0 ? 'Aún no has realizado ninguna reserva con nosotros.' : 'Prueba con otro filtro.'}
            </p>
            {bookings.length === 0 && (
              <Link to="/habitaciones" className="inline-block mt-6 px-5 py-2 bg-[#14213d] text-white font-mono text-xs uppercase font-bold hover:bg-[#c9a227] hover:text-[#14213d] transition-colors">
                Ver habitaciones
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {visible.map((booking) => {
              const nights = nightsBetween(booking.check_in, booking.check_out);
              const pc = preCheckInState(booking);
              const detailUrl = `/cliente/mis-reservas/${encodeURIComponent(booking.booking_code)}`;
              const days = daysUntil(booking.check_in);
              return (
                <article key={booking.id} className="bg-white border border-[#d1c5af] shadow-[2px_2px_0px_rgba(20,33,61,0.15)] flex flex-col hover:shadow-[4px_4px_0px_rgba(20,33,61,0.2)] transition-shadow">
                  <div className="p-5 border-b border-[#eae8e3] flex justify-between items-start gap-3 bg-[#fbf9f4]">
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] text-[#755b00] font-bold uppercase tracking-widest block mb-1">
                        {booking.room?.name || 'Habitación'}{booking.room?.room_number ? ` · Hab. ${booking.room.room_number}` : ''}
                      </span>
                      <h3 className="font-serif font-bold text-lg text-[#14213d] break-all">{booking.booking_code}</h3>
                    </div>
                    <span className={`shrink-0 px-2 py-1 text-[10px] uppercase font-mono font-bold border ${bookingStatusBadge(booking.status)}`}>
                      {bookingStatusLabel(booking.status)}
                    </span>
                  </div>

                  <div className="p-5 flex-grow space-y-4">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div>
                        <span className="font-mono text-[10px] text-[#4d4635] uppercase block mb-1">Llegada</span>
                        <p className="font-semibold text-sm">{formatLong(booking.check_in)}</p>
                      </div>
                      <span className="font-mono text-[10px] text-[#755b00] border border-[#d1c5af] px-2 py-0.5 whitespace-nowrap">
                        {nights} {nights === 1 ? 'noche' : 'noches'}
                      </span>
                      <div className="text-right">
                        <span className="font-mono text-[10px] text-[#4d4635] uppercase block mb-1">Salida</span>
                        <p className="font-semibold text-sm">{formatLong(booking.check_out)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {booking.status === BOOKING_STATUS.CONFIRMED && days > 0 && days <= 30 && (
                        <span className="font-mono text-[10px] uppercase bg-[#e3f2fd] text-[#1565c0] border border-[#2196f3] px-2 py-0.5">
                          Faltan {days} {days === 1 ? 'día' : 'días'}
                        </span>
                      )}
                      {pc === 'open' && (
                        <Link to={`${detailUrl}#pre-check-in`} className="font-mono text-[10px] uppercase bg-[#fff3e0] text-[#e65100] border border-[#ff9800] px-2 py-0.5 hover:underline">
                          Pre check-in disponible
                        </Link>
                      )}
                      {pc === 'done' && (
                        <span className="font-mono text-[10px] uppercase bg-[#e8f5e9] text-[#1b5e20] border border-[#4caf50] px-2 py-0.5">
                          Pre check-in completado
                        </span>
                      )}
                      {booking.status === BOOKING_STATUS.CHECKED_OUT && booking.review && (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase bg-[#f5f3ee] text-[#4d4635] border border-[#d1c5af] px-2 py-0.5">
                          <StarRating value={booking.review.rating} size="text-xs" label="Tu calificación" /> Reseña enviada
                        </span>
                      )}
                    </div>

                    <div className="border-t border-[#eae8e3] pt-4 flex justify-between items-end">
                      <span className="font-mono text-xs uppercase text-[#4d4635]">{booking.status === BOOKING_STATUS.PENDING_PAYMENT ? 'Total a pagar' : 'Total de la reserva'}</span>
                      <span className="font-mono font-bold text-lg text-[#14213d]">{formatCurrency(booking.total_amount)}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-[#eae8e3] border-t border-[#d1c5af] flex flex-wrap gap-2">
                    <Link
                      to={detailUrl}
                      className="flex-1 min-w-[120px] px-4 py-2 bg-[#14213d] text-white font-mono text-xs uppercase font-bold hover:bg-[#c9a227] hover:text-[#14213d] transition-colors flex justify-center items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">visibility</span>
                      Ver detalle
                    </Link>
                    {booking.status === BOOKING_STATUS.CHECKED_OUT && !booking.review && (
                      <Link
                        to={`${detailUrl}#resena`}
                        className="flex-1 min-w-[120px] px-4 py-2 bg-white border border-[#c9a227] text-[#14213d] font-mono text-xs uppercase font-bold hover:bg-[#c9a227] transition-colors flex justify-center items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">rate_review</span>
                        Dejar reseña
                      </Link>
                    )}
                    {MODIFIABLE_STATUSES.includes(booking.status) && (
                      <>
                        <button
                          type="button"
                          onClick={() => setModifyModalBooking(booking)}
                          className="flex-1 min-w-[120px] px-4 py-2 bg-white border border-[#a68a4d] text-[#14213d] font-mono text-xs uppercase font-bold hover:bg-[#c9a227] hover:text-white transition-colors flex justify-center items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">edit_calendar</span>
                          Modificar
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancelModalBooking(booking)}
                          className="flex-1 min-w-[120px] px-4 py-2 bg-white border border-[#ba1a1a] text-[#ba1a1a] font-mono text-xs uppercase font-bold hover:bg-[#ba1a1a] hover:text-white transition-colors flex justify-center items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">cancel</span>
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <PublicFooter />

      {cancelModalBooking && (
        <CancelBookingModal
          booking={cancelModalBooking}
          onClose={() => setCancelModalBooking(null)}
          onSuccess={() => {
            setCancelModalBooking(null);
            fetchBookings();
          }}
        />
      )}

      {modifyModalBooking && (
        <ModifyBookingModal
          booking={modifyModalBooking}
          onClose={() => setModifyModalBooking(null)}
          onSuccess={() => {
            setModifyModalBooking(null);
            fetchBookings();
          }}
        />
      )}
    </div>
  );
}
