import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import StaffLayout from '../../components/StaffLayout';
import Toast from '../../components/Toast';
import EditBookingModal from '../../components/staff/EditBookingModal';
import { VipStar } from '../../components/staff/GuestFlags';
import { useAuth } from '../../context/AuthContext';
import useEscapeKey from '../../hooks/useEscapeKey';
import useFrontDeskActions from '../../hooks/useFrontDeskActions';
import { getRack, moveBooking } from '../../services/frontDeskService';
import {
  BOOKING_STATUS,
  MODIFIABLE_STATUSES,
  bookingStatusBadge,
  bookingStatusLabel,
} from '../../utils/bookingStatus';
import { apiErrorMessage, apiStatus } from '../../utils/apiError';
import formatCurrency from '../../utils/formatCurrency';
import { formatDmy, nightsBetween } from '../../utils/dates';
import { addDaysYmd, diffDays, parseYmd, roomAccountPath, todayYmd } from '../../utils/frontDesk';
import logError from '../../utils/logError';

const RANGE_OPTIONS = [7, 14, 30];
const DAY_WIDTH = { 7: 120, 14: 76, 30: 46 };
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const ROOM_STATUS = {
  disponible: { label: 'Disponible', dot: 'bg-[#4caf50]' },
  ocupada: { label: 'Ocupada', dot: 'bg-[#1976d2]' },
  limpieza: { label: 'Limpieza', dot: 'bg-[#ffb300]' },
  mantenimiento: { label: 'Mantenimiento', dot: 'bg-[#d32f2f]' },
  reservada: { label: 'Reservada', dot: 'bg-[#987d35]' },
};

const LEGEND_STATUSES = [
  BOOKING_STATUS.PENDING_PAYMENT,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
  BOOKING_STATUS.CHECKED_OUT,
];

const POPOVER_WIDTH = 320;

/** Mensaje legible para un intento fallido de mover la reserva. */
function moveErrorMessage(err) {
  const status = apiStatus(err);
  const data = err?.response?.data;
  if (status === 402) return `Pago rechazado: ${data?.message || 'no se realizaron cambios.'}`;
  if (status === 409) return data?.message || 'La habitación no está disponible en esas fechas.';
  if (status === 422 && data?.errors) {
    const first = Object.values(data.errors)[0];
    return Array.isArray(first) ? first[0] : String(first);
  }
  return apiErrorMessage(err, 'No se pudo mover la reserva.');
}

/**
 * Rack de ocupación (SHE-030): Gantt de habitaciones × días con reservas,
 * creación rápida en celdas libres y arrastrar/soltar para mover reservas.
 */
export default function FrontDeskRack() {
  const { user } = useAuth();
  const isAdmin = !!user?.roles?.includes('admin');
  const titleId = useId();
  const popoverTitleId = useId();

  const [start, setStart] = useState(todayYmd);
  const [days, setDays] = useState(14);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [toast, setToast] = useState(null);

  const [popover, setPopover] = useState(null); // { booking, room, x, y }
  const [moveForm, setMoveForm] = useState({ roomId: '', checkIn: '' });
  const [createAt, setCreateAt] = useState(null); // { roomId, date }
  const [moving, setMoving] = useState(false);
  const [focusCell, setFocusCell] = useState({ r: 0, c: 0 });
  const [dropTarget, setDropTarget] = useState(null); // `${r}:${c}`

  const dragRef = useRef(null); // { booking, roomId, grabOffset }
  const gridRef = useRef(null);
  const popoverRef = useRef(null);

  const today = todayYmd();
  const end = addDaysYmd(start, days);
  const dayWidth = DAY_WIDTH[days] || 60;

  const notify = useCallback((message, type = 'success') => setToast({ message, type }), []);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const { checkIn, checkOut, busyCode, dialogs } = useFrontDeskActions({
    isAdmin,
    notify,
    onDone: () => { setPopover(null); reload(); },
  });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getRack({ start, days }, { signal: controller.signal })
      .then((res) => setRooms(res.rooms || []))
      .catch((err) => {
        if (controller.signal.aborted) return;
        logError('front-desk:rack', err);
        setError(apiErrorMessage(err, 'No se pudo cargar el rack de ocupación.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [start, days, reloadKey]);

  useEscapeKey(() => setPopover(null), !!popover);

  useEffect(() => {
    if (popover) popoverRef.current?.focus();
  }, [popover]);

  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => {
    const ymd = addDaysYmd(start, i);
    const d = parseYmd(ymd);
    return {
      ymd,
      weekday: WEEKDAYS[d.getDay()],
      day: d.getDate(),
      month: MONTHS[d.getMonth()],
      weekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: ymd === today,
    };
  }), [start, days, today]);

  const occupancy = useMemo(() => {
    let occupied = 0;
    rooms.forEach((room) => (room.bookings || []).forEach((b) => {
      if (b.check_in <= today && b.check_out > today && b.status !== BOOKING_STATUS.CHECKED_OUT) occupied += 1;
    }));
    return occupied;
  }, [rooms, today]);

  /** Reserva que ocupa la noche `ymd` de una habitación. */
  const bookingAt = (room, ymd) => (room.bookings || []).find((b) => b.check_in <= ymd && b.check_out > ymd);

  // ── Navegación ────────────────────────────────────────────────────────
  const shift = (n) => setStart((s) => addDaysYmd(s, n));

  // ── Popover ───────────────────────────────────────────────────────────
  const openPopover = (booking, room, anchor) => {
    const rect = anchor?.getBoundingClientRect?.();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = rect ? Math.max(8, Math.min(rect.left, vw - POPOVER_WIDTH - 8)) : Math.max(8, (vw - POPOVER_WIDTH) / 2);
    const y = rect ? Math.max(8, Math.min(rect.bottom + 6, vh - 420)) : 80;
    setMoveForm({ roomId: String(room.id), checkIn: booking.check_in });
    setPopover({ booking, room, x, y });
  };

  // ── Mover reserva (drag & drop o formulario accesible) ─────────────────
  const applyMove = async (booking, fromRoomId, toRoomId, newCheckIn) => {
    const nights = nightsBetween(booking.check_in, booking.check_out);
    const newCheckOut = addDaysYmd(newCheckIn, nights);
    if (String(toRoomId) === String(fromRoomId) && newCheckIn === booking.check_in) return;
    if (!MODIFIABLE_STATUSES.includes(booking.status)) {
      notify('Solo se pueden mover reservas pendientes de pago o confirmadas.', 'error');
      return;
    }
    if (newCheckIn < today) {
      notify('No se puede mover una reserva a una fecha pasada.', 'error');
      return;
    }

    const snapshot = rooms;
    const moved = { ...booking, check_in: newCheckIn, check_out: newCheckOut };
    // Actualización optimista
    setRooms((prev) => prev.map((r) => {
      let list = (r.bookings || []).filter((b) => b.id !== booking.id);
      if (String(r.id) === String(toRoomId)) list = [...list, moved];
      return { ...r, bookings: list };
    }));
    setMoving(true);

    try {
      const res = await moveBooking(booking.booking_code, { roomId: Number(toRoomId), checkIn: newCheckIn, checkOut: newCheckOut });
      if (res?.requires_payment) {
        setRooms(snapshot);
        notify(
          `El cambio genera una diferencia de ${formatCurrency(res.amount_difference)} que debe cobrarse con tarjeta. Use "Editar reserva" en Reservas para completarlo.`,
          'error'
        );
        return;
      }
      notify(res?.message || `Reserva ${booking.booking_code} movida.`, 'success');
      setPopover(null);
      reload();
    } catch (err) {
      logError('front-desk:move', err);
      setRooms(snapshot);
      notify(moveErrorMessage(err), 'error');
    } finally {
      setMoving(false);
    }
  };

  const handleDragStart = (e, booking, room) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const visibleStart = booking.check_in < start ? start : booking.check_in;
    const offsetInBar = Math.floor((e.clientX - rect.left) / dayWidth);
    const grabOffset = Math.max(0, diffDays(booking.check_in, visibleStart) + offsetInBar);
    dragRef.current = { booking, roomId: room.id, grabOffset };
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', booking.booking_code); } catch { /* IE/Edge legacy */ }
  };

  const handleDrop = (e, room, ymd) => {
    e.preventDefault();
    setDropTarget(null);
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    applyMove(drag.booking, drag.roomId, room.id, addDaysYmd(ymd, -drag.grabOffset));
  };

  // ── Celdas: clic / teclado ────────────────────────────────────────────
  const activateCell = (room, day, anchor) => {
    const booking = bookingAt(room, day.ymd);
    if (booking) {
      openPopover(booking, room, anchor);
      return;
    }
    if (day.ymd < today) {
      notify('No se pueden crear reservas en fechas pasadas.', 'info');
      return;
    }
    if (room.status === 'mantenimiento') {
      notify(`La habitación ${room.room_number} está en mantenimiento.`, 'info');
      return;
    }
    setCreateAt({ roomId: room.id, date: day.ymd });
  };

  const focusGridCell = (r, c) => {
    const rr = Math.max(0, Math.min(rooms.length - 1, r));
    const cc = Math.max(0, Math.min(days - 1, c));
    setFocusCell({ r: rr, c: cc });
    gridRef.current?.querySelector(`[data-cell="${rr}:${cc}"]`)?.focus();
  };

  const handleCellKeyDown = (e, r, c, room, day) => {
    const keys = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
    if (keys[e.key]) {
      e.preventDefault();
      focusGridCell(r + keys[e.key][0], c + keys[e.key][1]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusGridCell(r, 0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusGridCell(r, days - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateCell(room, day, e.currentTarget);
    }
  };

  const gridTemplateColumns = `minmax(104px, 150px) repeat(${days}, ${dayWidth}px)`;
  const popBooking = popover?.booking;
  const popCanMove = popBooking && MODIFIABLE_STATUSES.includes(popBooking.status);
  const popCanCheckIn = popBooking && popBooking.status === BOOKING_STATUS.CONFIRMED && popBooking.check_in <= today;
  const popCanCheckOut = popBooking && popBooking.status === BOOKING_STATUS.CHECKED_IN;

  return (
    <StaffLayout>
      <main className="p-3 md:p-8">
        <div className="bg-[#fbf9f4] border border-[#d1c5af] shadow-sm p-3 md:p-6 space-y-4">
          {/* Encabezado */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#d1c5af] pb-4">
            <div>
              <p className="font-mono text-[10px] tracking-widest text-[#78716c] uppercase font-bold">Recepción</p>
              <h1 id={titleId} className="font-serif text-3xl md:text-4xl font-bold text-[#14213d] tracking-tight">Rack de ocupación</h1>
              <p className="text-sm text-[#4d4635] mt-1">
                {formatDmy(start)} — {formatDmy(addDaysYmd(end, -1))}
                {rooms.length > 0 && ` · Hoy: ${occupancy}/${rooms.length} habitaciones ocupadas`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center border border-[#d1c5af] bg-white" role="group" aria-label="Navegación de fechas">
                <button type="button" onClick={() => shift(-days)} className="p-2 hover:bg-[#f0eee9] cursor-pointer" aria-label={`Retroceder ${days} días`}>
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">chevron_left</span>
                </button>
                <button type="button" onClick={() => setStart(todayYmd())} className="px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#f0eee9] border-x border-[#d1c5af] cursor-pointer">
                  Hoy
                </button>
                <button type="button" onClick={() => shift(days)} className="p-2 hover:bg-[#f0eee9] cursor-pointer" aria-label={`Avanzar ${days} días`}>
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">chevron_right</span>
                </button>
              </div>
              <label className="sr-only" htmlFor={`${titleId}-start`}>Fecha de inicio</label>
              <input
                id={`${titleId}-start`}
                type="date"
                value={start}
                onChange={(e) => e.target.value && setStart(e.target.value)}
                className="border border-[#d1c5af] bg-white px-2 py-1.5 text-sm"
              />
              <div className="flex border border-[#d1c5af] bg-white" role="radiogroup" aria-label="Días visibles">
                {RANGE_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={days === n}
                    onClick={() => setDays(n)}
                    className={`px-3 py-2 font-mono text-xs font-bold cursor-pointer ${days === n ? 'bg-[#14213d] text-white' : 'hover:bg-[#f0eee9] text-[#14213d]'}`}
                  >
                    {n} días
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono" aria-label="Leyenda">
            {LEGEND_STATUSES.map((s) => (
              <span key={s} className={`border px-1.5 py-0.5 uppercase font-bold ${bookingStatusBadge(s)}`}>{bookingStatusLabel(s)}</span>
            ))}
            <span className="inline-flex items-center gap-1 text-[#4d4635]"><VipStar className="text-sm" /> VIP</span>
            <span className="inline-flex items-center gap-1 text-[#93000a]"><span className="material-symbols-outlined text-sm" aria-hidden="true">block</span> Lista negra</span>
            <span className="text-[#78716c] hidden md:inline">· Clic en una celda libre para reservar · Arrastre una reserva para moverla</span>
          </div>

          {error && (
            <div role="alert" className="bg-[#ffdad6] text-[#93000a] p-4 text-sm font-mono border border-[#ba1a1a]/30 flex items-center justify-between gap-4">
              <span>{error}</span>
              <button type="button" onClick={reload} className="underline font-bold cursor-pointer">Reintentar</button>
            </div>
          )}

          {/* Rack */}
          <div
            ref={gridRef}
            className={`relative overflow-auto border border-[#d1c5af] bg-white max-h-[70vh] ${loading || moving ? 'opacity-70' : ''}`}
            aria-busy={loading || moving}
          >
            {loading && rooms.length === 0 ? (
              <div className="p-10 text-center font-mono text-xs text-[#78716c] animate-pulse">Cargando rack...</div>
            ) : rooms.length === 0 ? (
              <div className="p-10 text-center font-mono text-xs text-[#78716c]">No hay habitaciones registradas.</div>
            ) : (
              <div
                role="grid"
                aria-labelledby={titleId}
                aria-rowcount={rooms.length + 1}
                aria-colcount={days + 1}
                className="grid w-max min-w-full"
                style={{ gridTemplateColumns, gridAutoRows: '44px' }}
              >
                {/* Cabecera */}
                <div role="row" className="contents">
                  <div
                    role="columnheader"
                    className="sticky top-0 left-0 z-30 bg-[#14213d] text-white font-mono text-[10px] uppercase tracking-widest flex items-center px-2 border-r border-[#d1c5af]"
                    style={{ gridRow: 1, gridColumn: 1 }}
                  >
                    Habitación
                  </div>
                  {dayList.map((d, c) => (
                    <div
                      key={d.ymd}
                      role="columnheader"
                      aria-label={`${d.weekday} ${d.day} ${d.month}${d.isToday ? ' (hoy)' : ''}`}
                      className={`sticky top-0 z-20 flex flex-col items-center justify-center border-r border-[#14213d]/30 leading-tight ${d.isToday ? 'bg-[#c9a227] text-[#14213d]' : d.weekend ? 'bg-[#2a3c63] text-white' : 'bg-[#14213d] text-white'}`}
                      style={{ gridRow: 1, gridColumn: c + 2 }}
                    >
                      <span className="font-mono text-[9px] uppercase">{d.weekday}</span>
                      <span className="font-bold text-sm">{d.day}{days <= 14 ? <span className="font-normal text-[10px] ml-0.5">{d.month}</span> : null}</span>
                    </div>
                  ))}
                </div>

                {/* Filas de habitaciones */}
                {rooms.map((room, r) => {
                  const row = r + 2;
                  const rs = ROOM_STATUS[room.status] || { label: room.status, dot: 'bg-gray-400' };
                  return (
                    <div role="row" key={room.id} className="contents">
                      <div
                        role="rowheader"
                        className="sticky left-0 z-10 bg-[#f5f3ee] border-r border-b border-[#d1c5af] px-2 flex items-center gap-2 min-w-0"
                        style={{ gridRow: row, gridColumn: 1 }}
                        title={`${room.name} · ${rs.label}`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${rs.dot}`} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block font-mono text-xs font-bold text-[#14213d]">{room.room_number}</span>
                          <span className="block text-[10px] text-[#4d4635] truncate">{rs.label}</span>
                        </span>
                      </div>

                      {dayList.map((d, c) => {
                        const isFocus = focusCell.r === r && focusCell.c === c;
                        const occupiedBy = bookingAt(room, d.ymd);
                        const key = `${r}:${c}`;
                        return (
                          <div
                            key={d.ymd}
                            role="gridcell"
                            data-cell={key}
                            tabIndex={isFocus ? 0 : -1}
                            aria-label={occupiedBy
                              ? `Habitación ${room.room_number}, ${formatDmy(d.ymd)}: ${occupiedBy.guest_name || occupiedBy.code}`
                              : `Habitación ${room.room_number}, ${formatDmy(d.ymd)}: libre${d.ymd >= today ? '. Enter para reservar' : ''}`}
                            onFocus={() => setFocusCell({ r, c })}
                            onClick={(e) => activateCell(room, d, e.currentTarget)}
                            onKeyDown={(e) => handleCellKeyDown(e, r, c, room, d)}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dropTarget !== key) setDropTarget(key); }}
                            onDragLeave={() => setDropTarget((t) => (t === key ? null : t))}
                            onDrop={(e) => handleDrop(e, room, d.ymd)}
                            className={`border-r border-b border-[#e4e2dd] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#14213d] ${
                              dropTarget === key ? 'bg-[#c9a227]/40' : d.isToday ? 'bg-[#fff8e1]' : d.weekend ? 'bg-[#f0eee9]' : 'bg-white'
                            } ${!occupiedBy && d.ymd >= today ? 'cursor-pointer hover:bg-[#c9a227]/15' : ''}`}
                            style={{ gridRow: row, gridColumn: c + 2 }}
                          />
                        );
                      })}

                      {/* Barras de reservas */}
                      {(room.bookings || []).map((b) => {
                        const visStart = b.check_in < start ? start : b.check_in;
                        const visEnd = b.check_out > end ? end : b.check_out;
                        const span = diffDays(visStart, visEnd);
                        if (span <= 0) return null;
                        const col = diffDays(start, visStart) + 2;
                        const draggable = MODIFIABLE_STATUSES.includes(b.status);
                        const nights = nightsBetween(b.check_in, b.check_out);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            draggable={draggable}
                            onDragStart={(e) => handleDragStart(e, b, room)}
                            onDragEnd={() => { dragRef.current = null; setDropTarget(null); }}
                            onClick={(e) => openPopover(b, room, e.currentTarget)}
                            aria-haspopup="dialog"
                            aria-label={`Reserva ${b.code}: ${b.guest_name || 'Huésped'}, habitación ${room.room_number}, ${formatDmy(b.check_in)} a ${formatDmy(b.check_out)}, ${bookingStatusLabel(b.status)}${b.vip ? ', VIP' : ''}${b.blacklisted ? ', lista negra' : ''}`}
                            title={`${b.guest_name || ''} · ${b.code} · ${nights} ${nights === 1 ? 'noche' : 'noches'}`}
                            className={`relative z-[5] my-1.5 mx-0.5 px-1.5 flex items-center gap-1 border text-left overflow-hidden rounded-sm shadow-sm text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-[#14213d] ${bookingStatusBadge(b.status)} ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${b.check_in < start ? 'rounded-l-none border-l-0' : ''} ${b.check_out > end ? 'rounded-r-none border-r-0' : ''}`}
                            style={{ gridRow: row, gridColumn: `${col} / span ${span}` }}
                          >
                            {b.vip && <VipStar className="text-sm shrink-0" />}
                            {b.blacklisted && <span className="material-symbols-outlined text-sm text-[#ba1a1a] shrink-0" aria-hidden="true">block</span>}
                            <span className="truncate">{b.guest_name || b.code}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p className="font-mono text-[10px] text-[#78716c]">
            Teclado: use las flechas para recorrer el rack y Enter para reservar o ver la reserva. Desde el detalle puede mover la reserva sin arrastrar.
          </p>
        </div>
      </main>

      {/* Popover de detalle */}
      {popover && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setPopover(null)} />
          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby={popoverTitleId}
            tabIndex={-1}
            className="fixed z-50 bg-[#fbf9f4] border border-[#14213d] shadow-xl p-4 outline-none max-h-[80vh] overflow-y-auto"
            style={{ left: popover.x, top: popover.y, width: `min(${POPOVER_WIDTH}px, calc(100vw - 16px))` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 id={popoverTitleId} className="font-serif font-bold text-lg text-[#14213d] break-words">
                  {popBooking.vip && <VipStar className="text-base mr-1" />}
                  {popBooking.guest_name || 'Huésped'}
                </h2>
                <p className="font-mono text-[11px] text-[#4d4635]">{popBooking.code} · Hab. {popover.room.room_number}</p>
              </div>
              <button type="button" onClick={() => setPopover(null)} className="p-1 text-[#4d4635] hover:text-[#14213d] cursor-pointer" aria-label="Cerrar detalle">
                <span className="material-symbols-outlined text-lg" aria-hidden="true">close</span>
              </button>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div><dt className="font-mono text-[10px] uppercase text-[#78716c]">Entrada</dt><dd className="font-semibold">{formatDmy(popBooking.check_in)}</dd></div>
              <div><dt className="font-mono text-[10px] uppercase text-[#78716c]">Salida</dt><dd className="font-semibold">{formatDmy(popBooking.check_out)}</dd></div>
              <div><dt className="font-mono text-[10px] uppercase text-[#78716c]">Estado</dt><dd><span className={`inline-block border px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase ${bookingStatusBadge(popBooking.status)}`}>{bookingStatusLabel(popBooking.status)}</span></dd></div>
              <div><dt className="font-mono text-[10px] uppercase text-[#78716c]">Total</dt><dd className="font-semibold">{formatCurrency(popBooking.total_amount)}</dd></div>
            </dl>

            {popBooking.blacklisted && (
              <p role="alert" className="mt-3 bg-[#ffdad6] text-[#93000a] text-xs p-2 border border-[#ba1a1a]/40">
                Huésped en <strong>lista negra</strong>. Consulte su ficha antes de continuar.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {popCanCheckOut && (
                <Link
                  to={`${roomAccountPath(isAdmin, popover.room.id)}${popBooking?.id ? `?booking_id=${popBooking.id}` : ''}`}
                  className="inline-flex items-center gap-1 border border-[#d1c5af] hover:border-[#14213d] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#14213d]"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">receipt_long</span> Ver cuenta
                </Link>
              )}
              {popCanCheckIn && (
                <button
                  type="button"
                  disabled={busyCode === popBooking.code}
                  onClick={() => checkIn({ ...popBooking, booking_code: popBooking.code })}
                  className="inline-flex items-center gap-1 bg-[#2E7A4A] hover:bg-[#3f9e63] text-white px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">login</span> Check-in
                </button>
              )}
              {popCanCheckOut && (
                <button
                  type="button"
                  disabled={busyCode === popBooking.code}
                  onClick={() => checkOut({ ...popBooking, booking_code: popBooking.code })}
                  className="inline-flex items-center gap-1 bg-[#755b00] hover:bg-[#c9a227] text-white px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">logout</span> Check-out
                </button>
              )}
              {popBooking.guest_id && (
                <Link
                  to={`${isAdmin ? '/admin' : '/recepcionista'}/huespedes/${popBooking.guest_id}`}
                  className="inline-flex items-center gap-1 border border-[#d1c5af] hover:border-[#14213d] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#14213d]"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">person</span> Ficha
                </Link>
              )}
            </div>

            {popCanMove && (
              <form
                className="mt-4 pt-3 border-t border-[#d1c5af] grid grid-cols-2 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyMove(
                    { ...popBooking, booking_code: popBooking.code },
                    popover.room.id,
                    moveForm.roomId,
                    moveForm.checkIn
                  );
                }}
              >
                <p className="col-span-2 font-mono text-[10px] uppercase font-bold text-[#4d4635]">Mover reserva</p>
                <label className="text-[10px] font-mono uppercase text-[#78716c]">
                  Habitación
                  <select
                    value={moveForm.roomId}
                    onChange={(e) => setMoveForm((f) => ({ ...f, roomId: e.target.value }))}
                    className="mt-0.5 w-full border border-[#d1c5af] bg-white p-1.5 text-xs normal-case"
                  >
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_number} · {r.name}</option>)}
                  </select>
                </label>
                <label className="text-[10px] font-mono uppercase text-[#78716c]">
                  Nueva entrada
                  <input
                    type="date"
                    min={today}
                    value={moveForm.checkIn}
                    onChange={(e) => setMoveForm((f) => ({ ...f, checkIn: e.target.value }))}
                    className="mt-0.5 w-full border border-[#d1c5af] bg-white p-1.5 text-xs"
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={moving}
                  className="col-span-2 bg-[#14213d] hover:bg-[#0a1628] text-white border border-[#c9a227] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 cursor-pointer"
                >
                  {moving ? 'Moviendo...' : 'Mover (mantiene las noches)'}
                </button>
              </form>
            )}
          </div>
        </>
      )}

      {createAt && (
        <EditBookingModal
          isOpen={!!createAt}
          onClose={() => setCreateAt(null)}
          onSuccess={reload}
          booking={null}
          initialRoomId={createAt.roomId}
          initialCheckIn={createAt.date}
          initialCheckOut={addDaysYmd(createAt.date, 1)}
        />
      )}

      {dialogs}

      <Toast message={toast?.message} isOpen={!!toast} type={toast?.type} onClose={() => setToast(null)} duration={7000} />
    </StaffLayout>
  );
}
