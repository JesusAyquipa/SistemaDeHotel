import { useState, useEffect } from 'react';
import { updateBooking } from '../services/bookingService';
import { getRoomBookedDates } from '../services/rooms';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Funciones utilitarias para la tarjeta (similares a CheckoutModal)
function formatCardNumber(value) {
  const cleaned = value.replace(/\D/g, '').slice(0, 16);
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value) {
  const cleaned = value.replace(/\D/g, '').slice(0, 4);
  if (cleaned.length >= 3) return cleaned.slice(0, 2) + '/' + cleaned.slice(2);
  return cleaned;
}

function detectCardBrand(number) {
  const cleaned = number.replace(/\D/g, '');
  if (/^4/.test(cleaned)) return 'visa';
  if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return 'mastercard';
  if (/^3[47]/.test(cleaned)) return 'amex';
  return null;
}

const CardBrandIcon = ({ brand }) => {
  if (brand === 'visa') {
    return (
      <svg viewBox="0 0 48 32" className="w-10 h-7" fill="none">
        <rect width="48" height="32" rx="4" fill="#1A1F71" />
        <text x="24" y="20" textAnchor="middle" fill="#FFFFFF" fontFamily="Arial Black, sans-serif" fontSize="12" fontWeight="900">VISA</text>
      </svg>
    );
  }
  if (brand === 'mastercard') {
    return (
      <svg viewBox="0 0 48 32" className="w-10 h-7" fill="none">
        <rect width="48" height="32" rx="4" fill="#252525" />
        <circle cx="19" cy="16" r="9" fill="#EB001B" />
        <circle cx="29" cy="16" r="9" fill="#F79E1B" />
        <path d="M24 9.17a9 9 0 010 13.66 9 9 0 010-13.66z" fill="#FF5F00" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 32" className="w-10 h-7" fill="none">
      <rect width="48" height="32" rx="4" fill="#E0DDD5" />
      <rect x="8" y="10" width="32" height="4" rx="1" fill="#B0A998" />
    </svg>
  );
};

export default function ModifyBookingModal({ booking, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkIn, setCheckIn] = useState(booking.check_in.substring(0, 10));
  const [checkOut, setCheckOut] = useState(booking.check_out.substring(0, 10));
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [amountDifference, setAmountDifference] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [bookedIntervals, setBookedIntervals] = useState([]);
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    const fetchBookedDates = async () => {
      try {
        const datesArray = await getRoomBookedDates(booking.room_id, booking.id);
        const intervals = datesArray.map(b => ({
          start: new Date(b.check_in + 'T00:00:00'),
          end: new Date(b.check_out + 'T00:00:00')
        }));
        setBookedIntervals(intervals);
      } catch (err) {
        console.error('Error al obtener fechas reservadas:', err);
      }
    };
    if (booking?.room_id) {
      fetchBookedDates();
    }
  }, [booking?.room_id, booking?.id]);

  // Estados para la tarjeta
  const [cardData, setCardData] = useState({
    card_number: '',
    card_expiry: '',
    card_cvc: '',
    card_holder: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});

  const cardBrand = detectCardBrand(cardData.card_number);

  const handleCardChange = (e) => {
    const { name, value } = e.target;
    let formatted = value;
    if (name === 'card_number') formatted = formatCardNumber(value);
    if (name === 'card_expiry') formatted = formatExpiry(value);
    if (name === 'card_cvc') formatted = value.replace(/\D/g, '').slice(0, 4);
    if (name === 'card_holder') formatted = value.replace(/[0-9]/g, '');
    
    setCardData((prev) => ({ ...prev, [name]: formatted }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: null }));
  };

  const validateCard = () => {
    const errors = {};
    const cleanNumber = cardData.card_number.replace(/\s/g, '');
    if (!cleanNumber || cleanNumber.length < 13) errors.card_number = 'Número inválido';
    if (!cardData.card_expiry || !/^\d{2}\/\d{2}$/.test(cardData.card_expiry)) errors.card_expiry = 'Inválido (MM/YY)';
    if (!cardData.card_cvc || cardData.card_cvc.length < 3) errors.card_cvc = 'CVC inválido';
    if (!cardData.card_holder.trim() || !cardData.card_holder.includes(' ')) errors.card_holder = 'Nombre completo requerido';
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProcessPayment = async () => {
    if (!validateCard()) return;
    await handleUpdate(null, true);
  };

  const handleUpdate = async (e, forcePayment = false) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await updateBooking(booking.booking_code, {
        check_in: checkIn,
        check_out: checkOut,
        room_id: booking.room_id,
        payment_confirmed: forcePayment,
      });
      
      if (response.requires_payment) {
        setPaymentRequired(true);
        setAmountDifference(response.amount_difference);
        setSuccessMessage(response.message);
      } else {
        setSuccessData(response);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al modificar la reserva.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14213d]/80 backdrop-blur-sm">
      <div className="bg-[#fbf9f4] max-w-lg w-full border border-[#d1c5af] shadow-lg flex flex-col">
        <div className="p-6 border-b border-[#d1c5af] flex justify-between items-center bg-[#eae8e3]">
          <h2 className="font-serif text-xl font-bold text-[#1b1c19]">
            {successData ? '¡Reserva Actualizada!' : 'Modificar Fechas de Reserva'}
          </h2>
          {!successData && (
            <button onClick={onClose} className="text-[#4d4635] hover:text-[#1b1c19]">
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        <form onSubmit={handleUpdate} className="p-6 flex flex-col gap-4">
          {!successData && (
            <div className="bg-[#eae8e3] p-4 font-mono text-xs text-[#4d4635] mb-2 border border-[#d1c5af]">
              <p><strong>Reserva:</strong> {booking.booking_code}</p>
              <p><strong>Habitación:</strong> {booking.room?.name || `Habitación ID: ${booking.room_id}`}</p>
            </div>
          )}

          {successData ? (
            <div className="space-y-6">
              {/* Encabezado de éxito */}
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#c9a227]/20 border-2 border-[#c9a227] mb-4">
                  <span className="material-symbols-outlined text-4xl text-[#c9a227]">check_circle</span>
                </div>
                <h3 className="font-serif text-2xl font-bold text-[#14213d] mb-1">¡Modificación Exitosa!</h3>
                <p className="font-sans text-sm text-[#4d4635]">{successData.message.split('.')[0]}.</p>
              </div>

              {/* Código de reserva */}
              <div className="bg-[#f5f3ee] border-2 border-dashed border-[#c9a227] p-5 text-center">
                <span className="font-mono text-[11px] uppercase font-bold text-[#755b00] tracking-widest block mb-1">
                  Código Único de Reserva
                </span>
                <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[#14213d] tracking-wider">
                  {booking.booking_code}
                </div>
              </div>

              {/* Si hubo pago extra, mostrar comprobante */}
              {successData.payment && (
                <div className="bg-[#f5f3ee] border border-[#d1c5af] p-5 space-y-3">
                  <h4 className="font-mono text-xs uppercase font-bold text-[#14213d] tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-[#755b00]">receipt</span>
                    Comprobante de Pago
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs text-[#4d4635]">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#78716c] block">N° Comprobante</span>
                      <span className="font-bold text-[#1b1c19]">{successData.payment.receipt_number}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#78716c] block">Monto Cobrado</span>
                      <span className="font-bold text-[#14213d] text-sm">S/ {Number(successData.payment.amount).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => onSuccess(successData)}
                  className="flex-1 px-4 py-3 bg-[#c9a227] text-[#14213d] font-mono text-xs uppercase font-bold hover:brightness-105 transition-colors flex items-center justify-center gap-2 border border-[#a68a4d] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">done</span>
                  Aceptar y Continuar
                </button>
              </div>
            </div>
          ) : !paymentRequired ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs uppercase tracking-wider text-[#4d4635] font-bold mb-2">
                    Nuevo Check-in
                  </label>
                  <DatePicker
                    selected={checkIn ? new Date(checkIn + 'T12:00:00') : null}
                    onChange={(date) => {
                      if (date) {
                        const yyyy = date.getFullYear();
                        const mm = String(date.getMonth() + 1).padStart(2, '0');
                        const dd = String(date.getDate()).padStart(2, '0');
                        setCheckIn(`${yyyy}-${mm}-${dd}`);
                      }
                    }}
                    minDate={new Date()}
                    excludeDateIntervals={bookedIntervals}
                    dateFormat="dd/MM/yyyy"
                    className="w-full bg-[#f5f3ee] border border-[#d1c5af] p-3 font-sans text-sm text-[#1b1c19] focus:outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227] transition-all"
                    placeholderText="DD/MM/YYYY"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-wider text-[#4d4635] font-bold mb-2">
                    Nuevo Check-out
                  </label>
                  <DatePicker
                    selected={checkOut ? new Date(checkOut + 'T12:00:00') : null}
                    onChange={(date) => {
                      if (date) {
                        const yyyy = date.getFullYear();
                        const mm = String(date.getMonth() + 1).padStart(2, '0');
                        const dd = String(date.getDate()).padStart(2, '0');
                        setCheckOut(`${yyyy}-${mm}-${dd}`);
                      }
                    }}
                    minDate={checkIn ? new Date(checkIn + 'T12:00:00') : new Date()}
                    excludeDateIntervals={bookedIntervals}
                    dateFormat="dd/MM/yyyy"
                    className="w-full bg-[#f5f3ee] border border-[#d1c5af] p-3 font-sans text-sm text-[#1b1c19] focus:outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227] transition-all"
                    placeholderText="DD/MM/YYYY"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-[#ffdad6] text-[#93000a] p-3 text-xs font-mono font-bold border border-[#ba1a1a]/30 mt-2">
                  {error}
                </div>
              )}

              <div className="flex gap-4 mt-6">
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
                  {loading ? 'Verificando...' : 'Guardar Cambios'}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-[#14213d] text-[#fbf9f4] p-4 text-center">
                <span className="font-mono text-[10px] uppercase text-[#c9a227] tracking-widest block mb-1 font-bold">
                  Monto Adicional a Pagar
                </span>
                <span className="font-mono text-2xl font-bold text-[#fbf9f4]">
                  S/ {Number(amountDifference).toFixed(2)}
                </span>
              </div>

              <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4 space-y-4">
                <h4 className="font-mono text-xs uppercase font-bold text-[#14213d] tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#755b00]">credit_card</span>
                  Datos de la Tarjeta
                </h4>
                <div>
                  <div className="relative">
                    <input
                      type="text" name="card_number" placeholder="4242 4242 4242 4242"
                      value={cardData.card_number} onChange={handleCardChange} maxLength={19}
                      className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-sm font-mono focus:border-[#14213d] focus:outline-none"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <CardBrandIcon brand={cardBrand} />
                    </div>
                  </div>
                  {fieldErrors.card_number && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.card_number}</p>}
                </div>
                
                <div>
                  <input
                    type="text" name="card_holder" placeholder="NOMBRE DEL TITULAR"
                    value={cardData.card_holder} onChange={handleCardChange}
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-sm font-mono focus:border-[#14213d] focus:outline-none uppercase"
                  />
                  {fieldErrors.card_holder && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.card_holder}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <input
                      type="text" name="card_expiry" placeholder="MM/YY"
                      value={cardData.card_expiry} onChange={handleCardChange} maxLength={5}
                      className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-sm font-mono focus:border-[#14213d] focus:outline-none"
                    />
                    {fieldErrors.card_expiry && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.card_expiry}</p>}
                  </div>
                  <div>
                    <input
                      type="password" name="card_cvc" placeholder="CVC"
                      value={cardData.card_cvc} onChange={handleCardChange} maxLength={4}
                      className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-sm font-mono focus:border-[#14213d] focus:outline-none"
                    />
                    {fieldErrors.card_cvc && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.card_cvc}</p>}
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-[#ffdad6] text-[#93000a] p-3 text-xs font-mono font-bold border border-[#ba1a1a]/30">
                  {error}
                </div>
              )}

              <div className="flex gap-4 mt-4">
                <button
                  type="button"
                  onClick={() => { setPaymentRequired(false); setSuccessMessage(''); }}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-[#eae8e3] text-[#14213d] font-mono text-xs uppercase font-bold hover:bg-[#d1c5af] transition-colors disabled:opacity-50"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={handleProcessPayment}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-[#14213d] text-[#fbf9f4] font-mono text-xs uppercase font-bold hover:bg-[#0a1628] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">lock</span>
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
