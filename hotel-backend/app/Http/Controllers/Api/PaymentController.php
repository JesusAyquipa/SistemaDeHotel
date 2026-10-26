<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\BookingConfirmedMail;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\Booking\BookingException;
use App\Services\BookingPricingService;
use App\Services\BookingService;
use App\Services\BookingVerificationService;
use App\Services\CouponService;
use App\Services\Payment\CardValidator;
use App\Services\Payment\MockPaymentService;
use App\Services\Payment\PaymentGatewayInterface;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class PaymentController extends Controller
{
    public function __construct(
        private PaymentGatewayInterface $paymentGateway,
        private BookingService $bookings,
        private CouponService $coupons,
        private BookingVerificationService $verifications,
    ) {
    }

    /**
     * Checkout público: crea SIEMPRE una reserva `pending_payment` que retiene la
     * habitación durante 30 minutos (expires_at) y la intención de pago con tarjeta.
     * Los pagos en efectivo se registran solo en recepción (POST /api/bookings, staff).
     *
     * POST /api/payments/checkout-intent
     */
    public function createCheckoutIntent(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'room_id'         => 'required|integer|exists:rooms,id',
            'check_in'        => 'required|date|after_or_equal:today',
            'check_out'       => 'required|date|after:check_in',
            'guest_name'      => ['required', 'string', 'max:100', 'regex:/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/'],
            'guest_surname'   => ['required', 'string', 'max:100', 'regex:/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/'],
            'guest_email'     => 'required|email|max:150',
            'document_type'   => 'required|string|in:DNI,Pasaporte,Carnet Extranjería',
            'document_number' => 'required|string|max:20',
            'guest_phone'     => ['nullable', 'string', 'max:20', 'regex:/^\+?[0-9\s\-]+$/'],
            'notes'           => 'nullable|string|max:500',
            'companions'      => 'nullable|array|max:10',
            'companions.*.name' => ['required_with:companions', 'string', 'max:100', 'regex:/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/'],
            'companions.*.surname' => ['required_with:companions', 'string', 'max:100', 'regex:/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/'],
            'companions.*.document_type' => 'required_with:companions|string|max:50',
            'companions.*.document_number' => 'required_with:companions|string|max:20',
            'companions.*.email' => 'nullable|email|max:150',
            'companions.*.phone' => ['nullable', 'string', 'max:20', 'regex:/^\+?[0-9\s\-]+$/'],
            'coupon_code'     => 'nullable|string|max:50',
            'payment_method'  => 'nullable|string|in:card,cash,cash_later',
            'verification_token' => 'nullable|string|max:128',
        ]);

        $paymentMethod = $validated['payment_method'] ?? 'card';
        if ($paymentMethod !== 'card') {
            return response()->json([
                'message' => 'Los pagos en efectivo solo pueden registrarse en recepción.',
            ], 422);
        }

        // SHE-026: sin sesión (Sanctum) se exige un correo verificado por OTP.
        $verification = null;
        if (!auth('sanctum')->user()) {
            $verification = $this->verifications->assertValid($validated['verification_token'] ?? null, $validated['guest_email']);
        }
        unset($validated['verification_token']);

        $paymentIntent = null;

        $result = $this->bookings->create($validated, false, function (Booking $booking, array $quote) use (&$paymentIntent, $verification) {
            // El token se consume al crear la reserva (misma transacción: si algo falla, no se pierde).
            if ($verification) {
                $this->verifications->consume($verification);
            }

            $paymentIntent = $this->paymentGateway->createPaymentIntent($quote['total'], 'PEN', [
                'booking_code' => $booking->booking_code,
                'room_id'      => $booking->room_id,
            ]);

            Payment::create([
                'booking_id'       => $booking->id,
                'amount'           => $quote['total'],
                'payment_method'   => 'card',
                'status'           => Payment::STATUS_PENDING,
                'transaction_id'   => $paymentIntent['transaction_id'],
                'gateway_provider' => $paymentIntent['provider'],
                'currency'         => 'PEN',
                'payment_details'  => [
                    'discount_amount' => $quote['discount'],
                    'coupon_code'     => $quote['coupon']['code'] ?? null,
                    'sub_total'       => $quote['subtotal'],
                ],
            ]);
        });

        /** @var Booking $booking */
        $booking = $result['booking'];
        $booking->load(['guest', 'room']);
        // Respuesta pública: no exponer datos personales de la ficha del huésped.
        $booking->guest?->setVisible(['id', 'name', 'surname', 'email']);

        return response()->json([
            'message'        => 'Intención de pago creada. Proceda con el pago seguro.',
            'booking_code'   => $booking->booking_code,
            'booking'        => $booking,
            'expires_at'     => $booking->expires_at?->toIso8601String(),
            'client_secret'  => $paymentIntent['client_secret'],
            'transaction_id' => $paymentIntent['transaction_id'],
            'provider'       => $paymentIntent['provider'],
            'summary'        => BookingService::summary($result['quote']),
        ], 201);
    }

    /**
     * Paga con tarjeta (simulador) una reserva pending_payment existente.
     * Idempotente: una reserva ya pagada responde 409.
     *
     * POST /api/payments/process-mock
     */
    public function processMockPayment(Request $request): JsonResponse
    {
        if (!($this->paymentGateway instanceof MockPaymentService)) {
            return response()->json([
                'message' => 'Este endpoint solo está disponible en modo simulación.',
            ], 403);
        }

        $validated = $request->validate([
            'booking_code' => 'required|string|max:20',
            'card_number'  => 'required|string|min:13|max:23',
            'card_expiry'  => ['required', 'string', 'regex:/^\d{2}\/\d{2}$/'],
            'card_cvc'     => ['required', 'string', 'regex:/^\d{3,4}$/'],
            'card_holder'  => 'required|string|max:100',
        ]);

        $errors = CardValidator::errors($validated['card_number'], $validated['card_expiry'], $validated['card_cvc']);
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        $outcome = DB::transaction(function () use ($validated) {
            $booking = Booking::where('booking_code', $validated['booking_code'])->lockForUpdate()->first();

            if (!$booking) {
                throw new BookingException('Reserva no encontrada con el código proporcionado.', 404);
            }

            if (in_array($booking->status, [Booking::STATUS_CONFIRMED, Booking::STATUS_CHECKED_IN, Booking::STATUS_CHECKED_OUT], true)) {
                throw new BookingException('Esta reserva ya fue pagada.', 409);
            }

            if ($booking->status !== Booking::STATUS_PENDING_PAYMENT) {
                throw new BookingException('La reserva no admite pagos en su estado actual.', 409);
            }

            if ($booking->isPendingExpired()) {
                $this->expireBooking($booking);
                return ['expired' => true];
            }

            $payment = Payment::where('booking_id', $booking->id)
                ->where('status', Payment::STATUS_PENDING)
                ->lockForUpdate()
                ->first();

            if (!$payment) {
                throw new BookingException('No hay un pago pendiente para esta reserva.', 409);
            }

            // Se reserva el uso del cupón antes de cobrar; se libera si el cobro falla.
            if (!$this->coupons->consumeForBooking($booking)) {
                throw new BookingException('El cupón aplicado ya no tiene usos disponibles. Inicie una nueva reserva.', 409);
            }

            $result = $this->paymentGateway->processPayment(
                $validated['card_number'],
                $validated['card_expiry'],
                $validated['card_cvc'],
                (float) $payment->amount,
                $payment->currency ?? 'PEN',
                ['booking_code' => $booking->booking_code]
            );

            if (empty($result['success'])) {
                $this->coupons->releaseForBooking($booking);

                $payment->update([
                    'status'          => Payment::STATUS_FAILED,
                    'transaction_id'  => $result['transaction_id'],
                    'payment_details' => array_merge($payment->payment_details ?? [], [
                        'decline_reason' => $result['decline_reason'] ?? 'unknown',
                    ]),
                ]);
                $booking->update(['status' => Booking::STATUS_CANCELLED, 'expires_at' => null]);

                return ['success' => false, 'result' => $result];
            }

            $receiptNumber = Payment::generateReceiptNumber();
            $payment->update([
                'status'          => Payment::STATUS_COMPLETED,
                'transaction_id'  => $result['transaction_id'],
                'receipt_number'  => $receiptNumber,
                'payment_details' => array_merge($payment->payment_details ?? [], $result['payment_details'] ?? []),
                'paid_at'         => now(),
            ]);

            $booking->update(['status' => Booking::STATUS_CONFIRMED, 'expires_at' => null]);

            return ['success' => true, 'booking' => $booking, 'payment' => $payment->fresh(), 'result' => $result];
        });

        if (!empty($outcome['expired'])) {
            return response()->json([
                'message' => 'El tiempo para completar el pago expiró. Inicie una nueva reserva.',
            ], 409);
        }

        if (!$outcome['success']) {
            return response()->json([
                'message' => $outcome['result']['message'] ?? 'El pago fue rechazado.',
                'success' => false,
                'status'  => 'failed',
            ], 422);
        }

        /** @var Booking $booking */
        $booking = $outcome['booking'];
        /** @var Payment $payment */
        $payment = $outcome['payment'];
        $booking->load(['guest', 'room', 'latestPayment', 'companions']);

        $this->sendConfirmationMails($booking);

        // Respuesta pública: sin documentos/teléfonos de huésped ni acompañantes.
        $booking->unsetRelation('companions');
        $booking->guest?->setVisible(['id', 'name', 'surname', 'email']);

        return response()->json([
            'message'        => '¡Pago procesado exitosamente! Tu reserva ha sido confirmada.',
            'success'        => true,
            'booking_code'   => $booking->booking_code,
            'receipt_number' => $payment->receipt_number,
            'booking'        => $booking,
            'payment'        => [
                'transaction_id'  => $payment->transaction_id,
                'amount'          => $payment->amount,
                'currency'        => $payment->currency,
                'payment_details' => [
                    'brand' => $payment->payment_details['brand'] ?? null,
                    'last4' => $payment->payment_details['last4'] ?? null,
                ],
                'receipt_number'  => $payment->receipt_number,
                'paid_at'         => $payment->paid_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Comprobante de pago. Acceso: dueño o personal (token Sanctum), o ?email= igual al del huésped.
     * En cualquier otro caso 404 (no revela existencia). No expone document_number y enmascara el teléfono.
     *
     * GET /api/bookings/{code}/receipt
     */
    public function getReceipt(Request $request, string $code): JsonResponse
    {
        $booking = Booking::with(['guest', 'room'])
            ->where('booking_code', $code)
            ->first();

        $notFound = response()->json(['message' => 'Reserva no encontrada con el código proporcionado.'], 404);

        if (!$booking) {
            return $notFound;
        }

        $user = $request->user() ?? $request->user('sanctum');
        $email = $request->query('email');
        $emailMatches = is_string($email) && $email !== '' && !empty($booking->guest?->email)
            && hash_equals(mb_strtolower($booking->guest->email), mb_strtolower(trim($email)));

        if (!$booking->isAccessibleBy($user) && !$emailMatches) {
            return $notFound;
        }

        $payment = $booking->payments()
            ->where('status', Payment::STATUS_COMPLETED)
            ->where('amount', '>', 0)
            ->latest()
            ->first();

        if (!$payment) {
            return response()->json([
                'message' => 'No se encontró un pago completado para esta reserva.',
            ], 404);
        }

        $nights = max(1, (int) Carbon::parse($booking->check_in)->diffInDays(Carbon::parse($booking->check_out)));
        $pricing = $booking->pricing_details ?? [];

        return response()->json([
            'receipt' => [
                'receipt_number'  => $payment->receipt_number,
                'booking_code'    => $booking->booking_code,
                'transaction_id'  => $payment->transaction_id,
                'gateway'         => $payment->gateway_provider,
                'hotel'           => [
                    'name'    => config('hotel.name'),
                    'address' => config('hotel.address'),
                    'ruc'     => config('hotel.ruc'),
                    'phone'   => config('hotel.phone'),
                ],
                'guest'           => [
                    'name'          => trim(($booking->guest->name ?? '') . ' ' . ($booking->guest->surname ?? '')),
                    'document_type' => $booking->guest->document_type ?? null,
                    'email'         => $booking->guest->email ?? null,
                    'phone'         => $booking->guest?->maskedPhone(),
                ],
                'room'            => [
                    'name'        => $booking->room->name ?? null,
                    'room_number' => $booking->room->room_number ?? null,
                    'bed_type'    => $booking->room->bed_type ?? null,
                ],
                'stay'            => [
                    'check_in'        => $booking->check_in,
                    'check_out'       => $booking->check_out,
                    'nights'          => $nights,
                    'price_per_night' => $pricing['price_per_night'] ?? ($booking->room?->effective_price),
                    'sub_total'       => $pricing['subtotal'] ?? null,
                    'discount'        => (float) ($booking->discount_amount ?? 0),
                    'total_amount'    => (float) $booking->total_amount,
                ],
                'payment'         => [
                    'method'   => $payment->payment_method,
                    'brand'    => $payment->payment_details['brand'] ?? null,
                    'last4'    => $payment->payment_details['last4'] ?? null,
                    'amount'   => $payment->amount,
                    'currency' => $payment->currency,
                    'status'   => $payment->status,
                    'paid_at'  => $payment->paid_at?->toIso8601String(),
                ],
                // Los precios incluyen IGV: se informa la porción incluida.
                'tax'             => BookingPricingService::igvBreakdown((float) $payment->amount),
                'issued_at'       => now()->toIso8601String(),
            ],
        ]);
    }

    private function expireBooking(Booking $booking): void
    {
        $this->coupons->releaseForBooking($booking);
        Payment::where('booking_id', $booking->id)
            ->where('status', Payment::STATUS_PENDING)
            ->update(['status' => Payment::STATUS_CANCELLED]);
        $booking->update(['status' => Booking::STATUS_EXPIRED]);
    }

    private function sendConfirmationMails(Booking $booking): void
    {
        try {
            if (!empty($booking->guest?->email)) {
                Mail::to($booking->guest->email)->send(new BookingConfirmedMail($booking));
            }

            foreach ($booking->companions ?? [] as $companion) {
                if (!empty($companion->email)) {
                    Mail::to($companion->email)->send(new BookingConfirmedMail($booking));
                }
            }
        } catch (\Throwable $e) {
            Log::error('No se pudo enviar el correo de confirmación post-pago', ['booking_id' => $booking->id, 'error' => get_class($e)]);
        }
    }
}
