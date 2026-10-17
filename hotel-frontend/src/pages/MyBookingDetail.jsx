import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import CancelBookingModal from '../components/CancelBookingModal';
import ModifyBookingModal from '../components/ModifyBookingModal';
import Toast from '../components/Toast';
import FolioTable from '../components/portal/FolioTable';
import PreCheckInForm from '../components/portal/PreCheckInForm';
import ReviewForm from '../components/portal/ReviewForm';
import { getBookingByCode } from '../services/bookingService';
import { getBookingFolio, getBookingInvoice, getBookingReview } from '../services/guestPortalService';
import { downloadInvoicePdf } from '../utils/invoiceDownload';
import { bookingStatusBadge, bookingStatusLabel, MODIFIABLE_STATUSES, BOOKING_STATUS } from '../utils/bookingStatus';
import formatCurrency from '../utils/formatCurrency';
import { formatDmy, nightsBetween } from '../utils/dates';
import { apiErrorMessage, apiStatus } from '../utils/apiError';
import logError from '../utils/logError';

function Section({ id, icon, title, children, aside }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="bg-white border border-[#d1c5af] shadow-[2px_2px_0px_rgba(20,33,61,0.10)] scroll-mt-24">
      <header className="px-5 py-3 border-b border-[#eae8e3] bg-[#fbf9f4] flex items-center justify-between gap-3 flex-wrap">
        <h2 id={`${id}-title`} className="font-serif text-lg font-bold text-[#14213d] flex items-center gap-2">
          <span className="material-symbols-outlined text-[#c9a227]" aria-hidden="true">{icon}</span>
          {title}
        </h2>
        {aside}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/**
 * Detalle de una reserva del cliente (SHE-036): estadía, folio, comprobante,
 * pre check-in, modificar/cancelar y reseña (SHE-037).
 */
export default function MyBookingDetail() {
  const { code } = useParams();
  const location = useLocation();

  const [booking, setBooking] = useState(null);
  const [folio, setFolio] = useState(null);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [invoiceState, setInvoiceState] = useState({ loading: false, message: '' });
  const [showCancel, setShowCancel] = useState(false);
  const [showModify, setShowModify] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setNotFound(false);

    Promise.all([getBookingByCode(code), getBookingFolio(code)])
      .then(async ([bookingRes, folioRes]) => {
        if (!active) return;
        const b = bookingRes.booking;
        setBooking(b);
        setFolio(folioRes);
        if (b?.status === BOOKING_STATUS.CHECKED_OUT) {
          try {
            const r = await getBookingReview(code);
            if (active) setReview(r);
          } catch (err) {
            if (apiStatus(err) !== 404) logError('portal:review', err);
            if (active) setReview(null);
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        if (apiStatus(err) === 404) setNotFound(true);
        else {
          logError('portal:booking', err);
          setError(apiErrorMessage(err, 'No se pudo cargar la reserva.'));
        }
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [code, reloadKey]);

  // Desplazarse a la sección del hash (#pre-check-in, #resena) cuando el contenido existe.
  useEffect(() => {
    if (loading || !location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loading, location.hash]);

  const handleDownloadInvoice = async () => {
    setInvoiceState({ loading: true, message: '' });
    try {
      const invoice = await getBookingInvoice(code);
      await downloadInvoicePdf(invoice, invoice?.hotel);
      setInvoiceState({ loading: false, message: '' });
    } catch (err) {
      if (apiStatus(err) === 404) {
        setInvoiceState({ loading: false, message: 'Aún no emitido. El comprobante se emite al finalizar tu estadía.' });
      } else {
        logError('portal:invoice', err);
        setInvoiceState({ loading: false, message: err?.response ? apiErrorMessage(err, 'No se pudo descargar el comprobante.') : (err?.message || 'No se pudo descargar el comprobante.') });
      }
    }
  };

  const showPreCheckIn = booking?.status === BOOKING_STATUS.CONFIRMED;
  const canReview = booking?.status === BOOKING_STATUS.CHECKED_OUT;
  const nights = booking ? nightsBetween(booking.check_in, booking.check_out) : 0;

  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] flex flex-col font-sans">
      <PublicHeader />

      <main className="flex-grow max-w-[1000px] mx-auto w-full px-4 sm:px-6 py-10">
        <nav aria-label="Ruta de navegación" className="mb-6">
          <ol className="flex items-center gap-2 font-mono text-xs text-[#4d4635]">
            <li><Link to="/cliente/mis-reservas" className="hover:text-[#755b00] hover:underline">Mis reservas</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-[#755b00] font-bold">{code}</li>
          </ol>
        </nav>

        {loading ? (
          <div className="space-y-6" aria-busy="true">
            <div className="h-36 bg-[#eae8e3] animate-pulse border border-[#d1c5af]" />
            <div className="h-64 bg-[#eae8e3] animate-pulse border border-[#d1c5af]" />
          </div>
        ) : notFound ? (
          <div className="text-center py-20 bg-[#f5f3ee] border border-[#d1c5af]">
            <span className="material-symbols-outlined text-6xl text-[#d1c5af]" aria-hidden="true">search_off</span>
            <h1 className="font-serif text-xl font-bold text-[#4d4635] mt-2">Reserva no encontrada</h1>
            <Link to="/cliente/mis-reservas" className="inline-block mt-4 font-mono text-xs uppercase underline text-[#755b00]">Volver a mis reservas</Link>
          </div>
        ) : error ? (
          <div role="alert" className="bg-[#ffdad6] text-[#93000a] p-4 text-sm border border-[#ba1a1a]/30 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={reload} className="font-mono text-xs uppercase underline cursor-pointer">Reintentar</button>
          </div>
        ) : booking && (
          <div className="space-y-6">
            {/* Cabecera de la estadía */}
            <section className="bg-white border border-[#d1c5af] shadow-[2px_2px_0px_rgba(20,33,61,0.15)]">
              <div className="p-5 border-b border-[#eae8e3] bg-[#fbf9f4] flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-[10px] text-[#755b00] font-bold uppercase tracking-widest block mb-1">Reserva</span>
                  <h1 className="font-serif font-bold text-2xl text-[#14213d] break-all">{booking.booking_code}</h1>
                </div>
                <span className={`px-2 py-1 text-[10px] uppercase font-mono font-bold border ${bookingStatusBadge(booking.status)}`}>
                  {bookingStatusLabel(booking.status)}
                </span>
              </div>
              <dl className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <dt className="font-mono text-[10px] uppercase text-[#4d4635]">Check-in</dt>
                  <dd className="font-semibold text-sm">{formatDmy(booking.check_in)} <span className="text-[#4d4635] font-normal">· 15:00</span></dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-[#4d4635]">Check-out</dt>
                  <dd className="font-semibold text-sm">{formatDmy(booking.check_out)} <span className="text-[#4d4635] font-normal">· 12:00</span></dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-[#4d4635]">Habitación</dt>
                  <dd className="font-semibold text-sm">
                    {booking.room?.name || '—'}
                    {booking.room?.room_number && <span className="block font-mono text-xs text-[#4d4635]">Hab. {booking.room.room_number}</span>}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-[#4d4635]">Total ({nights} {nights === 1 ? 'noche' : 'noches'})</dt>
                  <dd className="font-mono font-bold text-lg text-[#14213d]">{formatCurrency(folio?.totals?.total ?? booking.total_amount)}</dd>
                </div>
              </dl>

              <div className="px-5 pb-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  disabled={invoiceState.loading}
                  className="px-4 py-2 bg-[#14213d] text-white font-mono text-xs uppercase font-bold hover:bg-[#c9a227] hover:text-[#14213d] transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">receipt_long</span>
                  {invoiceState.loading ? 'Generando…' : 'Descargar comprobante'}
                </button>
                {MODIFIABLE_STATUSES.includes(booking.status) && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowModify(true)}
                      className="px-4 py-2 bg-white border border-[#a68a4d] text-[#14213d] font-mono text-xs uppercase font-bold hover:bg-[#c9a227] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">edit_calendar</span>
                      Modificar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancel(true)}
                      className="px-4 py-2 bg-white border border-[#ba1a1a] text-[#ba1a1a] font-mono text-xs uppercase font-bold hover:bg-[#ba1a1a] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">cancel</span>
                      Cancelar
                    </button>
                  </>
                )}
              </div>
              {invoiceState.message && (
                <p role="status" className="mx-5 mb-5 bg-[#f5f3ee] border border-[#d1c5af] text-xs text-[#4d4635] px-3 py-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#755b00]" aria-hidden="true">info</span>
                  {invoiceState.message}
                </p>
              )}
            </section>

            {showPreCheckIn && (
              <Section id="pre-check-in" icon="how_to_reg" title="Pre check-in online">
                <p className="text-sm text-[#4d4635] mb-4">
                  Adelanta tu registro y evita esperas en recepción. Disponible desde 7 días antes de tu llegada.
                </p>
                <PreCheckInForm bookingCode={booking.booking_code} />
              </Section>
            )}

            {canReview && (
              <Section id="resena" icon="rate_review" title={review ? 'Tu reseña' : 'Dejar reseña'}>
                <ReviewForm
                  bookingCode={booking.booking_code}
                  review={review}
                  onSubmitted={(r, msg) => {
                    setReview(r);
                    setToast({ open: true, message: msg || '¡Gracias por tu reseña!', type: 'success' });
                  }}
                />
              </Section>
            )}

            <Section id="folio" icon="account_balance_wallet" title="Estado de cuenta">
              <FolioTable folio={folio} />
            </Section>
          </div>
        )}
      </main>

      <PublicFooter />

      <Toast isOpen={toast.open} message={toast.message} type={toast.type} onClose={() => setToast((t) => ({ ...t, open: false }))} />

      {showCancel && booking && (
        <CancelBookingModal
          booking={booking}
          onClose={() => setShowCancel(false)}
          onSuccess={() => {
            setShowCancel(false);
            reload();
          }}
        />
      )}
      {showModify && booking && (
        <ModifyBookingModal
          booking={booking}
          onClose={() => setShowModify(false)}
          onSuccess={() => {
            setShowModify(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
