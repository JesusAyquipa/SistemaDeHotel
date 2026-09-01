import { useState, useCallback, useEffect } from 'react';
import { createCheckoutIntent, processMockPayment } from '../services/paymentService';
import { getRoomBookedDates } from '../services/rooms';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Imágenes por defecto si no vienen en la habitación
const DEFAULT_IMAGES = {
  individual: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
  doble: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80',
  king: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
  default: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80',
};

/**
 * Formatea un número de tarjeta con espacios cada 4 dígitos.
 */
function formatCardNumber(value) {
  const cleaned = value.replace(/\D/g, '').slice(0, 16);
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Formatea la fecha de expiración como MM/YY.
 */
function formatExpiry(value) {
  const cleaned = value.replace(/\D/g, '').slice(0, 4);
  if (cleaned.length >= 3) {
    return cleaned.slice(0, 2) + '/' + cleaned.slice(2);
  }
  return cleaned;
}

/**
 * Detecta la marca de la tarjeta basándose en el BIN (primeros dígitos).
 */
function detectCardBrand(number) {
  const cleaned = number.replace(/\D/g, '');
  if (/^4/.test(cleaned)) return 'visa';
  if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return 'mastercard';
  if (/^3[47]/.test(cleaned)) return 'amex';
  return null;
}

/**
 * Detecta el banco emisor (Perú) basándose en algunos BINs comunes.
 */
function detectCardBank(number) {
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length < 4) return null;
  
  if (/^(4145|4154|4312|4557|4969|4280|5155|5406|5289)/.test(cleaned)) return 'BCP';
  if (/^(4143|4214|4213|5122|5491|5169|5300|5198)/.test(cleaned)) return 'Interbank';
  if (/^(4220|4551|4555|5256|5188)/.test(cleaned)) return 'BBVA';
  if (/^(4321|4894|5160|5438|5273)/.test(cleaned)) return 'Scotiabank';
  if (/^(3600|3000|4556|4122)/.test(cleaned)) return 'Diners / Pichincha';
  
  return null;
}

// Iconos SVG de marcas de tarjeta
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
  if (brand === 'amex') {
    return (
      <svg viewBox="0 0 48 32" className="w-10 h-7" fill="none">
        <rect width="48" height="32" rx="4" fill="#2E77BB" />
        <text x="24" y="20" textAnchor="middle" fill="#FFFFFF" fontFamily="Arial, sans-serif" fontSize="8" fontWeight="900">AMEX</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 32" className="w-10 h-7" fill="none">
      <rect width="48" height="32" rx="4" fill="#E0DDD5" />
      <rect x="8" y="10" width="32" height="4" rx="1" fill="#B0A998" />
      <rect x="8" y="18" width="20" height="4" rx="1" fill="#B0A998" />
    </svg>
  );
};

/**
 * PASOS del checkout:
 * 0 = Resumen de reserva + Datos del huésped
 * 1 = Formulario de tarjeta (Pago Seguro)
 * 2 = Procesando pago
 * 3 = Resultado (éxito o error)
 */
const STEPS = [
  { label: 'Resumen y Datos', icon: 'receipt_long' },
  { label: 'Pago Seguro', icon: 'credit_card' },
  { label: 'Procesando', icon: 'sync' },
  { label: 'Confirmación', icon: 'verified' },
];

export default function CheckoutModal({
  room,
  initialDates = {},
  onClose,
  onPaymentSuccess,
}) {
  // ===== Estado del paso actual =====
  const [currentStep, setCurrentStep] = useState(0);

  // ===== Fechas =====
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const [dates, setDates] = useState({
    check_in: initialDates.check_in || todayStr,
    check_out: initialDates.check_out || tomorrowStr,
  });

  // ===== Datos del huésped =====
  const [guestData, setGuestData] = useState({
    guest_name: '',
    guest_surname: '',
    document_type: 'DNI',
    document_number: '',
    guest_email: '',
    guest_phone: '',
    notes: '',
  });

  // ===== Datos de tarjeta =====
  const [cardData, setCardData] = useState({
    card_number: '',
    card_expiry: '',
    card_cvc: '',
    card_holder: '',
  });

  // ===== Fechas Reservadas (Bloqueadas) =====
  const [bookedIntervals, setBookedIntervals] = useState([]);

  useEffect(() => {
    const fetchBookedDates = async () => {
      try {
        const datesArray = await getRoomBookedDates(room.id);
        const intervals = datesArray.map(b => ({
          start: new Date(b.check_in + 'T00:00:00'),
          end: new Date(b.check_out + 'T00:00:00')
        }));
        setBookedIntervals(intervals);
      } catch (err) {
        console.error('Error al obtener fechas reservadas:', err);
      }
    };
    if (room?.id) {
      fetchBookedDates();
    }
  }, [room?.id]);

  // ===== Estado de la transacción =====
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [bookingCode, setBookingCode] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);
  const [processingMessage, setProcessingMessage] = useState('');

  // ===== Cálculos derivados =====
  const nights = (() => {
    if (!dates.check_in || !dates.check_out) return 1;
    const start = new Date(dates.check_in);
    const end = new Date(dates.check_out);
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  })();
  const totalAmount = nights * Number(room.price_per_night);
  const cardBrand = detectCardBrand(cardData.card_number);
  const cardBank = detectCardBank(cardData.card_number);
  const roomImage = room.image_url || DEFAULT_IMAGES[room.bed_type] || DEFAULT_IMAGES.default;

  // ===== Handlers =====
  const handleDateChange = (name, date) => {
    if (!date) return;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    setDates((prev) => ({ ...prev, [name]: dateStr }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleGuestChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;
    if (name === 'guest_name' || name === 'guest_surname') {
      finalValue = value.replace(/[0-9]/g, '');
    }
    setGuestData((prev) => ({ ...prev, [name]: finalValue }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleCardChange = (e) => {
    const { name, value } = e.target;
    let formatted = value;
    if (name === 'card_number') formatted = formatCardNumber(value);
    if (name === 'card_expiry') formatted = formatExpiry(value);
    if (name === 'card_cvc') formatted = value.replace(/\D/g, '').slice(0, 4);
    if (name === 'card_holder') formatted = value.replace(/[0-9]/g, '');
    
    setCardData((prev) => ({ ...prev, [name]: formatted }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // ===== Validación del Paso 0 (Resumen + Huésped) =====
  const validateStep0 = () => {
    const errors = {};
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    const repeatingRegex = /(.)\1{2,}/;

    if (!dates.check_in) errors.check_in = 'Fecha de check-in requerida';
    if (!dates.check_out) errors.check_out = 'Fecha de check-out requerida';
    if (dates.check_in >= dates.check_out) errors.check_out = 'El check-out debe ser posterior al check-in';

    const gName = guestData.guest_name.trim();
    if (!gName) {
      errors.guest_name = 'El nombre es obligatorio';
    } else if (gName.length < 2) {
      errors.guest_name = 'Debe tener al menos 2 letras';
    } else if (!nameRegex.test(gName) || repeatingRegex.test(gName)) {
      errors.guest_name = 'Ingrese un nombre válido';
    }

    const gSurname = guestData.guest_surname.trim();
    if (!gSurname) {
      errors.guest_surname = 'Los apellidos son obligatorios';
    } else if (gSurname.length < 2) {
      errors.guest_surname = 'Debe tener al menos 2 letras';
    } else if (!nameRegex.test(gSurname) || repeatingRegex.test(gSurname)) {
      errors.guest_surname = 'Ingrese apellidos válidos';
    }
    if (!guestData.guest_email.trim()) {
      errors.guest_email = 'El correo electrónico es obligatorio';
    } else if (!/\S+@\S+\.\S+/.test(guestData.guest_email)) {
      errors.guest_email = 'Ingrese un correo electrónico válido';
    }
    if (!guestData.document_number.trim()) {
      errors.document_number = 'El número de documento es obligatorio';
    } else if (guestData.document_type === 'DNI' && !/^\d{8}$/.test(guestData.document_number.trim())) {
      errors.document_number = 'El DNI debe tener 8 dígitos numéricos';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ===== Validación del Paso 1 (Tarjeta) =====
  const validateStep1 = () => {
    const errors = {};
    const cleanNumber = cardData.card_number.replace(/\s/g, '');

    if (!cleanNumber || cleanNumber.length < 13) {
      errors.card_number = 'Ingrese un número de tarjeta válido (13-16 dígitos)';
    }
    if (!cardData.card_expiry || !/^\d{2}\/\d{2}$/.test(cardData.card_expiry)) {
      errors.card_expiry = 'Ingrese la fecha de expiración (MM/YY)';
    } else {
      const [mm, yy] = cardData.card_expiry.split('/');
      const expMonth = parseInt(mm, 10);
      const expYear = parseInt(yy, 10) + 2000;
      const now = new Date();
      const currYear = now.getFullYear();
      const currMonth = now.getMonth() + 1;

      if (expMonth < 1 || expMonth > 12) {
        errors.card_expiry = 'Mes inválido (01-12)';
      } else if (expYear < currYear || (expYear === currYear && expMonth < currMonth)) {
        errors.card_expiry = 'La tarjeta está vencida';
      }
    }
    if (!cardData.card_cvc || cardData.card_cvc.length < 3) {
      errors.card_cvc = 'Ingrese el código CVC (3-4 dígitos)';
    }
    
    const holder = cardData.card_holder.trim();
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    const repeatingRegex = /(.)\1{2,}/;
    
    if (!holder) {
      errors.card_holder = 'Nombre del titular es obligatorio';
    } else if (holder.length < 5 || !holder.includes(' ')) {
      errors.card_holder = 'Ingrese nombre y apellido completo';
    } else if (!nameRegex.test(holder) || repeatingRegex.test(holder)) {
      errors.card_holder = 'Ingrese un nombre válido';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ===== Avanzar al paso de pago =====
  const handleContinueToPayment = async () => {
    if (!validateStep0()) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const payload = {
        room_id: room.id,
        check_in: dates.check_in,
        check_out: dates.check_out,
        guest_name: guestData.guest_name.trim(),
        guest_surname: guestData.guest_surname.trim(),
        guest_email: guestData.guest_email.trim(),
        document_type: guestData.document_type,
        document_number: guestData.document_number.trim(),
        guest_phone: guestData.guest_phone.trim() || undefined,
        notes: guestData.notes.trim() || undefined,
      };

      const result = await createCheckoutIntent(payload);
      setBookingCode(result.booking_code);
      setCurrentStep(1); // Ir al formulario de tarjeta
    } catch (err) {
      console.error('Error al crear checkout intent:', err);
      const apiMsg = err.response?.data?.message || 'No se pudo iniciar el proceso de pago. Verifique los datos e intente nuevamente.';
      const apiErrors = err.response?.data?.errors || {};
      setErrorMessage(apiMsg);
      setFieldErrors(apiErrors);
    } finally {
      setLoading(false);
    }
  };

  // ===== Procesar el pago =====
  const handleProcessPayment = async () => {
    if (!validateStep1()) return;

    setCurrentStep(2); // Paso de procesamiento
    setLoading(true);
    setErrorMessage(null);

    // Secuencia de mensajes de procesamiento animados
    const messages = [
      'Conectando con la pasarela de pago seguro...',
      'Verificando datos de la tarjeta...',
      'Autorizando transacción con el banco emisor...',
      'Confirmando pago y reserva...',
    ];

    let messageIndex = 0;
    setProcessingMessage(messages[0]);
    const interval = setInterval(() => {
      messageIndex++;
      if (messageIndex < messages.length) {
        setProcessingMessage(messages[messageIndex]);
      }
    }, 1200);

    try {
      const result = await processMockPayment({
        booking_code: bookingCode,
        card_number: cardData.card_number.replace(/\s/g, ''),
        card_expiry: cardData.card_expiry,
        card_cvc: cardData.card_cvc,
        card_holder: cardData.card_holder.trim(),
      });

      clearInterval(interval);

      if (result.success) {
        setPaymentResult(result);
        setCurrentStep(3); // Paso de confirmación
      } else {
        setErrorMessage(result.message || 'El pago fue rechazado.');
        setCurrentStep(1); // Volver al formulario
      }
    } catch (err) {
      clearInterval(interval);
      console.error('Error al procesar pago:', err);
      const msg = err.response?.data?.message || 'Error al procesar el pago. Intente nuevamente.';
      setErrorMessage(msg);
      setCurrentStep(1); // Volver al formulario
    } finally {
      setLoading(false);
    }
  };

  // ===== Renderizado del indicador de pasos =====
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-1 px-6 py-3 bg-[#f5f3ee] border-b border-[#d1c5af]">
      {STEPS.map((step, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <div
            className={`flex items-center gap-1 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider font-bold transition-all duration-300 ${
              idx === currentStep
                ? 'bg-[#14213d] text-[#c9a227] border border-[#c9a227]'
                : idx < currentStep
                ? 'bg-[#c9a227]/20 text-[#755b00] border border-[#c9a227]/50'
                : 'bg-[#fbf9f4] text-[#78716c] border border-[#d1c5af]'
            }`}
          >
            <span className="material-symbols-outlined text-xs">
              {idx < currentStep ? 'check_circle' : step.icon}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={`w-4 h-px ${idx < currentStep ? 'bg-[#c9a227]' : 'bg-[#d1c5af]'}`} />
          )}
        </div>
      ))}
    </div>
  );

  // ===== PASO 0: Resumen + Datos del Huésped =====
  const renderStep0 = () => (
    <div className="overflow-y-auto p-6 flex-grow space-y-6">
      {errorMessage && (
        <div className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-4 text-[#93000a] font-mono text-xs flex items-start gap-3">
          <span className="material-symbols-outlined text-lg mt-0.5">error</span>
          <div>
            <p className="font-bold">{errorMessage}</p>
            {typeof fieldErrors === 'object' && Object.keys(fieldErrors).length > 0 && (
              <ul className="list-disc list-inside mt-1">
                {Object.values(fieldErrors).flat().filter(Boolean).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Tarjeta de la Habitación & Desglose Financiero */}
        <div className="lg:col-span-5 space-y-4">
          {/* Tarjeta Visual de la Habitación */}
          <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4">
            <div
              className="relative h-36 w-full bg-cover bg-center border border-[#d1c5af] mb-3 overflow-hidden"
              style={{ backgroundImage: `url('${roomImage}')` }}
            >
              <div className="absolute top-2 left-2 bg-[#c9a227] text-[#14213d] px-2.5 py-0.5 font-mono text-[10px] font-bold border border-[#14213d]">
                HAB {room.room_number}
              </div>
              <div className="absolute top-2 right-2 bg-[#fbf9f4]/90 text-[#4d4635] px-2 py-0.5 font-mono text-[10px] uppercase border border-[#d1c5af]">
                {room.bed_type}
              </div>
            </div>
            <h3 className="font-serif font-bold text-lg text-[#1b1c19] mb-1">{room.name}</h3>
            <p className="font-sans text-xs text-[#4d4635] mb-3 line-clamp-2 leading-relaxed">
              {room.description || 'Habitación equipada con comodidades de lujo y servicio personalizado.'}
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#4d4635] border-t border-[#d1c5af] pt-2">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-[#755b00]">person</span>
                <span>{room.capacity} Huésped(es)</span>
              </div>
              {room.size_m2 && (
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-[#755b00]">square_foot</span>
                  <span>{room.size_m2} m²</span>
                </div>
              )}
            </div>
          </div>

          {/* Desglose de Costos */}
          <div className="bg-[#f5f3ee] border border-[#c9a227]/60 p-4">
            <h4 className="font-mono text-xs uppercase font-bold text-[#755b00] tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">payments</span>
              Desglose de Costos
            </h4>
            <div className="space-y-2 text-xs font-mono text-[#4d4635]">
              <div className="flex justify-between">
                <span>Tarifa por noche:</span>
                <span className="font-bold text-[#1b1c19]">S/ {Number(room.price_per_night).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Duración de estadía:</span>
                <span className="font-bold text-[#1b1c19]">{nights} {nights === 1 ? 'noche' : 'noches'}</span>
              </div>
              <div className="flex justify-between text-[11px] text-[#78716c]">
                <span>Impuestos y tasas (IGV):</span>
                <span>Incluidos</span>
              </div>
              <div className="border-t border-[#d1c5af] pt-2 mt-2 flex justify-between items-baseline">
                <span className="font-serif font-bold text-sm text-[#14213d]">Total a Pagar:</span>
                <span className="font-mono font-bold text-lg text-[#14213d] bg-[#c9a227]/20 px-2 py-0.5 border border-[#c9a227]">
                  S/ {totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Badge de pago seguro */}
          <div className="bg-[#14213d] text-[#fbf9f4] p-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#c9a227] text-xl">lock</span>
            <div>
              <p className="font-mono text-[10px] uppercase font-bold text-[#c9a227] tracking-wider">Pago 100% Seguro</p>
              <p className="font-sans text-[10px] text-[#d1c5af]">Encriptación SSL/TLS • PCI-DSS Compliant</p>
            </div>
            <div className="ml-auto flex gap-1.5">
              <CardBrandIcon brand="visa" />
              <CardBrandIcon brand="mastercard" />
            </div>
          </div>
        </div>

        {/* Columna Derecha: Formulario de Fechas y Datos del Huésped */}
        <div className="lg:col-span-7 space-y-4">
          {/* Fechas */}
          <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4">
            <h4 className="font-mono text-xs uppercase font-bold text-[#14213d] tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#755b00]">calendar_month</span>
              1. Fechas de Estadía
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                  Check-In (Llegada) *
                </label>
                <DatePicker
                  selected={dates.check_in ? new Date(dates.check_in + 'T12:00:00') : null}
                  onChange={(date) => handleDateChange('check_in', date)}
                  minDate={new Date()}
                  excludeDateIntervals={bookedIntervals}
                  dateFormat="dd/MM/yyyy"
                  className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none"
                  placeholderText="DD/MM/YYYY"
                />
                {fieldErrors.check_in && (
                  <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.check_in}</p>
                )}
              </div>
              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                  Check-Out (Salida) *
                </label>
                <DatePicker
                  selected={dates.check_out ? new Date(dates.check_out + 'T12:00:00') : null}
                  onChange={(date) => handleDateChange('check_out', date)}
                  minDate={dates.check_in ? new Date(dates.check_in + 'T12:00:00') : new Date()}
                  excludeDateIntervals={bookedIntervals}
                  dateFormat="dd/MM/yyyy"
                  required
                  className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none"
                  placeholderText="DD/MM/YYYY"
                />
                {fieldErrors.check_out && (
                  <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.check_out}</p>
                )}
              </div>
            </div>
          </div>

          {/* Datos del Huésped */}
          <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4">
            <h4 className="font-mono text-xs uppercase font-bold text-[#14213d] tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#755b00]">person_add</span>
              2. Datos del Huésped Titular
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">Nombres *</label>
                <input type="text" name="guest_name" placeholder="Ej. Juan Carlos" value={guestData.guest_name} onChange={handleGuestChange} required
                  className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-sans text-[#1b1c19] focus:border-[#14213d] focus:outline-none" />
                {fieldErrors.guest_name && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.guest_name}</p>}
              </div>
              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">Apellidos *</label>
                <input type="text" name="guest_surname" placeholder="Ej. Pérez Rossi" value={guestData.guest_surname} onChange={handleGuestChange} required
                  className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-sans text-[#1b1c19] focus:border-[#14213d] focus:outline-none" />
                {fieldErrors.guest_surname && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.guest_surname}</p>}
              </div>
              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">Tipo de Documento *</label>
                <select name="document_type" value={guestData.document_type} onChange={handleGuestChange}
                  className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none cursor-pointer">
                  <option value="DNI">DNI (8 dígitos)</option>
                  <option value="Pasaporte">Pasaporte</option>
                  <option value="Carnet Extranjería">Carnet de Extranjería</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">N° de Documento *</label>
                <input type="text" name="document_number" placeholder={guestData.document_type === 'DNI' ? '8 dígitos' : 'N° Documento'}
                  value={guestData.document_number} onChange={handleGuestChange} required
                  className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none" />
                {fieldErrors.document_number && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.document_number}</p>}
              </div>
              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">Correo Electrónico *</label>
                <input type="email" name="guest_email" placeholder="nombre@ejemplo.com" value={guestData.guest_email} onChange={handleGuestChange} required
                  className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-sans text-[#1b1c19] focus:border-[#14213d] focus:outline-none" />
                {fieldErrors.guest_email && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.guest_email}</p>}
              </div>
              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">Teléfono / WhatsApp</label>
                <input type="tel" name="guest_phone" placeholder="+51 987 654 321" value={guestData.guest_phone} onChange={handleGuestChange}
                  className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">Peticiones Especiales (Opcional)</label>
                <textarea name="notes" rows="2" placeholder="Horario estimado de llegada, preferencias de piso, etc."
                  value={guestData.notes} onChange={handleGuestChange}
                  className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-sans text-[#1b1c19] focus:border-[#14213d] focus:outline-none resize-none" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ===== PASO 1: Formulario de Tarjeta de Crédito/Débito =====
  const renderStep1 = () => (
    <div className="overflow-y-auto p-6 flex-grow space-y-6">
      {errorMessage && (
        <div className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-4 text-[#93000a] font-mono text-xs flex items-start gap-3 animate-fadeIn">
          <span className="material-symbols-outlined text-lg mt-0.5">error</span>
          <div>
            <p className="font-bold">{errorMessage}</p>
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto space-y-6">
        {/* Monto a pagar */}
        <div className="bg-[#14213d] text-[#fbf9f4] p-5 text-center">
          <span className="font-mono text-[10px] uppercase text-[#c9a227] tracking-widest block mb-1 font-bold">
            Monto Total a Pagar
          </span>
          <span className="font-mono text-3xl font-bold text-[#fbf9f4]">
            S/ {totalAmount.toFixed(2)}
          </span>
          <span className="font-mono text-[10px] text-[#d1c5af] block mt-1">
            {nights} {nights === 1 ? 'noche' : 'noches'} • Hab. {room.room_number} • Código: {bookingCode}
          </span>
        </div>

        {/* Simulador de Tarjeta Visual */}
        <div className="relative">
          <div className="bg-gradient-to-br from-[#14213d] via-[#1d3461] to-[#0a1628] text-[#fbf9f4] p-6 shadow-[4px_4px_0px_rgba(201,162,39,0.3)] border border-[#c9a227]/30 aspect-[16/9.5] flex flex-col justify-between relative overflow-hidden">
            {/* Patrón decorativo */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-4 right-4 w-32 h-32 border border-white/30 rounded-full" />
              <div className="absolute top-8 right-8 w-24 h-24 border border-white/20 rounded-full" />
              <div className="absolute -bottom-8 -left-8 w-40 h-40 border border-white/10 rounded-full" />
            </div>

            <div className="flex justify-between items-start relative z-10">
              <div className="flex flex-col gap-2">
                {cardBank && (
                  <span className="font-sans font-black italic text-sm tracking-wider text-[#fbf9f4]">
                    {cardBank}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-6 bg-[#c9a227] rounded-sm" />
                  <div className="w-5 h-5 bg-[#d1c5af]/30 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-[10px] text-[#d1c5af]">wifi</span>
                  </div>
                </div>
              </div>
              <CardBrandIcon brand={cardBrand} />
            </div>

            <div className="relative z-10">
              <div className="font-mono text-lg tracking-[0.25em] mb-3 text-[#fbf9f4]/90">
                {cardData.card_number || '•••• •••• •••• ••••'}
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <span className="font-mono text-[8px] uppercase text-[#d1c5af]/60 block">Titular</span>
                  <span className="font-mono text-xs uppercase text-[#fbf9f4]/80 tracking-wider">
                    {cardData.card_holder || 'NOMBRE DEL TITULAR'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-[8px] uppercase text-[#d1c5af]/60 block">Vencimiento</span>
                  <span className="font-mono text-xs text-[#fbf9f4]/80">
                    {cardData.card_expiry || 'MM/YY'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Formulario de datos de tarjeta */}
        <div className="bg-[#f5f3ee] border border-[#d1c5af] p-5 space-y-4">
          <h4 className="font-mono text-xs uppercase font-bold text-[#14213d] tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-[#755b00]">credit_card</span>
            Datos de la Tarjeta
          </h4>

          <div>
            <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
              Número de Tarjeta *
            </label>
            <div className="relative">
              <input
                type="text"
                name="card_number"
                placeholder="4242 4242 4242 4242"
                value={cardData.card_number}
                onChange={handleCardChange}
                maxLength={19}
                autoComplete="cc-number"
                className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2.5 pr-14 text-sm font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none tracking-wider"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <CardBrandIcon brand={cardBrand} />
              </div>
            </div>
            {fieldErrors.card_number && (
              <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.card_number}</p>
            )}
          </div>

          <div>
            <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
              Nombre del Titular *
            </label>
            <input
              type="text"
              name="card_holder"
              placeholder="JUAN CARLOS PÉREZ"
              value={cardData.card_holder}
              onChange={handleCardChange}
              autoComplete="cc-name"
              className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2.5 text-sm font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none uppercase"
            />
            {fieldErrors.card_holder && (
              <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.card_holder}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                Vencimiento *
              </label>
              <input
                type="text"
                name="card_expiry"
                placeholder="MM/YY"
                value={cardData.card_expiry}
                onChange={handleCardChange}
                maxLength={5}
                autoComplete="cc-exp"
                className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2.5 text-sm font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none tracking-wider"
              />
              {fieldErrors.card_expiry && (
                <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.card_expiry}</p>
              )}
            </div>
            <div>
              <label className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                CVC / CVV *
              </label>
              <input
                type="password"
                name="card_cvc"
                placeholder="•••"
                value={cardData.card_cvc}
                onChange={handleCardChange}
                maxLength={4}
                autoComplete="cc-csc"
                className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2.5 text-sm font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none tracking-wider"
              />
              {fieldErrors.card_cvc && (
                <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.card_cvc}</p>
              )}
            </div>
          </div>
        </div>

        {/* Tarjetas de prueba (info) */}
        <div className="bg-[#e8f4fd] border border-[#7cb9e8]/50 p-3 font-mono text-[10px] text-[#1a5276]">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-sm text-[#2980b9]">info</span>
            <div>
              <p className="font-bold mb-1">Tarjetas de Prueba (Modo Simulación)</p>
              <p>Visa: <span className="font-bold">4242 4242 4242 4242</span> • Mastercard: <span className="font-bold">5555 5555 5555 4444</span></p>
              <p>Usa cualquier fecha futura y CVC de 3 dígitos.</p>
            </div>
          </div>
        </div>

        {/* Sello de seguridad */}
        <div className="flex items-center justify-center gap-4 py-2">
          <div className="flex items-center gap-1.5 text-[#755b00]">
            <span className="material-symbols-outlined text-sm">lock</span>
            <span className="font-mono text-[10px] uppercase font-bold">SSL Secure</span>
          </div>
          <div className="w-px h-4 bg-[#d1c5af]" />
          <div className="flex items-center gap-1.5 text-[#755b00]">
            <span className="material-symbols-outlined text-sm">verified_user</span>
            <span className="font-mono text-[10px] uppercase font-bold">PCI Compliant</span>
          </div>
          <div className="w-px h-4 bg-[#d1c5af]" />
          <div className="flex items-center gap-1.5 text-[#755b00]">
            <span className="material-symbols-outlined text-sm">shield</span>
            <span className="font-mono text-[10px] uppercase font-bold">3D Secure</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ===== PASO 2: Procesando Pago =====
  const renderStep2 = () => (
    <div className="flex-grow flex items-center justify-center p-12">
      <div className="text-center space-y-6 max-w-md">
        {/* Animación de procesamiento */}
        <div className="relative w-24 h-24 mx-auto">
          <div className="absolute inset-0 border-4 border-[#d1c5af] rounded-full" />
          <div className="absolute inset-0 border-4 border-t-[#c9a227] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
          <div className="absolute inset-3 border-4 border-t-transparent border-r-[#14213d] border-b-transparent border-l-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          <span className="material-symbols-outlined text-[#c9a227] text-2xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            lock
          </span>
        </div>

        <div>
          <h3 className="font-serif text-xl font-bold text-[#14213d] mb-2">
            Procesando Pago Seguro
          </h3>
          <p className="font-mono text-xs text-[#4d4635] animate-pulse transition-all duration-500">
            {processingMessage}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 text-[#755b00] font-mono text-[10px] uppercase">
          <span className="material-symbols-outlined text-sm">lock</span>
          <span>Conexión cifrada de extremo a extremo</span>
        </div>
      </div>
    </div>
  );

  // ===== PASO 3: Confirmación Exitosa =====
  const renderStep3 = () => {
    const pd = paymentResult?.payment?.payment_details || {};

    return (
      <div className="overflow-y-auto flex-grow p-6 space-y-6">
        {/* Encabezado de éxito */}
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#c9a227]/20 border-2 border-[#c9a227] mb-4">
            <span className="material-symbols-outlined text-4xl text-[#c9a227]">check_circle</span>
          </div>
          <h3 className="font-serif text-2xl font-bold text-[#14213d] mb-1">¡Pago Confirmado!</h3>
          <p className="font-sans text-sm text-[#4d4635]">Tu reserva ha sido confirmada exitosamente.</p>
        </div>

        {/* Código de reserva */}
        <div className="bg-[#f5f3ee] border-2 border-dashed border-[#c9a227] p-5 text-center">
          <span className="font-mono text-[11px] uppercase font-bold text-[#755b00] tracking-widest block mb-1">
            Código Único de Reserva
          </span>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[#14213d] tracking-wider">
            {bookingCode}
          </div>
        </div>

        {/* Detalles del pago */}
        <div className="bg-[#f5f3ee] border border-[#d1c5af] p-5 space-y-3">
          <h4 className="font-mono text-xs uppercase font-bold text-[#14213d] tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-[#755b00]">receipt</span>
            Comprobante de Pago
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs text-[#4d4635]">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#78716c] block">N° Comprobante</span>
              <span className="font-bold text-[#1b1c19]">{paymentResult?.receipt_number || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#78716c] block">ID Transacción</span>
              <span className="font-bold text-[#1b1c19] text-[10px] break-all">{paymentResult?.payment?.transaction_id || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#78716c] block">Método de Pago</span>
              <div className="flex items-center gap-1.5">
                <CardBrandIcon brand={pd.brand?.toLowerCase()} />
                <span className="font-bold text-[#1b1c19]">{pd.brand} •••• {pd.last4}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#78716c] block">Monto Cobrado</span>
              <span className="font-bold text-[#14213d] text-sm">
                S/ {Number(paymentResult?.payment?.amount || totalAmount).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Datos de la reserva */}
        <div className="bg-[#f5f3ee] border border-[#d1c5af] p-5 space-y-3">
          <h4 className="font-mono text-xs uppercase font-bold text-[#14213d] tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-[#755b00]">hotel</span>
            Detalles de la Reserva
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs text-[#4d4635]">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#78716c] block">Habitación</span>
              <span className="font-bold text-[#1b1c19]">{room.name} (Hab. {room.room_number})</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#78716c] block">Huésped</span>
              <span className="font-bold text-[#1b1c19]">{guestData.guest_name} {guestData.guest_surname}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#78716c] block">Fechas</span>
              <span className="font-bold text-[#1b1c19]">{dates.check_in} al {dates.check_out}</span>
              <span className="block text-[11px]">{nights} {nights === 1 ? 'Noche' : 'Noches'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#78716c] block">Estado</span>
              <div className="inline-flex items-center gap-1 bg-[#14213d] text-[#fbf9f4] px-2 py-0.5 text-[10px] font-bold uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c9a227] animate-pulse" />
                Confirmada y Pagada
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ===== Botones de pie de página según el paso =====
  const renderFooterButtons = () => {
    if (currentStep === 0) {
      return (
        <>
          <button type="button" onClick={onClose} disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 bg-transparent border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-xs uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={handleContinueToPayment} disabled={loading}
            className="w-full sm:w-auto px-8 py-3 bg-[#c9a227] hover:bg-[#b08b1a] text-[#14213d] font-mono text-xs uppercase tracking-widest font-bold border border-[#14213d] shadow-[2px_2px_0px_#14213d] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
            {loading ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                <span>Verificando...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">credit_card</span>
                <span>Continuar al Pago Seguro</span>
              </>
            )}
          </button>
        </>
      );
    }

    if (currentStep === 1) {
      return (
        <>
          <button type="button" onClick={() => { setCurrentStep(0); setErrorMessage(null); }}
            className="w-full sm:w-auto px-5 py-2.5 bg-transparent border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-xs uppercase tracking-wider font-bold transition-all cursor-pointer">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Volver
            </span>
          </button>
          <button type="button" onClick={handleProcessPayment} disabled={loading}
            className="w-full sm:w-auto px-8 py-3 bg-[#14213d] hover:bg-[#0a1628] text-[#fbf9f4] font-mono text-xs uppercase tracking-widest font-bold border border-[#c9a227] shadow-[2px_2px_0px_#c9a227] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
            <span className="material-symbols-outlined text-sm">lock</span>
            <span>Pagar S/ {totalAmount.toFixed(2)}</span>
          </button>
        </>
      );
    }

    if (currentStep === 3) {
      return (
        <>
          <button type="button" onClick={() => window.print()}
            className="w-full sm:w-auto px-4 py-2.5 bg-transparent border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-xs uppercase font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all">
            <span className="material-symbols-outlined text-base">print</span>
            <span>Imprimir Comprobante</span>
          </button>
          <button type="button"
            onClick={() => onPaymentSuccess(paymentResult)}
            className="w-full sm:w-auto px-6 py-2.5 bg-[#c9a227] hover:bg-[#b08b1a] text-[#14213d] font-mono text-xs uppercase font-bold border border-[#14213d] shadow-[2px_2px_0px_#14213d] cursor-pointer transition-all flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-sm">receipt_long</span>
            <span>Ver Comprobante Completo</span>
          </button>
        </>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#14213d]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-[#fbf9f4] border border-[#d1c5af] shadow-[4px_4px_0px_rgba(20,33,61,0.25)] max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">

        {/* Modal Header */}
        <div className="bg-[#14213d] text-[#fbf9f4] px-6 py-4 flex items-center justify-between border-b border-[#c9a227]">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#c9a227] text-2xl">
              {currentStep === 3 ? 'verified' : 'shopping_cart_checkout'}
            </span>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold tracking-wide">
                {currentStep === 3 ? '¡Reserva Confirmada!' : 'Checkout Seguro'}
              </h2>
              <p className="font-mono text-[11px] text-[#d1c5af] uppercase">
                {currentStep === 3
                  ? 'Tu pago ha sido procesado exitosamente'
                  : 'Completa tu reserva con pago en línea'}
              </p>
            </div>
          </div>
          {currentStep !== 2 && (
            <button
              type="button"
              onClick={onClose}
              className="text-[#d1c5af] hover:text-white transition-colors cursor-pointer p-1"
              title="Cerrar ventana"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          )}
        </div>

        {/* Step Indicator */}
        <StepIndicator />

        {/* Body por paso */}
        {currentStep === 0 && renderStep0()}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}

        {/* Footer Buttons */}
        {currentStep !== 2 && (
          <div className="bg-[#f5f3ee] border-t border-[#d1c5af] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            {renderFooterButtons()}
          </div>
        )}
      </div>
    </div>
  );
}
