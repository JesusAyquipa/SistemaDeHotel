import { useState, useEffect, useRef, useId } from 'react';
import { getAvailableRooms } from '../../services/rooms';
import { createCheckoutIntent, processMockPayment } from '../../services/paymentService';
import { createBooking, updateBooking } from '../../services/bookingService';
import CardFields from '../CardFields';
import GuestSearchBox from './GuestSearchBox';
import CashSessionRequiredAlert from './CashSessionRequiredAlert';
import { isCashSessionRequiredError } from '../../utils/cashSession';
import { EMPTY_CARD, validateCard, cardPayload } from '../../utils/card';
import { validateCoupon, couponDiscount } from '../../utils/coupon';
import { apiErrorMessage, apiStatus } from '../../utils/apiError';
import formatCurrency from '../../utils/formatCurrency';
import { nightsBetween } from '../../utils/dates';
import logError from '../../utils/logError';
import useEscapeKey from '../../hooks/useEscapeKey';

const NAME_PATTERN = "^[a-zA-ZáéíóúÁÉÍÓÚñÑ\\s]+$";
const PHONE_PATTERN = "^\\+?[0-9\\s\\-]+$";

let companionSeq = 0;
const newCompanion = (data = {}) => ({
  _key: `c${++companionSeq}`,
  name: '',
  surname: '',
  document_type: 'DNI',
  document_number: '',
  email: '',
  phone: '',
  ...data,
});

// Elimina campos solo de UI antes de enviar a la API
const cleanCompanions = (list) => list.map(({ name, surname, document_type, document_number, email, phone }) => ({
  name: name.trim(),
  surname: surname.trim(),
  document_type,
  document_number: document_number.trim(),
  email: email?.trim() || null,
  phone: phone?.trim() || null,
}));

function updateErrorMessage(err) {
  const status = apiStatus(err);
  const msg = err?.response?.data?.message;
  if (status === 402) return `Pago rechazado: ${msg || 'la tarjeta fue declinada. No se realizaron cambios.'}`;
  if (status === 404) return msg || 'No se encontró la reserva.';
  if (status === 409) return msg || 'La habitación no está disponible en las fechas seleccionadas.';
  return apiErrorMessage(err, 'Error al guardar los cambios de la reserva.');
}

const today = () => new Date().toISOString().split('T')[0];

/**
 * Modal de reservas para el personal.
 *  - booking = null  -> nueva reserva manual (walk-in / teléfono)
 *  - booking = objeto completo de la API -> edición real vía PUT /bookings/{code}
 */
export default function EditBookingModal({ isOpen, onClose, onSuccess, booking = null, initialRoomId = null, initialCheckIn = '', initialCheckOut = '' }) {
  const isEdit = !!booking;
  const uid = useId();
  const fid = (name) => `${uid}-${name}`;

  const [checkIn, setCheckIn] = useState(isEdit ? String(booking.check_in).substring(0, 10) : (initialCheckIn || ''));
  const [checkOut, setCheckOut] = useState(isEdit ? String(booking.check_out).substring(0, 10) : (initialCheckOut || ''));
  const [availableRooms, setAvailableRooms] = useState([]);
  const [roomId, setRoomId] = useState(isEdit && booking.room_id ? String(booking.room_id) : (initialRoomId ? String(initialRoomId) : ''));

  const [adults, setAdults] = useState(isEdit ? 1 + (booking.companions?.length || 0) : 2);
  const [children, setChildren] = useState(0);

  // Datos del huésped (solo nueva reserva)
  const [guest, setGuest] = useState({
    name: '', surname: '', document_type: 'DNI', document_number: '', email: '', phone: '',
  });
  const [companions, setCompanions] = useState([]);

  // Cupones (solo nueva reserva)
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');

  // Pagos
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [card, setCard] = useState(EMPTY_CARD);
  const [cardErrors, setCardErrors] = useState({});
  const [serverRequiresPayment, setServerRequiresPayment] = useState(null); // monto informado por el backend

  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  // 422 "Debes abrir caja antes de registrar cobros": se ofrece abrir la caja sin perder el formulario
  const [cashRequired, setCashRequired] = useState(false);
  const [cashNotice, setCashNotice] = useState('');
  const [loading, setLoading] = useState(false);

  // Reutilizar el checkout intent si se reintenta con los mismos datos
  const intentRef = useRef({ fingerprint: null, code: null });
  const roomsRequestRef = useRef(0);

  useEscapeKey(() => { if (!loading) onClose(); }, isOpen);

  // Cargar habitaciones disponibles para las fechas
  useEffect(() => {
    if (!isOpen || !checkIn || !checkOut || checkOut <= checkIn) return undefined;
    const requestId = ++roomsRequestRef.current;
    const capacity = isEdit
      ? 1 + (booking.companions?.length || 0)
      : (parseInt(adults, 10) || 1) + (parseInt(children, 10) || 0);
    getAvailableRooms({ check_in: checkIn, check_out: checkOut, capacity })
      .then((data) => {
        if (requestId !== roomsRequestRef.current) return;
        const list = Array.isArray(data) ? data : [];
        setAvailableRooms(list);
        if (!isEdit) {
          setRoomId((current) => {
            if (list.some((r) => String(r.id) === current)) return current;
            return list.length > 0 ? String(list[0].id) : '';
          });
        }
      })
      .catch((err) => {
        if (requestId !== roomsRequestRef.current) return;
        logError('edit-booking:rooms', err);
        setAvailableRooms([]);
      });
    return undefined;
  }, [isOpen, isEdit, booking, checkIn, checkOut, adults, children]);

  if (!isOpen) return null;

  // En edición, la habitación actual siempre es una opción (aunque /rooms/available la excluya)
  const roomOptions = (() => {
    const list = [...availableRooms];
    if (isEdit && booking.room && !list.some((r) => String(r.id) === String(booking.room.id))) {
      list.unshift(booking.room);
    }
    return list;
  })();
  const selectedRoom = roomOptions.find((r) => String(r.id) === String(roomId)) || null;
  const roomCapacity = selectedRoom?.capacity || 2;

  // Cálculo de totales (los precios incluyen IGV; el backend confirma el monto final)
  const nights = nightsBetween(checkIn, checkOut);
  const pricePerNight = selectedRoom ? parseFloat(selectedRoom.price_per_night) : 0;
  const subTotal = pricePerNight * nights;
  const discountAmount = couponDiscount(appliedCoupon, subTotal);
  const totalAmount = Math.max(0, subTotal - discountAmount);

  const currentTotal = isEdit ? Number(booking.total_amount || 0) : 0;
  const estimatedDifference = isEdit && selectedRoom && nights > 0 ? subTotal - currentTotal : 0;
  const editRequiresCard = isEdit && booking.status === 'confirmed'
    && (serverRequiresPayment !== null || estimatedDifference > 0);

  // ===== Huésped / acompañantes =====
  const updateGuest = (field, value) => setGuest((prev) => ({ ...prev, [field]: value }));

  const selectGuest = (g) => {
    setGuest({
      name: g.name || '',
      surname: g.surname || '',
      document_type: g.document_type || 'DNI',
      document_number: g.document_number || '',
      email: g.email || '',
      phone: g.phone || '',
    });
  };

  const handleAddCompanion = () => {
    if (companions.length + 1 >= roomCapacity) {
      setError(`No puedes añadir más acompañantes. La capacidad máxima de esta habitación es ${roomCapacity} persona(s).`);
      return;
    }
    setCompanions((prev) => [...prev, newCompanion()]);
  };

  const updateCompanion = (key, field, value) => {
    setCompanions((prev) => prev.map((c) => (c._key === key ? { ...c, [field]: value } : c)));
  };

  const selectCompanionGuest = (key, g) => {
    setCompanions((prev) => prev.map((c) => (c._key === key ? {
      ...c,
      name: g.name || '',
      surname: g.surname || '',
      document_type: g.document_type || 'DNI',
      document_number: g.document_number || '',
      email: g.email || '',
      phone: g.phone || '',
    } : c)));
  };

  const removeCompanion = (key) => setCompanions((prev) => prev.filter((c) => c._key !== key));

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      setAppliedCoupon(await validateCoupon(couponCode));
      setCouponError('');
    } catch (err) {
      setCouponError(err.message || 'Cupón inválido');
      setAppliedCoupon(null);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const validateCardFields = () => {
    const errors = validateCard(card);
    setCardErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Revise los datos de la tarjeta.');
      return false;
    }
    return true;
  };

  // ===== Guardar edición =====
  const submitEdit = async () => {
    if (!checkIn || !checkOut || nights < 1) {
      setError('La fecha de check-out debe ser posterior al check-in.');
      return;
    }
    if (!roomId) {
      setError('Seleccione una habitación.');
      return;
    }
    if (editRequiresCard && !validateCardFields()) return;

    setLoading(true);
    try {
      const payload = {
        check_in: checkIn,
        check_out: checkOut,
        room_id: parseInt(roomId, 10),
        ...(editRequiresCard ? cardPayload(card) : {}),
      };
      const response = await updateBooking(booking.booking_code, payload);
      if (response?.requires_payment) {
        setServerRequiresPayment(Number(response.amount_difference) || 0);
        setError('Se requiere cobrar la diferencia con tarjeta para confirmar la modificación.');
        return;
      }
      setCard(EMPTY_CARD);
      setResult({ type: 'edit', data: response });
      if (onSuccess) onSuccess(response);
    } catch (err) {
      logError('edit-booking:update', err);
      if (isCashSessionRequiredError(err)) setCashRequired(true);
      else setError(updateErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ===== Crear nueva reserva =====
  const submitCreate = async () => {
    if (!roomId) {
      setError('No hay una habitación disponible seleccionada para esas fechas.');
      return;
    }
    if (paymentMethod === 'card' && !validateCardFields()) return;

    const expectedCompanions = (Number(adults) + Number(children)) - 1;
    if (companions.length !== expectedCompanions) {
      setError(`Debe registrar la información de todos los huéspedes indicados. Se requieren ${expectedCompanions} acompañante(s) según la ocupación seleccionada.`);
      return;
    }

    const bookingPayload = {
      room_id: parseInt(roomId, 10),
      check_in: checkIn,
      check_out: checkOut,
      guest_name: guest.name.trim(),
      guest_surname: guest.surname.trim(),
      guest_email: guest.email.trim(),
      document_type: guest.document_type,
      document_number: guest.document_number.trim(),
      guest_phone: guest.phone.trim() || undefined,
      companions: cleanCompanions(companions),
      notes: 'Reserva creada manualmente desde recepción',
      coupon_code: appliedCoupon ? appliedCoupon.code : null,
    };

    setLoading(true);
    try {
      if (paymentMethod === 'card') {
        // 1. Intención de pago (reutilizando la reserva pendiente si los datos no cambiaron)
        const fingerprint = JSON.stringify(bookingPayload);
        let bookingCode = intentRef.current.fingerprint === fingerprint ? intentRef.current.code : null;
        if (!bookingCode) {
          const intent = await createCheckoutIntent(bookingPayload);
          bookingCode = intent.booking_code;
          intentRef.current = { fingerprint, code: bookingCode };
        }
        // 2. Cobro en la pasarela simulada
        try {
          const payment = await processMockPayment({ booking_code: bookingCode, ...cardPayload(card) });
          if (!payment?.success) {
            setError(payment?.message || 'El pago fue rechazado.');
            return;
          }
          setCard(EMPTY_CARD);
          setResult({
            type: 'create',
            method: 'card',
            booking_code: bookingCode,
            receipt_number: payment.receipt_number,
            transaction_id: payment.payment?.transaction_id,
            amount: payment.payment?.amount ?? totalAmount,
            discount: payment.payment?.payment_details?.discount_amount,
            coupon: payment.payment?.payment_details?.coupon_code,
          });
        } catch (payErr) {
          if ([404, 409, 410, 422].includes(apiStatus(payErr))) {
            intentRef.current = { fingerprint: null, code: null };
          }
          throw payErr;
        }
      } else {
        // Efectivo: reserva walk-in del personal (POST /bookings)
        const res = await createBooking({ ...bookingPayload, payment_method: paymentMethod });
        setResult({
          type: 'create',
          method: paymentMethod,
          booking_code: res.booking_code,
          receipt_number: res.receipt_number,
          transaction_id: res.ticket_code,
          amount: res.summary?.total_amount ?? res.summary?.total ?? res.booking?.total_amount ?? totalAmount,
        });
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      logError('edit-booking:create', err);
      if (isCashSessionRequiredError(err)) setCashRequired(true);
      else setError(apiErrorMessage(err, 'Error al procesar el cobro o la reserva.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    setError('');
    setCashRequired(false);
    setCashNotice('');
    if (isEdit) submitEdit();
    else submitCreate();
  };

  const inputClass = 'w-full bg-transparent border-b-2 border-[#d1c5af] focus:border-[#14213D] outline-none py-2 text-[#1b1c19]';
  const labelClass = 'font-mono text-[10px] font-medium text-[#4d4635] uppercase tracking-widest';

  // ===== Resultado =====
  if (result) {
    const isCashLater = result.method === 'cash_later';
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1c19]/80 backdrop-blur-sm p-4">
        <div role="dialog" aria-modal="true" aria-labelledby={fid('result-title')} className="bg-[#fbf9f4] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-[#d1c5af]">
          <div className="flex justify-between items-center p-6 border-b border-[#d1c5af] bg-[#f5f3ee]">
            <h2 id={fid('result-title')} className="font-serif text-2xl font-bold text-[#14213d] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#755b00]" aria-hidden="true">receipt_long</span>
              {result.type === 'edit' ? 'Reserva Modificada' : 'Comprobante de Reserva'}
            </h2>
            <button type="button" onClick={onClose} className="text-[#4d4635] hover:text-[#ba1a1a] transition-colors" aria-label="Cerrar">
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>

          <div className="overflow-y-auto p-6 space-y-6">
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#c9a227]/20 border-2 border-[#c9a227] mb-4">
                <span className="material-symbols-outlined text-4xl text-[#c9a227]" aria-hidden="true">check_circle</span>
              </div>
              {result.type === 'edit' ? (
                <>
                  <h3 className="font-serif text-2xl font-bold text-[#14213d] mb-1">¡Cambios Guardados!</h3>
                  <p className="font-sans text-sm text-[#4d4635]">{result.data?.message || 'La reserva fue modificada.'}</p>
                </>
              ) : (
                <>
                  <h3 className="font-serif text-2xl font-bold text-[#14213d] mb-1">
                    {isCashLater ? '¡Reserva Registrada!' : '¡Pago Confirmado!'}
                  </h3>
                  <p className="font-sans text-sm text-[#4d4635]">
                    {isCashLater
                      ? 'La reserva manual fue creada y el pago quedará pendiente en recepción.'
                      : `La reserva manual fue creada y cobrada exitosamente ${result.method === 'cash' ? 'en efectivo' : 'con tarjeta'}.`}
                  </p>
                </>
              )}
            </div>

            <div className="bg-[#f5f3ee] border-2 border-dashed border-[#c9a227] p-5 text-center">
              <span className="font-mono text-[11px] uppercase font-bold text-[#755b00] tracking-widest block mb-1">
                Código Único de Reserva
              </span>
              <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[#14213d] tracking-wider break-all">
                {result.type === 'edit' ? booking.booking_code : result.booking_code}
              </div>
            </div>

            {result.type === 'create' && (
              <div className="bg-[#f5f3ee] border border-[#d1c5af] p-5 space-y-3">
                <h4 className="font-mono text-xs uppercase font-bold text-[#14213d] tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#755b00]" aria-hidden="true">receipt</span>
                  Detalles del Comprobante
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs text-[#4d4635]">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#78716c] block">N° Comprobante</span>
                    <span className="font-bold text-[#1b1c19]">{result.receipt_number || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#78716c] block">ID Transacción / Ticket</span>
                    <span className="font-bold text-[#1b1c19] text-[10px] break-all">
                      {result.method === 'cash' ? 'EFECTIVO (CAJA)' : (result.transaction_id || '—')}
                    </span>
                  </div>
                  {Number(result.discount) > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#78716c] block">Descuento ({result.coupon})</span>
                      <span className="font-bold text-[#ba1a1a] text-sm">- {formatCurrency(result.discount)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#78716c] block">{isCashLater ? 'Monto Pendiente' : 'Monto Total Cobrado'}</span>
                    <span className="font-bold text-[#14213d] text-sm">{formatCurrency(result.amount)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#78716c] block">Fecha</span>
                    <span className="font-bold text-[#1b1c19]">{new Date().toLocaleString('es-PE')}</span>
                  </div>
                </div>
              </div>
            )}

            {result.type === 'edit' && result.data?.payment && (
              <div className="bg-[#f5f3ee] border border-[#d1c5af] p-5 font-mono text-xs text-[#4d4635] grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#78716c] block">N° Comprobante</span>
                  <span className="font-bold text-[#1b1c19]">{result.data.payment.receipt_number || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#78716c] block">Diferencia Cobrada</span>
                  <span className="font-bold text-[#14213d] text-sm">{formatCurrency(result.data.payment.amount)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-[#d1c5af] flex flex-col sm:flex-row justify-end gap-4 bg-[#f5f3ee]">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-6 py-2 border border-[#14213D] text-[#14213D] font-mono text-xs font-semibold uppercase tracking-widest hover:bg-[#eae8e3] transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">print</span>
              Imprimir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-[#755b00] hover:bg-[#c9a227] text-white font-mono text-xs font-semibold px-6 py-2 uppercase tracking-widest transition-colors shadow-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14213d]/60 backdrop-blur-sm font-sans p-4 sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby={fid('title')} className="bg-[#fbf9f4] w-full max-w-2xl max-h-[95vh] shadow-2xl relative flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#d1c5af]">
          <h2 id={fid('title')} className="font-serif text-2xl font-bold text-[#1b1c19]">
            {isEdit ? `Editar Reserva ${booking.booking_code}` : 'Nueva Reserva Manual'}
          </h2>
          <button type="button" onClick={onClose} className="text-[#4d4635] hover:text-[#1b1c19] transition-colors" aria-label="Cerrar">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        {/* Body */}
        <form id={fid('form')} onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
          {error && (
            <div role="alert" className="bg-[#ba1a1a]/10 text-[#ba1a1a] p-4 border border-[#ba1a1a]/20 font-mono text-sm">
              {error}
            </div>
          )}
          {cashRequired && (
            <CashSessionRequiredAlert
              onOpened={() => {
                setCashRequired(false);
                setCashNotice('Caja abierta. Vuelve a confirmar para registrar el cobro.');
              }}
            />
          )}
          {cashNotice && (
            <p role="status" className="bg-[#e8f5e9] text-[#1b5e20] border border-[#4caf50]/50 p-3 font-mono text-xs font-bold">{cashNotice}</p>
          )}

          {isEdit && (
            <div className="bg-[#eae8e3] border border-[#d1c5af] p-4 font-mono text-xs text-[#4d4635] grid grid-cols-1 sm:grid-cols-2 gap-2">
              <p><strong>Huésped:</strong> {booking.guest ? `${booking.guest.name} ${booking.guest.surname}` : '—'}</p>
              <p><strong>Total actual:</strong> {formatCurrency(currentTotal)}</p>
              {booking.companions?.length > 0 && (
                <p className="sm:col-span-2">
                  <strong>Acompañantes:</strong> {booking.companions.map((c) => `${c.name} ${c.surname}`).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Sección 1 */}
          <div className="space-y-4">
            <h3 className="font-serif text-lg font-semibold text-[#1b1c19] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#755b00]" aria-hidden="true">calendar_month</span>
              1. Fechas{isEdit ? '' : ' y Ocupación'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label htmlFor={fid('in')} className={labelClass}>Check-in</label>
                <input
                  id={fid('in')}
                  type="date"
                  required
                  value={checkIn}
                  min={isEdit ? undefined : today()}
                  onChange={(e) => { setCheckIn(e.target.value); setServerRequiresPayment(null); }}
                  className={`${inputClass} font-sans appearance-none`}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor={fid('out')} className={labelClass}>Check-out</label>
                <input
                  id={fid('out')}
                  type="date"
                  required
                  value={checkOut}
                  min={checkIn || today()}
                  onChange={(e) => { setCheckOut(e.target.value); setServerRequiresPayment(null); }}
                  className={`${inputClass} font-sans appearance-none`}
                />
              </div>
            </div>

            {!isEdit && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor={fid('adults')} className={labelClass}>Adultos</label>
                  <input id={fid('adults')} type="number" min="1" value={adults} onChange={(e) => setAdults(e.target.value)} className={`${inputClass} font-sans text-center`} />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor={fid('children')} className={labelClass}>Niños</label>
                  <input id={fid('children')} type="number" min="0" value={children} onChange={(e) => setChildren(e.target.value)} className={`${inputClass} font-sans text-center`} />
                </div>
              </div>
            )}
          </div>

          {/* Sección 2 */}
          <div className="space-y-4">
            <h3 className="font-serif text-lg font-semibold text-[#1b1c19] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#755b00]" aria-hidden="true">bed</span>
              2. Asignación de Habitación
            </h3>
            <div className="flex flex-col gap-2">
              <label htmlFor={fid('room')} className={labelClass}>Habitación disponible</label>
              <div className="relative">
                <select
                  id={fid('room')}
                  value={roomId}
                  onChange={(e) => { setRoomId(e.target.value); setServerRequiresPayment(null); }}
                  disabled={roomOptions.length === 0}
                  className={`${inputClass} pr-8 font-sans appearance-none cursor-pointer disabled:opacity-50`}
                >
                  {roomOptions.length === 0 ? (
                    <option value="">{checkIn && checkOut ? 'No hay habitaciones disponibles' : 'Seleccione las fechas primero'}</option>
                  ) : (
                    roomOptions.map((room) => (
                      <option key={room.id} value={String(room.id)}>
                        Habitación {room.room_number} - {room.name} ({formatCurrency(room.price_per_night)}/noche)
                        {isEdit && String(room.id) === String(booking.room_id) ? ' — actual' : ''}
                      </option>
                    ))
                  )}
                </select>
                <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-[#1b1c19] pointer-events-none" aria-hidden="true">expand_more</span>
              </div>
            </div>
          </div>

          {/* Edición: resumen de diferencia y cobro */}
          {isEdit && (
            <div className="space-y-4">
              <div className="bg-[#14213d] text-[#fbf9f4] p-4 font-mono text-sm border border-[#14213d] shadow-sm space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[#d1c5af] text-xs">Nuevo total estimado ({nights} {nights === 1 ? 'noche' : 'noches'})</span>
                  <span>{formatCurrency(subTotal)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#d1c5af]/30 font-bold">
                  <span className="text-[#c9a227]">Diferencia</span>
                  <span className="text-[#c9a227]">
                    {formatCurrency(serverRequiresPayment ?? estimatedDifference)}
                  </span>
                </div>
              </div>
              {booking.status === 'confirmed' && estimatedDifference < 0 && serverRequiresPayment === null && (
                <p className="bg-[#e8f5e9] border border-[#4caf50] text-[#1b5e20] p-3 font-mono text-xs">
                  Se registrará un reembolso pendiente según la política de reembolsos.
                </p>
              )}
              {booking.status === 'pending_payment' && (
                <p className="bg-[#fff3e0] border border-[#ff9800] text-[#e65100] p-3 font-mono text-xs">
                  La reserva aún no está pagada: el nuevo total se cobrará al registrar el pago.
                </p>
              )}
              {editRequiresCard && (
                <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4 space-y-3">
                  <p className="font-mono text-xs text-[#4d4635]">
                    La modificación incrementa el total. Ingrese la tarjeta del huésped para cobrar la diferencia.
                  </p>
                  <CardFields
                    card={card}
                    errors={cardErrors}
                    disabled={loading}
                    onChange={(next, name) => {
                      setCard(next);
                      if (cardErrors[name]) setCardErrors((prev) => ({ ...prev, [name]: null }));
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Sección 3: Datos del huésped (solo nueva reserva) */}
          {!isEdit && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-serif text-lg font-semibold text-[#1b1c19] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#755b00]" aria-hidden="true">person</span>
                  3. Datos del Huésped Principal
                </h3>

                <GuestSearchBox
                  onSelect={selectGuest}
                  placeholder="Buscar huésped existente por DNI, Nombre o Apellido..."
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label htmlFor={fid('g-name')} className={labelClass}>Nombre</label>
                    <input id={fid('g-name')} type="text" required pattern={NAME_PATTERN} title="Solo letras" value={guest.name} onChange={(e) => updateGuest('name', e.target.value)} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor={fid('g-surname')} className={labelClass}>Apellidos</label>
                    <input id={fid('g-surname')} type="text" required pattern={NAME_PATTERN} title="Solo letras" value={guest.surname} onChange={(e) => updateGuest('surname', e.target.value)} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor={fid('g-doctype')} className={labelClass}>Tipo de Documento</label>
                    <select id={fid('g-doctype')} value={guest.document_type} onChange={(e) => updateGuest('document_type', e.target.value)} className={`${inputClass} pr-8 appearance-none cursor-pointer`}>
                      <option value="DNI">DNI</option>
                      <option value="Pasaporte">Pasaporte</option>
                      <option value="Carnet Extranjería">Carnet Extranjería</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor={fid('g-docnum')} className={labelClass}>Nº Documento</label>
                    <input id={fid('g-docnum')} type="text" required pattern={guest.document_type === 'DNI' ? '^[0-9]{8}$' : '.*'} title={guest.document_type === 'DNI' ? 'DNI debe tener 8 dígitos numéricos' : 'Número de documento'} value={guest.document_number} onChange={(e) => updateGuest('document_number', e.target.value)} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor={fid('g-email')} className={labelClass}>Correo Electrónico</label>
                    <input id={fid('g-email')} type="email" required value={guest.email} onChange={(e) => updateGuest('email', e.target.value)} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor={fid('g-phone')} className={labelClass}>Teléfono (Opcional)</label>
                    <input id={fid('g-phone')} type="tel" pattern={PHONE_PATTERN} title="Solo números" value={guest.phone} onChange={(e) => updateGuest('phone', e.target.value)} className={inputClass} />
                  </div>
                </div>
              </div>

              {companions.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-[#d1c5af]/50">
                  <h4 className="font-serif text-md font-semibold text-[#1b1c19]">Acompañantes</h4>
                  {companions.map((companion, idx) => (
                    <div key={companion._key} className="bg-[#f5f3ee] p-4 relative border border-[#d1c5af]/30">
                      <button
                        type="button"
                        onClick={() => removeCompanion(companion._key)}
                        aria-label={`Quitar acompañante ${idx + 1}`}
                        className="absolute top-2 right-2 text-[#ba1a1a] hover:bg-[#ba1a1a]/10 p-1 rounded-full transition-colors z-20"
                      >
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
                      </button>

                      <div className="mb-4 mt-2 pr-8">
                        <GuestSearchBox
                          compact
                          label={`Buscar acompañante ${idx + 1}`}
                          placeholder="Buscar acompañante existente..."
                          onSelect={(g) => selectCompanionGuest(companion._key, g)}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          ['name', 'Nombre', 'text', NAME_PATTERN, true],
                          ['surname', 'Apellidos', 'text', NAME_PATTERN, true],
                        ].map(([field, label, type, pattern, required]) => (
                          <div key={field} className="flex flex-col gap-1">
                            <label htmlFor={fid(`${companion._key}-${field}`)} className="font-mono text-[9px] font-medium text-[#4d4635] uppercase">{label}</label>
                            <input id={fid(`${companion._key}-${field}`)} type={type} required={required} pattern={pattern} title="Solo letras" value={companion[field]} onChange={(e) => updateCompanion(companion._key, field, e.target.value)} className="w-full bg-transparent border-b border-[#d1c5af] focus:border-[#14213D] outline-none py-1 text-[#1b1c19] text-sm" />
                          </div>
                        ))}
                        <div className="flex flex-col gap-1">
                          <label htmlFor={fid(`${companion._key}-doctype`)} className="font-mono text-[9px] font-medium text-[#4d4635] uppercase">Tipo de Doc</label>
                          <select id={fid(`${companion._key}-doctype`)} value={companion.document_type} onChange={(e) => updateCompanion(companion._key, 'document_type', e.target.value)} className="w-full bg-transparent border-b border-[#d1c5af] focus:border-[#14213D] outline-none py-1 text-[#1b1c19] text-sm cursor-pointer">
                            <option value="DNI">DNI</option>
                            <option value="Pasaporte">Pasaporte</option>
                            <option value="Carnet Extranjería">Carnet Extranjería</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label htmlFor={fid(`${companion._key}-docnum`)} className="font-mono text-[9px] font-medium text-[#4d4635] uppercase">Nº Documento</label>
                          <input id={fid(`${companion._key}-docnum`)} type="text" required pattern={companion.document_type === 'DNI' ? '^[0-9]{8}$' : '.*'} title={companion.document_type === 'DNI' ? 'DNI de 8 dígitos numéricos' : ''} value={companion.document_number} onChange={(e) => updateCompanion(companion._key, 'document_number', e.target.value)} className="w-full bg-transparent border-b border-[#d1c5af] focus:border-[#14213D] outline-none py-1 text-[#1b1c19] text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label htmlFor={fid(`${companion._key}-email`)} className="font-mono text-[9px] font-medium text-[#4d4635] uppercase">Correo Electrónico (Opcional)</label>
                          <input id={fid(`${companion._key}-email`)} type="email" value={companion.email} onChange={(e) => updateCompanion(companion._key, 'email', e.target.value)} className="w-full bg-transparent border-b border-[#d1c5af] focus:border-[#14213D] outline-none py-1 text-[#1b1c19] text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label htmlFor={fid(`${companion._key}-phone`)} className="font-mono text-[9px] font-medium text-[#4d4635] uppercase">Teléfono (Opcional)</label>
                          <input id={fid(`${companion._key}-phone`)} type="tel" pattern={PHONE_PATTERN} title="Solo números" value={companion.phone} onChange={(e) => updateCompanion(companion._key, 'phone', e.target.value)} className="w-full bg-transparent border-b border-[#d1c5af] focus:border-[#14213D] outline-none py-1 text-[#1b1c19] text-sm" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {companions.length + 1 < roomCapacity && (
                <button
                  type="button"
                  onClick={handleAddCompanion}
                  className="text-[#755b00] font-mono text-xs font-semibold uppercase tracking-widest flex items-center gap-1 hover:text-[#c9a227] transition-colors"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">person_add</span>
                  Añadir Acompañante
                </button>
              )}
            </div>
          )}

          {/* Cupones (solo nueva reserva) */}
          {!isEdit && (
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-semibold text-[#1b1c19] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#755b00]" aria-hidden="true">sell</span>
                4. Cupón de Descuento (Opcional)
              </h3>
              <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4">
                {!appliedCoupon ? (
                  <div>
                    <div className="flex gap-2">
                      <label htmlFor={fid('coupon')} className="sr-only">Código de cupón</label>
                      <input
                        id={fid('coupon')}
                        type="text"
                        placeholder="Ingresa el código"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className={`${inputClass} font-sans uppercase`}
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        className="bg-[#14213d] hover:bg-[#0a1128] text-white font-mono text-[10px] font-bold uppercase tracking-widest px-4 py-2 transition-colors"
                      >
                        Aplicar
                      </button>
                    </div>
                    {couponError && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{couponError}</p>}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-[#e5efff] border border-[#0047b3] p-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#0047b3] text-sm" aria-hidden="true">check_circle</span>
                      <span className="font-mono text-xs font-bold text-[#0047b3]">{appliedCoupon.code} aplicado</span>
                    </div>
                    <button type="button" onClick={handleRemoveCoupon} className="text-[#ba1a1a] hover:text-[#93000a]" aria-label="Quitar cupón">
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pago (solo nueva reserva) */}
          {!isEdit && (
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-semibold text-[#1b1c19] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#755b00]" aria-hidden="true">payments</span>
                5. Método de Pago
              </h3>

              <div className="bg-[#14213d] text-[#fbf9f4] p-4 font-mono text-sm border border-[#14213d] shadow-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[#d1c5af] text-xs">Subtotal ({nights} {nights === 1 ? 'noche' : 'noches'})</span>
                  <span>{formatCurrency(subTotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center mb-1 text-[#e67e22]">
                    <span className="text-xs">Descuento ({appliedCoupon.code})</span>
                    <span>- {formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#d1c5af]/30 font-bold text-lg">
                  <span className="text-[#c9a227]">TOTAL A COBRAR</span>
                  <span className="text-[#c9a227]">{formatCurrency(totalAmount)}</span>
                </div>
                <p className="text-[10px] text-[#d1c5af] mt-1">Precios con IGV incluido.</p>
              </div>

              <fieldset className="bg-[#f5f3ee] border border-[#d1c5af] p-4 flex flex-col sm:flex-row flex-wrap gap-4">
                <legend className="sr-only">Método de pago</legend>
                {[
                  ['card', 'Tarjeta'],
                  ['cash', 'Efectivo (Caja / Presencial)'],
                  ['cash_later', 'Efectivo (Pago Pendiente)'],
                ].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer font-mono text-xs font-bold uppercase text-[#1b1c19]">
                    <input type="radio" name={fid('payment_method')} value={value} checked={paymentMethod === value} onChange={(e) => setPaymentMethod(e.target.value)} className="accent-[#14213D] w-4 h-4" />
                    {label}
                  </label>
                ))}
              </fieldset>

              {paymentMethod === 'card' ? (
                <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4">
                  <CardFields
                    card={card}
                    errors={cardErrors}
                    disabled={loading}
                    onChange={(next, name) => {
                      setCard(next);
                      if (cardErrors[name]) setCardErrors((prev) => ({ ...prev, [name]: null }));
                    }}
                  />
                </div>
              ) : paymentMethod === 'cash' ? (
                <div className="bg-[#e8f4fd] border border-[#7cb9e8]/50 p-4 flex items-center gap-3 font-mono text-sm text-[#1a5276]">
                  <span className="material-symbols-outlined text-[#2980b9]" aria-hidden="true">storefront</span>
                  <p>Al confirmar, la reserva se creará y el pago en efectivo se registrará en caja inmediatamente.</p>
                </div>
              ) : (
                <div className="bg-[#fff3cd] border border-[#ffeeba] p-4 flex items-center gap-3 font-mono text-sm text-[#856404]">
                  <span className="material-symbols-outlined text-[#856404]" aria-hidden="true">pending_actions</span>
                  <p>La reserva quedará confirmada con saldo pendiente para pagar en recepción (reserva por teléfono / WhatsApp).</p>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-[#d1c5af] flex flex-col-reverse sm:flex-row justify-end gap-4 bg-[#f5f3ee]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2 border border-[#14213D] text-[#14213D] font-mono text-xs font-semibold uppercase tracking-widest hover:bg-[#eae8e3] transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={fid('form')}
            disabled={loading}
            className="bg-[#755b00] hover:bg-[#c9a227] disabled:opacity-50 text-white font-mono text-xs font-semibold px-6 py-2 uppercase tracking-widest transition-colors shadow-sm"
          >
            {loading ? 'Procesando...' : (isEdit ? (editRequiresCard ? 'Cobrar y Guardar' : 'Guardar Cambios') : 'Crear Reserva')}
          </button>
        </div>
      </div>
    </div>
  );
}
