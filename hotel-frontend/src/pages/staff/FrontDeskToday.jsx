import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StaffLayout from '../../components/StaffLayout';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import GuestFlags from '../../components/staff/GuestFlags';
import { useAuth } from '../../context/AuthContext';
import useFrontDeskActions from '../../hooks/useFrontDeskActions';
import { getToday, markNoShow } from '../../services/frontDeskService';
import { BOOKING_STATUS, bookingStatusBadge, bookingStatusLabel } from '../../utils/bookingStatus';
import { apiErrorMessage, apiStatus } from '../../utils/apiError';
import formatCurrency from '../../utils/formatCurrency';
import { formatDmy, nightsBetween } from '../../utils/dates';
import logError from '../../utils/logError';
import { roomAccountPath } from '../../utils/frontDesk';

const COLUMNS = [
  { id: 'arrivals', title: 'Llegadas', icon: 'flight_land', accent: 'border-t-[#2E7A4A]', empty: 'No hay llegadas programadas para hoy.' },
  { id: 'departures', title: 'Salidas', icon: 'flight_takeoff', accent: 'border-t-[#755b00]', empty: 'No hay salidas pendientes hoy.' },
  { id: 'in_house', title: 'En casa', icon: 'hotel', accent: 'border-t-[#1565c0]', empty: 'No hay huéspedes alojados.' },
  { id: 'no_show_candidates', title: 'Posibles no-show', icon: 'person_off', accent: 'border-t-[#ba1a1a]', empty: 'Sin posibles no-show.' },
];

const REFRESH_MS = 120000;

const btnBase = 'inline-flex items-center gap-1 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';

function PreCheckIn({ data }) {
  if (!data) {
    return <p className="font-mono text-[10px] text-[#78716c]">Sin pre check-in online.</p>;
  }
  const companions = Array.isArray(data.companions) ? data.companions : [];
  return (
    <div className="bg-[#e8f5e9] border border-[#4caf50]/40 p-2 text-xs text-[#1b5e20] space-y-0.5">
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
        <span className="material-symbols-outlined text-sm" aria-hidden="true">task_alt</span>
        Pre check-in recibido
      </p>
      {data.arrival_time && <p>Llegada estimada: <strong>{String(data.arrival_time).substring(0, 5)}</strong></p>}
      {(data.document_type || data.document_number) && <p>Documento: {data.document_type} {data.document_number}</p>}
      {data.nationality && <p>Nacionalidad: {data.nationality}</p>}
      {companions.length > 0 && <p>Acompañantes: {companions.length}</p>}
      {data.special_requests && <p className="italic">“{data.special_requests}”</p>}
    </div>
  );
}

function BookingCard({ booking, column, isAdmin, busy, onCheckIn, onCheckOut, onNoShow }) {
  const guest = booking.guest || {};
  const nights = nightsBetween(booking.check_in, booking.check_out);
  const balance = Number(booking.balance) || 0;
  const preferences = Array.isArray(guest.preferences) ? guest.preferences : [];
  const canCheckIn = booking.status === BOOKING_STATUS.CONFIRMED;
  const isCheckedIn = booking.status === BOOKING_STATUS.CHECKED_IN;

  return (
    <li className={`bg-white border border-[#d1c5af] p-3 shadow-sm flex flex-col gap-2 ${guest.is_blacklisted ? 'border-l-4 border-l-[#ba1a1a]' : guest.is_vip ? 'border-l-4 border-l-[#c9a227]' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-serif font-bold text-[#14213d] break-words">
            {guest.name} {guest.surname} <GuestFlags guest={guest} compact />
          </p>
          <p className="font-mono text-[10px] text-[#4d4635]">{booking.booking_code}</p>
        </div>
        {booking.room && (
          <span className="shrink-0 bg-[#14213d] text-white font-mono text-xs font-bold px-2 py-1" title={booking.room.name}>
            {booking.room.room_number}
          </span>
        )}
      </div>

      <p className="text-xs text-[#4d4635] font-mono">
        {formatDmy(booking.check_in)} → {formatDmy(booking.check_out)} · {nights} {nights === 1 ? 'noche' : 'noches'}
        {booking.companions_count > 0 ? ` · +${booking.companions_count} acomp.` : ''}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-block px-1.5 py-0.5 border text-[10px] font-mono font-bold uppercase ${bookingStatusBadge(booking.status)}`}>
          {bookingStatusLabel(booking.status)}
        </span>
        {(column === 'departures' || column === 'in_house') && (
          <span className={`inline-block px-1.5 py-0.5 border text-[10px] font-mono font-bold uppercase ${balance > 0.009 ? 'bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]' : 'bg-[#e8f5e9] text-[#1b5e20] border-[#4caf50]'}`}>
            {balance > 0.009 ? `Saldo ${formatCurrency(balance)}` : 'Sin saldo'}
          </span>
        )}
      </div>

      {guest.is_blacklisted && (
        <p role="alert" className="bg-[#ffdad6] text-[#93000a] text-xs p-2 border border-[#ba1a1a]/40">
          <strong>Lista negra.</strong> {guest.blacklist_reason || 'Consulte con administración antes de continuar.'}
        </p>
      )}
      {(guest.notes || preferences.length > 0) && (
        <div className="text-xs text-[#4d4635] space-y-1">
          {guest.notes && <p className="line-clamp-2" title={guest.notes}><span className="font-bold">Notas:</span> {guest.notes}</p>}
          {preferences.length > 0 && (
            <ul className="flex flex-wrap gap-1" aria-label="Preferencias">
              {preferences.map((p) => (
                <li key={p} className="bg-[#f5f3ee] border border-[#d1c5af] px-1.5 py-0.5 text-[10px]">{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {column === 'arrivals' && <PreCheckIn data={booking.pre_check_in} />}

      <div className="flex flex-wrap gap-2 pt-1 border-t border-[#e4e2dd]">
        {column === 'arrivals' && (
          canCheckIn ? (
            <button type="button" disabled={busy} onClick={() => onCheckIn(booking)} className={`${btnBase} bg-[#2E7A4A] text-white hover:bg-[#3f9e63]`}>
              <span className="material-symbols-outlined text-sm" aria-hidden="true">login</span> Check-in
            </button>
          ) : (
            <span className="font-mono text-[10px] text-[#78716c] py-1.5">
              {isCheckedIn ? 'Ya ingresó' : 'Pago pendiente: no admite check-in'}
            </span>
          )
        )}
        {(column === 'departures' || column === 'in_house') && booking.room && (
          <Link to={roomAccountPath(isAdmin, booking.room.id)} className={`${btnBase} border border-[#d1c5af] text-[#14213d] hover:border-[#14213d]`}>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">receipt_long</span> Ver cuenta
          </Link>
        )}
        {(column === 'departures' || (column === 'in_house' && isCheckedIn)) && (
          <button type="button" disabled={busy} onClick={() => onCheckOut(booking)} className={`${btnBase} bg-[#755b00] text-white hover:bg-[#c9a227]`}>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">logout</span> Check-out
          </button>
        )}
        {column === 'no_show_candidates' && (
          <button type="button" disabled={busy} onClick={() => onNoShow(booking)} className={`${btnBase} border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6]`}>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">person_off</span> Marcar no-show
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Panel "Hoy" de recepción (SHE-031): llegadas, salidas, en casa y posibles no-show.
 */
export default function FrontDeskToday() {
  const { user } = useAuth();
  const isAdmin = !!user?.roles?.includes('admin');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState('arrivals');
  const [toast, setToast] = useState(null);
  const [noShowTarget, setNoShowTarget] = useState(null);
  const [noShowBusy, setNoShowBusy] = useState(false);

  const notify = useCallback((message, type = 'success') => setToast({ message, type }), []);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const { checkIn, checkOut, busyCode, dialogs } = useFrontDeskActions({ isAdmin, notify, onDone: reload });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getToday({ signal: controller.signal })
      .then((res) => setData(res))
      .catch((err) => {
        if (controller.signal.aborted) return;
        logError('front-desk:today', err);
        setError(apiErrorMessage(err, 'No se pudo cargar el panel del día.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const id = setInterval(reload, REFRESH_MS);
    return () => clearInterval(id);
  }, [reload]);

  const handleNoShow = async () => {
    if (!noShowTarget) return;
    setNoShowBusy(true);
    try {
      const res = await markNoShow(noShowTarget.booking_code);
      notify(res?.message || `Reserva ${noShowTarget.booking_code} marcada como no-show.`, 'success');
      reload();
    } catch (err) {
      logError('front-desk:no-show', err);
      const msg = err?.response?.data?.message;
      if (apiStatus(err) === 404 && (!msg || /could not be found|not found/i.test(msg))) {
        notify('La función "no-show" aún no está disponible en el servidor.', 'error');
      } else {
        notify(apiErrorMessage(err, 'No se pudo marcar la reserva como no-show.'), 'error');
      }
    } finally {
      setNoShowBusy(false);
      setNoShowTarget(null);
    }
  };

  const counts = data?.counts || {};
  const todayLabel = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <StaffLayout>
      <main className="p-4 md:p-10">
        <div className="bg-[#fbf9f4] border border-[#d1c5af] shadow-sm p-4 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#d1c5af] pb-4">
            <div>
              <p className="font-mono text-[10px] tracking-widest text-[#78716c] uppercase font-bold">Recepción</p>
              <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#14213d] tracking-tight">Hoy</h1>
              <p className="font-sans text-sm text-[#4d4635] mt-1 capitalize">{todayLabel}</p>
            </div>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="inline-flex items-center gap-2 border border-[#d1c5af] hover:border-[#14213d] px-4 py-2 font-mono text-xs uppercase tracking-wider font-bold text-[#14213d] disabled:opacity-50 cursor-pointer"
            >
              <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`} aria-hidden="true">refresh</span>
              Actualizar
            </button>
          </div>

          {/* Contadores (también funcionan como pestañas en pantallas pequeñas) */}
          <div role="tablist" aria-label="Secciones del día" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {COLUMNS.map((col) => {
              const selected = activeTab === col.id;
              return (
                <button
                  key={col.id}
                  type="button"
                  role="tab"
                  id={`tab-${col.id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${col.id}`}
                  onClick={() => setActiveTab(col.id)}
                  className={`text-left bg-white border p-3 md:p-4 border-t-4 ${col.accent} transition-shadow cursor-pointer ${selected ? 'border-[#14213d] shadow-md' : 'border-[#d1c5af] hover:shadow'}`}
                >
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#4d4635] font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-base" aria-hidden="true">{col.icon}</span>
                    {col.title}
                  </span>
                  <span className="block font-serif text-3xl font-bold text-[#14213d] mt-1">
                    {loading && !data ? '…' : (counts[col.id] ?? (data?.[col.id]?.length || 0))}
                  </span>
                  {col.id === 'arrivals' && counts.arrivals_pending !== undefined && (
                    <span className="block font-mono text-[10px] text-[#4d4635]">{counts.arrivals_pending} por ingresar</span>
                  )}
                </button>
              );
            })}
          </div>

          {error && (
            <div role="alert" className="bg-[#ffdad6] text-[#93000a] p-4 text-sm font-mono border border-[#ba1a1a]/30 flex items-center justify-between gap-4">
              <span>{error}</span>
              <button type="button" onClick={reload} className="underline font-bold cursor-pointer">Reintentar</button>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">
            {COLUMNS.map((col) => {
              const items = data?.[col.id] || [];
              return (
                <section
                  key={col.id}
                  id={`panel-${col.id}`}
                  role="tabpanel"
                  aria-labelledby={`tab-${col.id}`}
                  className={`${activeTab === col.id ? 'flex' : 'hidden xl:flex'} flex-col gap-3 bg-[#f5f3ee] border border-[#d1c5af] p-3 min-w-0`}
                >
                  <h2 className="font-serif text-lg font-bold text-[#14213d] flex items-center justify-between">
                    {col.title}
                    <span className="font-mono text-xs text-[#78716c]">{items.length}</span>
                  </h2>
                  {loading && !data ? (
                    <div className="space-y-2 animate-pulse" aria-hidden="true">
                      {[1, 2].map((i) => <div key={i} className="h-24 bg-[#e4e2dd]" />)}
                    </div>
                  ) : items.length === 0 ? (
                    <p className="font-mono text-xs text-[#78716c] py-6 text-center">{col.empty}</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {items.map((b) => (
                        <BookingCard
                          key={`${col.id}-${b.id}`}
                          booking={b}
                          column={col.id}
                          isAdmin={isAdmin}
                          busy={busyCode === b.booking_code || noShowBusy}
                          onCheckIn={checkIn}
                          onCheckOut={checkOut}
                          onNoShow={setNoShowTarget}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </main>

      {dialogs}

      <ConfirmDialog
        isOpen={!!noShowTarget}
        title="Marcar como no-show"
        message={noShowTarget ? `¿Marcar la reserva ${noShowTarget.booking_code} (${noShowTarget.guest?.name || ''} ${noShowTarget.guest?.surname || ''}) como "No se presentó"? Se aplicará la penalidad vigente y se liberará la habitación.` : ''}
        confirmLabel="Marcar no-show"
        variant="danger"
        busy={noShowBusy}
        onConfirm={handleNoShow}
        onCancel={() => setNoShowTarget(null)}
      />

      <Toast message={toast?.message} isOpen={!!toast} type={toast?.type} onClose={() => setToast(null)} />
    </StaffLayout>
  );
}
