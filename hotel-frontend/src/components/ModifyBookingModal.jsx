import { useState, useEffect, useId } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { updateBooking } from '../services/bookingService';
import { getRoomBookedDates } from '../services/rooms';
import CardFields from './CardFields';
import { EMPTY_CARD, validateCard, cardPayload } from '../utils/card';
import { apiErrorMessage, apiStatus } from '../utils/apiError';
import formatCurrency from '../utils/formatCurrency';
import { toYmd, nightsBetween } from '../utils/dates';
import logError from '../utils/logError';
import useEscapeKey from '../hooks/useEscapeKey';

/**
 * Traduce un error de PUT /bookings/{code} a un mensaje para el usuario.
 */
function updateErrorMessage(err) {
  const status = apiStatus(err);
  const msg = err?.response?.data?.message;
  switch (status) {
    case 402:
      return `Pago rechazado: ${msg || 'la tarjeta fue declinada. No se realizaron cambios en la reserva.'}`;
    case 404:
      return msg || 'No se encontró la reserva o no tiene permiso para modificarla.';
    case 409:
      return msg || 'La habitación no está disponible en las nuevas fechas.';
    case 422:
      return msg || 'Los datos ingresados no son válidos.';
    default:
      return apiErrorMessage(err, 'Error al modificar la reserva.');
  }
}

export default function ModifyBookingModal({ booking, onClose, onSuccess }) {
  const uid = useId();
  const titleId = `${uid}-title`;

  const [step, setStep] = useState('dates'); // 'dates' | 'payment' | 'success'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkIn, setCheckIn] = useState(String(booking.check_in).substring(0, 10));
  const [checkOut, setCheckOut] = useState(String(booking.check_out).substring(0, 10));
  const [serverDifference, setServerDifference] = useState(null);
  const [bookedIntervals, setBookedIntervals] = useState([]);
  const [successData, setSuccessData] = useState(null);
  const [card, setCard] = useState(EMPTY_CARD);
  const [fieldErrors, setFieldErrors] = useState({});

  useEscapeKey(() => { if (!loading && step !== 'success') onClose(); });

  useEffect(() => {
    if (!booking?.room_id) return undefined;
    let cancelled = false;
    getRoomBookedDates(booking.room_id, booking.id)
      .then((datesArray) => {
        if (cancelled) return;
        setBookedIntervals((datesArray || []).map((b) => ({
          start: new Date(`${b.check_in}T00:00:00`),
          end: new Date(`${b.check_out}T00:00:00`),
        })));
      })
      .catch((err) => logError('modify:booked-dates', err));
    return () => { cancelled = true; };
  }, [booking?.room_id, booking?.id]);

  // Estimación local de la diferencia (el backend calcula el monto definitivo).
  const pricePerNight = Number(booking.room?.price_per_night) || null;
  const nights = nightsBetween(checkIn, checkOut);
  const estimatedDifference = pricePerNight && nights > 0
    ? nights * pricePerNight - Number(booking.total_amount || 0)
    : null;
  const difference = serverDifference ?? estimatedDifference;

  const buildPayload = () => ({
    check_in: checkIn,
    check_out: checkOut,
    room_id: booking.room_id,
  });

  const handleResponse = (response) => {
    // Compatibilidad: si el backend indica que se requiere pago, pasar al paso de tarjeta.
    if (response?.requires_payment) {
      setServerDifference(Number(response.amount_difference) || null);
      setStep('payment');
      return;
    }
    setSuccessData(response);
    setStep('success');
  };

  const handleSubmitDates = async (e) => {
    e?.preventDefault();
    setError('');
    if (!checkIn || !checkOut || nights < 1) {
      setError('La fecha de check-out debe ser posterior al check-in.');
      return;
    }
    setServerDifference(null);
    if (estimatedDifference !== null && estimatedDifference > 0) {
      setStep('payment');
      return;
    }
    setLoading(true);
    try {
      const response = await updateBooking(booking.booking_code, buildPayload());
      handleResponse(response);
    } catch (err) {
      logError('modify:update', err);
      const data = err?.response?.data;
      const status = apiStatus(err);
      // Sin tarjeta: un 402 o un 422 que exige datos de tarjeta implica que hay diferencia a pagar.
      const needsCard = data?.requires_payment || status === 402 || (status === 422 && data?.errors?.card_number);
      if (needsCard) {
        setServerDifference(Number(data?.amount_difference) || null);
        setStep('payment');
      } else {
        setError(updateErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    setError('');
    const errors = validateCard(card);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const response = await updateBooking(booking.booking_code, {
        ...buildPayload(),
        ...cardPayload(card),
      });
      setCard(EMPTY_CARD);
      handleResponse(response);
    } catch (err) {
      logError('modify:pay', err);
      setError(updateErrorMessage(err));
      const apiErrors = err?.response?.data?.errors;
      if (apiErrors && typeof apiErrors === 'object') {
        setFieldErrors(Object.fromEntries(
          Object.entries(apiErrors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
        ));
      }
    } finally {
      setLoading(false);
    }
  };

  const datePickerClass = 'w-full bg-[#f5f3ee] border border-[#d1c5af] p-3 font-sans text-sm text-[#1b1c19] focus:outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227] transition-all';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14213d]/80 backdrop-blur-sm overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-[#fbf9f4] max-w-lg w-full border border-[#d1c5af] shadow-lg flex flex-col max-h-[95vh]"
      >
        <div className="p-6 border-b border-[#d1c5af] flex justify-between items-center bg-[#eae8e3]">
          <h2 id={titleId} className="font-serif text-xl font-bold text-[#1b1c19]">
            {step === 'success' ? '¡Reserva Actualizada!' : 'Modificar Fechas de Reserva'}
          </h2>
          {step !== 'success' && (
            <button type="button" onClick={onClose} className="text-[#4d4635] hover:text-[#1b1c19]" aria-label="Cerrar">
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmitDates} className="p-6 flex flex-col gap-4 overflow-y-auto">
          {step !== 'success' && (
            <div className="bg-[#eae8e3] p-4 font-mono text-xs text-[#4d4635] mb-2 border border-[#d1c5af]">
              <p><strong>Reserva:</strong> {booking.booking_code}</p>
              <p><strong>Habitación:</strong> {booking.room?.name || `Habitación ID: ${booking.room_id}`}</p>
            </div>
          )}

          {step === 'success' && successData && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#c9a227]/20 border-2 border-[#c9a227] mb-4">
                  <span className="material-symbols-outlined text-4xl text-[#c9a227]" aria-hidden="true">check_circle</span>
                </div>
                <h3 className="font-serif text-2xl font-bold text-[#14213d] mb-1">¡Modificación Exitosa!</h3>
                <p className="font-sans text-sm text-[#4d4635]">{successData.message || 'Las fechas de su reserva han sido modificadas.'}</p>
              </div>

              <div className="bg-[#f5f3ee] border-2 border-dashed border-[#c9a227] p-5 text-center">
                <span className="font-mono text-[11px] uppercase font-bold text-[#755b00] tracking-widest block mb-1">
                  Código Único de Reserva
                </span>
                <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[#14213d] tracking-wider break-all">
                  {booking.booking_code}
                </div>
              </div>

              {successData.payment && Number(successData.payment.amount) > 0 && (
                <div className="bg-[#f5f3ee] border border-[#d1c5af] p-5 space-y-3">
                  <h4 className="font-mono text-xs uppercase font-bold text-[#14213d] tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-[#755b00]" aria-hidden="true">receipt</span>
                    Comprobante de Pago
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs text-[#4d4635]">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#78716c] block">N° Comprobante</span>
                      <span className="font-bold text-[#1b1c19]">{successData.payment.receipt_number || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#78716c] block">Monto Cobrado</span>
                      <span className="font-bold text-[#14213d] text-sm">{formatCurrency(successData.payment.amount)}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => onSuccess(successData)}
                className="w-full px-4 py-3 bg-[#c9a227] text-[#14213d] font-mono text-xs uppercase font-bold hover:brightness-105 transition-colors flex items-center justify-center gap-2 border border-[#a68a4d] cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">done</span>
                Aceptar y Continuar
              </button>
            </div>
          )}

          {step === 'dates' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`${uid}-in`} className="block font-mono text-xs uppercase tracking-wider text-[#4d4635] font-bold mb-2">
                    Nuevo Check-in
                  </label>
                  <DatePicker
                    id={`${uid}-in`}
                    selected={checkIn ? new Date(`${checkIn}T12:00:00`) : null}
                    onChange={(date) => { if (date) setCheckIn(toYmd(date)); }}
                    minDate={new Date()}
                    excludeDateIntervals={bookedIntervals}
                    dateFormat="dd/MM/yyyy"
                    className={datePickerClass}
                    placeholderText="DD/MM/YYYY"
                  />
                </div>
                <div>
                  <label htmlFor={`${uid}-out`} className="block font-mono text-xs uppercase tracking-wider text-[#4d4635] font-bold mb-2">
                    Nuevo Check-out
                  </label>
                  <DatePicker
                    id={`${uid}-out`}
                    selected={checkOut ? new Date(`${checkOut}T12:00:00`) : null}
                    onChange={(date) => { if (date) setCheckOut(toYmd(date)); }}
                    minDate={checkIn ? new Date(`${checkIn}T12:00:00`) : new Date()}
                    excludeDateIntervals={bookedIntervals}
                    dateFormat="dd/MM/yyyy"
                    className={datePickerClass}
                    placeholderText="DD/MM/YYYY"
                  />
                </div>
              </div>

              {estimatedDifference !== null && nights > 0 && (
                <div className="bg-[#f5f3ee] border border-[#d1c5af] p-3 font-mono text-xs text-[#4d4635] space-y-1">
                  <div className="flex justify-between">
                    <span>Nuevo total estimado ({nights} {nights === 1 ? 'noche' : 'noches'}):</span>
                    <span className="font-bold text-[#14213d]">{formatCurrency(nights * pricePerNight)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Diferencia estimada:</span>
                    <span className={`font-bold ${estimatedDifference > 0 ? 'text-[#ba1a1a]' : 'text-[#1b5e20]'}`}>
                      {estimatedDifference > 0 ? '+ ' : ''}{formatCurrency(estimatedDifference)}
                    </span>
                  </div>
                  {estimatedDifference > 0 && (
                    <p className="text-[11px] text-[#78716c] pt-1">Se le solicitará el pago de la diferencia con tarjeta.</p>
                  )}
                  {estimatedDifference < 0 && (
                    <p className="text-[11px] text-[#1b5e20] pt-1">Se registrará un reembolso pendiente según la política de reembolsos del hotel.</p>
                  )}
                </div>
              )}

              {error && (
                <div role="alert" className="bg-[#ffdad6] text-[#93000a] p-3 text-xs font-mono font-bold border border-[#ba1a1a]/30 mt-2">
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-[#eae8e3] text-[#14213d] font-mono text-xs uppercase font-bold hover:bg-[#d1c5af] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-[#c9a227] text-[#14213d] font-mono text-xs uppercase font-bold hover:brightness-105 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer border border-[#a68a4d]"
                >
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </>
          )}

          {step === 'payment' && (
            <div className="space-y-4">
              <div className="bg-[#14213d] text-[#fbf9f4] p-4 text-center">
                <span className="font-mono text-[10px] uppercase text-[#c9a227] tracking-widest block mb-1 font-bold">
                  Monto Adicional a Pagar {serverDifference === null ? '(estimado)' : ''}
                </span>
                <span className="font-mono text-2xl font-bold text-[#fbf9f4]">
                  {difference !== null ? formatCurrency(difference) : '—'}
                </span>
                <span className="font-mono text-[10px] text-[#d1c5af] block mt-1">
                  El monto final lo confirma el sistema al procesar el pago.
                </span>
              </div>

              <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4 space-y-4">
                <h3 className="font-mono text-xs uppercase font-bold text-[#14213d] tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#755b00]" aria-hidden="true">credit_card</span>
                  Datos de la Tarjeta
                </h3>
                <CardFields
                  card={card}
                  disabled={loading}
                  errors={fieldErrors}
                  onChange={(next, name) => {
                    setCard(next);
                    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: null }));
                  }}
                />
              </div>

              {error && (
                <div role="alert" className="bg-[#ffdad6] text-[#93000a] p-3 text-xs font-mono font-bold border border-[#ba1a1a]/30">
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <button
                  type="button"
                  onClick={() => { setStep('dates'); setError(''); setFieldErrors({}); }}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-[#eae8e3] text-[#14213d] font-mono text-xs uppercase font-bold hover:bg-[#d1c5af] transition-colors disabled:opacity-50"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-[#14213d] text-[#fbf9f4] font-mono text-xs uppercase font-bold hover:bg-[#0a1628] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">lock</span>
                  {loading ? 'Procesando...' : 'Pagar y Confirmar'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
