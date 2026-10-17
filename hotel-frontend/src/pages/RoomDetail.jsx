import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useAuth } from '../context/AuthContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import CheckoutModal from '../components/CheckoutModal';
import PaymentReceiptModal from '../components/PaymentReceiptModal';
import RoomReviews from '../components/reviews/RoomReviews';
import { getRoomDetail, getRoomBookedDates } from '../services/rooms';
import { DEFAULT_ROOM_IMAGES, roomImages } from '../constants/rooms';
import formatCurrency from '../utils/formatCurrency';
import { apiErrorMessage, apiStatus } from '../utils/apiError';
import { toYmd, nightsBetween } from '../utils/dates';
import logError from '../utils/logError';

const BED_LABELS = {
  individual: 'Cama Individual',
  doble: 'Cama Doble',
  king: 'Cama King Size',
};

function formatDay(ymd) {
  if (!ymd) return '';
  const [y, m, d] = String(ymd).substring(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

/* ------------------------------------------------------------------ */
/* Galería accesible (flechas del teclado, miniaturas con aria-current) */
/* ------------------------------------------------------------------ */
function Gallery({ images, roomName }) {
  const [index, setIndex] = useState(0);
  const total = images.length;
  const current = images[Math.min(index, total - 1)];

  const go = useCallback((delta) => {
    setIndex((i) => (i + delta + total) % total);
  }, [total]);

  const handleKeyDown = (e) => {
    if (total < 2) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    if (e.key === 'Home') { e.preventDefault(); setIndex(0); }
    if (e.key === 'End') { e.preventDefault(); setIndex(total - 1); }
  };

  return (
    <section
      aria-roledescription="carrusel"
      aria-label={`Galería de imágenes de ${roomName}`}
      className="space-y-3"
    >
      <div
        className="relative bg-[#eae8e3] border border-[#d1c5af] p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227]"
        tabIndex={total > 1 ? 0 : -1}
        onKeyDown={handleKeyDown}
        aria-label={total > 1 ? 'Use las flechas izquierda y derecha para cambiar de imagen' : undefined}
      >
        <img
          src={current.url}
          alt={current.alt || roomName}
          className="w-full h-[280px] sm:h-[420px] object-cover"
        />
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Imagen anterior"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#fbf9f4]/90 border border-[#d1c5af] text-[#14213d] flex items-center justify-center hover:bg-[#c9a227] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Imagen siguiente"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#fbf9f4]/90 border border-[#d1c5af] text-[#14213d] flex items-center justify-center hover:bg-[#c9a227] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
            </button>
            <p className="absolute bottom-4 right-4 bg-[#14213d]/80 text-[#fbf9f4] font-mono text-[11px] px-2 py-1" aria-live="polite">
              {index + 1} / {total}
            </p>
          </>
        )}
      </div>

      {total > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Miniaturas">
          {images.map((img, i) => (
            <li key={img.url} className="flex-shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver imagen ${i + 1} de ${total}`}
                aria-current={i === index ? 'true' : undefined}
                className={`block w-20 h-16 border-2 p-0.5 cursor-pointer transition-colors ${
                  i === index ? 'border-[#c9a227]' : 'border-[#d1c5af] hover:border-[#755b00]'
                }`}
              >
                <img src={img.url} alt="" className="w-full h-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton de carga                                                    */
/* ------------------------------------------------------------------ */
function RoomDetailSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 animate-pulse" aria-busy="true" aria-label="Cargando habitación">
      <div className="h-4 w-48 bg-[#e4e2dd] mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          <div className="h-[280px] sm:h-[420px] bg-[#e4e2dd] border border-[#d1c5af]" />
          <div className="h-8 w-2/3 bg-[#e4e2dd]" />
          <div className="h-4 w-full bg-[#e4e2dd]" />
          <div className="h-4 w-5/6 bg-[#e4e2dd]" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-10 bg-[#e4e2dd]" />)}
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="h-[460px] bg-[#e4e2dd] border border-[#d1c5af]" />
        </div>
      </div>
    </div>
  );
}

export default function RoomDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Noches ocupadas (fechas YYYY-MM-DD) según el endpoint de fechas reservadas
  const [blockedNights, setBlockedNights] = useState(() => new Set());
  const [range, setRange] = useState([null, null]);
  const [rangeError, setRangeError] = useState('');

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);
  const bookingButtonRef = useRef(null);

  const [checkIn, checkOut] = range;

  // Cargar detalle de la habitación
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setNotFound(false);
    setError('');

    getRoomDetail(id, { signal: controller.signal })
      .then((data) => setRoom(data))
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (apiStatus(err) === 404) {
          setNotFound(true);
        } else {
          logError('room-detail:show', err);
          setError(apiErrorMessage(err, 'No se pudo cargar la habitación.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, reloadKey]);

  // Cargar fechas reservadas (calendario de disponibilidad)
  const loadBookedDates = useCallback(async (roomId) => {
    try {
      const intervals = await getRoomBookedDates(roomId);
      const nights = new Set();
      (intervals || []).forEach((b) => {
        const start = new Date(`${String(b.check_in).substring(0, 10)}T00:00:00`);
        const end = new Date(`${String(b.check_out).substring(0, 10)}T00:00:00`);
        for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
          nights.add(toYmd(d));
        }
      });
      setBlockedNights(nights);
    } catch (err) {
      logError('room-detail:booked-dates', err);
    }
  }, []);

  useEffect(() => {
    if (room?.id) loadBookedDates(room.id);
  }, [room?.id, loadBookedDates]);

  const images = useMemo(() => {
    if (!room) return [];
    // Galería real (SHE-035): principal primero, URLs resueltas con assetUrl
    const gallery = roomImages(room);
    if (gallery.length) return gallery;
    return [{ url: DEFAULT_ROOM_IMAGES[room.bed_type] || DEFAULT_ROOM_IMAGES.default, alt: room.name }];
  }, [room]);

  // CheckoutModal espera la misma forma que /rooms/available (image_url en lugar de images[])
  const checkoutRoom = useMemo(
    () => (room ? { ...room, image_url: images[0]?.url || null } : null),
    [room, images],
  );

  const fromPrice = useMemo(() => {
    if (!room) return 0;
    const candidates = [Number(room.price_per_night), Number(room.season_price_today?.price)]
      .filter((n) => Number.isFinite(n) && n > 0);
    return candidates.length ? Math.min(...candidates) : 0;
  }, [room]);

  // ¿Hay alguna noche ocupada en [start, end)?
  const rangeHasBlockedNight = useCallback((start, end) => {
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      if (blockedNights.has(toYmd(d))) return true;
    }
    return false;
  }, [blockedNights]);

  // Mientras se elige la salida, se permite cualquier fecha posterior hasta la primera noche ocupada.
  const filterDate = useCallback((date) => {
    if (date < startOfToday()) return false;
    if (checkIn && !checkOut) {
      if (date <= checkIn) return !blockedNights.has(toYmd(date));
      return !rangeHasBlockedNight(checkIn, date);
    }
    return !blockedNights.has(toYmd(date));
  }, [checkIn, checkOut, blockedNights, rangeHasBlockedNight]);

  const handleRangeChange = (dates) => {
    const [start, end] = dates;
    setRangeError('');
    if (start && end && toYmd(start) === toYmd(end)) {
      setRange([start, null]);
      return;
    }
    if (start && end && rangeHasBlockedNight(start, end)) {
      setRangeError('El rango seleccionado incluye noches no disponibles.');
      setRange([start, null]);
      return;
    }
    setRange([start, end]);
  };

  const nights = checkIn && checkOut ? nightsBetween(toYmd(checkIn), toYmd(checkOut)) : 0;

  const openCheckout = () => {
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }
    setCheckoutOpen(true);
  };

  /* --------------------------- Estados especiales --------------------------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] flex flex-col font-sans">
        <PublicHeader />
        <main className="flex-grow"><RoomDetailSkeleton /></main>
        <PublicFooter />
      </div>
    );
  }

  if (notFound || (!room && !error)) {
    return (
      <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] flex flex-col font-sans">
        <PublicHeader />
        <main className="flex-grow flex items-center justify-center px-4 py-20">
          <div className="max-w-lg w-full text-center bg-[#f5f3ee] border border-[#d1c5af] shadow-[2px_2px_0px_rgba(20,33,61,0.15)] p-10">
            <span className="material-symbols-outlined text-6xl text-[#c9a227]" aria-hidden="true">door_front</span>
            <p className="font-mono text-xs uppercase tracking-widest text-[#755b00] font-bold mt-4">Error 404</p>
            <h1 className="font-serif text-3xl font-bold text-[#14213d] mt-2">Habitación no disponible</h1>
            <p className="font-sans text-sm text-[#4d4635] mt-3">
              La habitación que buscas no existe o no está disponible para reservas en este momento.
            </p>
            <Link
              to="/habitaciones"
              className="inline-block mt-8 px-6 py-3 bg-[#c9a227] text-[#14213d] font-mono text-xs uppercase tracking-wider font-bold border border-[#a68a4d] hover:brightness-105 transition-all"
            >
              Ver todas las habitaciones
            </Link>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] flex flex-col font-sans">
        <PublicHeader />
        <main className="flex-grow flex items-center justify-center px-4 py-20">
          <div role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-6 text-[#93000a] text-center font-mono text-sm max-w-md">
            <span className="material-symbols-outlined text-3xl mb-2 block" aria-hidden="true">error</span>
            <p className="font-bold">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-4 px-4 py-2 bg-[#ba1a1a] text-white uppercase text-xs font-bold hover:bg-[#93000a] transition-colors cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  const todaySeason = room.season_price_today?.season;
  const upcomingSeasons = room.upcoming_seasons || [];

  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] flex flex-col font-sans">
      <PublicHeader />

      <main className="flex-grow">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {/* Migas de pan */}
          <nav aria-label="Ruta de navegación" className="mb-6">
            <ol className="flex items-center gap-2 font-mono text-xs text-[#4d4635]">
              <li><Link to="/" className="hover:text-[#755b00] underline-offset-2 hover:underline">Inicio</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link to="/habitaciones" className="hover:text-[#755b00] underline-offset-2 hover:underline">Habitaciones</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-[#755b00] font-bold truncate">Hab. {room.room_number}</li>
            </ol>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Columna izquierda: galería y descripción */}
            <div className="lg:col-span-7 space-y-8">
              <Gallery images={images} roomName={room.name} />

              <header>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="bg-[#c9a227] text-[#14213d] px-3 py-1 font-mono text-xs font-bold border border-[#14213d]">
                    HAB {room.room_number}
                  </span>
                  <span className="bg-[#f5f3ee] text-[#4d4635] px-2.5 py-1 font-mono text-[11px] uppercase border border-[#d1c5af]">
                    {room.type_label || BED_LABELS[room.bed_type] || room.bed_type}
                  </span>
                </div>
                <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1b1c19]">{room.name}</h1>
                <p className="font-sans text-sm sm:text-base text-[#4d4635] mt-4 leading-relaxed whitespace-pre-line">
                  {room.description || 'Alojamiento confortable con acabados de primera calidad, baño privado y servicio a la habitación.'}
                </p>
              </header>

              {/* Datos clave */}
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-[#4d4635] flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-[#755b00]" aria-hidden="true">person</span>
                    Capacidad
                  </dt>
                  <dd className="font-serif text-lg font-bold text-[#14213d] mt-1">
                    {room.capacity} {room.capacity === 1 ? 'huésped' : 'huéspedes'}
                  </dd>
                </div>
                <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-[#4d4635] flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-[#755b00]" aria-hidden="true">bed</span>
                    Tipo de cama
                  </dt>
                  <dd className="font-serif text-lg font-bold text-[#14213d] mt-1">{BED_LABELS[room.bed_type] || room.bed_type}</dd>
                </div>
                {room.size_m2 ? (
                  <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4">
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-[#4d4635] flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-[#755b00]" aria-hidden="true">square_foot</span>
                      Tamaño
                    </dt>
                    <dd className="font-serif text-lg font-bold text-[#14213d] mt-1">{room.size_m2} m²</dd>
                  </div>
                ) : null}
              </dl>

              {/* Amenidades */}
              <section aria-labelledby="amenities-title">
                <h2 id="amenities-title" className="font-serif text-xl font-bold text-[#1b1c19] mb-4 border-b border-[#d1c5af] pb-2">
                  Amenidades
                </h2>
                {(room.amenities || []).length === 0 && (
                  <p className="text-sm text-[#78716c]">Consulte con recepción las comodidades de esta habitación.</p>
                )}
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(room.amenities || []).map((a) => (
                    <li key={a.key} className="flex items-center gap-3 text-sm text-[#4d4635]">
                      <span className="material-symbols-outlined text-[#755b00]" aria-hidden="true">{a.icon || 'check'}</span>
                      {a.label}
                    </li>
                  ))}
                </ul>
              </section>

              {upcomingSeasons.length > 0 && (
                <section aria-labelledby="seasons-title">
                  <h2 id="seasons-title" className="font-serif text-xl font-bold text-[#1b1c19] mb-4 border-b border-[#d1c5af] pb-2">
                    Tarifas por temporada
                  </h2>
                  <ul className="divide-y divide-[#e4e2dd] border border-[#d1c5af] bg-[#f5f3ee]">
                    {upcomingSeasons.map((s) => (
                      <li key={`${s.name}-${s.start_date}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                        <div>
                          <p className="font-semibold text-[#14213d]">{s.name}</p>
                          <p className="font-mono text-[11px] text-[#4d4635]">
                            {formatDay(s.start_date)} – {formatDay(s.end_date)}
                            {' · '}
                            {s.adjustment_percent > 0 ? '+' : ''}{s.adjustment_percent}%
                          </p>
                        </div>
                        <p className="font-mono font-bold text-[#14213d]">
                          {formatCurrency(s.price_per_night)} <span className="text-[10px] font-normal text-[#4d4635]">/ noche</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Reseñas publicadas (SHE-037) */}
              <RoomReviews roomId={room.id} />
            </div>

            {/* Columna derecha: precio, calendario y reserva */}
            <aside className="lg:col-span-5" aria-labelledby="booking-title">
              <div className="bg-[#f5f3ee] border border-[#d1c5af] shadow-[2px_2px_0px_rgba(20,33,61,0.15)] p-5 sm:p-6 lg:sticky lg:top-6 space-y-5">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-[#4d4635]">Desde</p>
                  <p className="font-serif text-3xl font-bold text-[#14213d]">
                    {formatCurrency(fromPrice)} <span className="font-mono text-xs font-normal text-[#4d4635]">/ noche</span>
                  </p>
                  <p className="font-mono text-[11px] text-[#755b00] mt-1">IGV (18%) incluido</p>
                  {todaySeason && (
                    <p className="font-mono text-[11px] text-[#4d4635] mt-1">
                      Hoy aplica: <strong>{todaySeason}</strong> ({formatCurrency(room.season_price_today.price)} / noche)
                    </p>
                  )}
                </div>

                <div>
                  <h2 id="booking-title" className="font-mono text-xs uppercase font-bold text-[#14213d] tracking-wider mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-[#755b00]" aria-hidden="true">calendar_month</span>
                    Disponibilidad
                  </h2>
                  <div className="room-detail-calendar flex justify-center overflow-x-auto">
                    <DatePicker
                      inline
                      selectsRange
                      startDate={checkIn}
                      endDate={checkOut}
                      onChange={handleRangeChange}
                      minDate={new Date()}
                      filterDate={filterDate}
                      monthsShown={1}
                      dateFormat="dd/MM/yyyy"
                      ariaLabelPrefix="Seleccionar"
                    />
                  </div>
                  <ul className="flex flex-wrap gap-4 mt-3 font-mono text-[10px] text-[#4d4635]" aria-label="Leyenda del calendario">
                    <li className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-[#216ba5] inline-block" aria-hidden="true" /> Seleccionado
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-[#e4e2dd] border border-[#d1c5af] inline-block" aria-hidden="true" /> No disponible
                    </li>
                  </ul>
                  {rangeError && (
                    <p role="alert" className="text-[#ba1a1a] font-mono text-[11px] mt-2">{rangeError}</p>
                  )}
                </div>

                <div className="border-t border-[#d1c5af] pt-4 space-y-1 font-mono text-xs text-[#4d4635]" aria-live="polite">
                  {checkIn && checkOut ? (
                    <>
                      <p>Llegada: <strong className="text-[#14213d]">{formatDay(toYmd(checkIn))}</strong></p>
                      <p>Salida: <strong className="text-[#14213d]">{formatDay(toYmd(checkOut))}</strong></p>
                      <p>{nights} {nights === 1 ? 'noche' : 'noches'} · el total final se calcula en el checkout según temporada.</p>
                    </>
                  ) : checkIn ? (
                    <p>Selecciona la fecha de salida.</p>
                  ) : (
                    <p>Selecciona tus fechas de llegada y salida en el calendario.</p>
                  )}
                </div>

                <button
                  ref={bookingButtonRef}
                  type="button"
                  onClick={openCheckout}
                  className="w-full bg-[#c9a227] text-[#14213d] border border-[#a68a4d] py-3 font-mono text-xs uppercase tracking-wider font-bold hover:brightness-105 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">event_available</span>
                  {checkIn && checkOut ? 'Reservar estas fechas' : 'Reservar ahora'}
                </button>
                {!user && (
                  <p className="font-mono text-[10px] text-[#4d4635] text-center">Debes iniciar sesión para completar la reserva.</p>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>

      <PublicFooter />

      {checkoutOpen && (
        <CheckoutModal
          room={checkoutRoom}
          initialDates={{
            check_in: checkIn && checkOut ? toYmd(checkIn) : '',
            check_out: checkIn && checkOut ? toYmd(checkOut) : '',
          }}
          onClose={() => {
            setCheckoutOpen(false);
            bookingButtonRef.current?.focus();
          }}
          onPaymentSuccess={(result) => {
            const code = result?.booking_code || result?.booking?.booking_code;
            setCheckoutOpen(false);
            setRange([null, null]);
            if (code) {
              setActiveReceipt({ code, email: result?.guest_email || null });
            }
            loadBookedDates(room.id);
          }}
        />
      )}

      {activeReceipt && (
        <PaymentReceiptModal
          bookingCode={activeReceipt.code}
          guestEmail={activeReceipt.email}
          onClose={() => setActiveReceipt(null)}
        />
      )}
    </div>
  );
}
