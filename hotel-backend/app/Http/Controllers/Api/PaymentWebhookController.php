<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\BookingAvailabilityService;
use App\Services\CouponService;
use App\Services\Payment\PaymentGatewayInterface;
use App\Services\RefundPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Webhooks de la pasarela de pago. Requiere firma válida:
 *  - simulador: header X-Signature = hex(hmac_sha256(raw body, PAYMENT_WEBHOOK_SECRET))
 *  - Stripe:    header Stripe-Signature
 * Sin firma, firma inválida o secreto no configurado -> 401. El procesamiento es idempotente.
 */
class PaymentWebhookController extends Controller
{
    public function __construct(
        private PaymentGatewayInterface $paymentGateway,
        private CouponService $coupons,
        private BookingAvailabilityService $availability,
    ) {
    }

    /**
     * POST /api/webhooks/payment
     */
    public function handleWebhook(Request $request): JsonResponse
    {
        $payload = $request->getContent();
        $signature = (string) ($request->header('X-Signature') ?? $request->header('Stripe-Signature') ?? '');

        if ($signature === '') {
            return response()->json(['message' => 'Firma inválida.'], 401);
        }

        try {
            $event = $this->paymentGateway->verifyWebhookSignature($payload, $signature);
        } catch (\Throwable $e) {
            Log::warning('Webhook signature verification failed', [
                'provider' => $this->paymentGateway->getProviderName(),
            ]);
            return response()->json(['message' => 'Firma inválida.'], 401);
        }

        $eventType = $event['type'] ?? null;
        $eventData = is_array($event['data'] ?? null) ? $event['data'] : [];

        Log::info('Webhook received', [
            'type'     => $eventType,
            'provider' => $this->paymentGateway->getProviderName(),
        ]);

        return match ($eventType) {
            'payment_intent.succeeded'      => $this->handlePaymentSucceeded($eventData),
            'payment_intent.payment_failed' => $this->handlePaymentFailed($eventData),
            default => response()->json(['message' => 'Evento no manejado.']),
        };
    }

    /**
     * Pago exitoso: pago -> completed, reserva -> confirmed (idempotente).
     */
    private function handlePaymentSucceeded(array $data): JsonResponse
    {
        $transactionId = $data['id'] ?? null;
        if (!$transactionId) {
            return response()->json(['message' => 'Transaction ID no proporcionado.'], 422);
        }

        return DB::transaction(function () use ($transactionId, $data) {
            $payment = Payment::where('transaction_id', $transactionId)->lockForUpdate()->first();

            if (!$payment) {
                Log::warning('Webhook: Payment not found for transaction', ['transaction_id' => $transactionId]);
                return response()->json(['message' => 'Pago no encontrado.'], 404);
            }

            if ($payment->status === Payment::STATUS_COMPLETED) {
                return response()->json(['message' => 'Pago ya procesado previamente.']);
            }

            $booking = Booking::whereKey($payment->booking_id)->lockForUpdate()->first();

            $payment->update([
                'status'          => Payment::STATUS_COMPLETED,
                'receipt_number'  => $payment->receipt_number ?? Payment::generateReceiptNumber(),
                'paid_at'         => now(),
                'payment_details' => array_merge($payment->payment_details ?? [], [
                    'brand'         => $data['payment_method_details']['card']['brand'] ?? null,
                    'last4'         => $data['payment_method_details']['card']['last4'] ?? null,
                    'authorized_at' => now()->toIso8601String(),
                ]),
            ]);

            $canConfirm = $booking
                && in_array($booking->status, [Booking::STATUS_PENDING_PAYMENT, Booking::STATUS_EXPIRED], true)
                && !$this->availability->hasOverlap($booking->room_id, $booking->check_in, $booking->check_out, $booking->id)
                && $this->coupons->consumeForBooking($booking);

            if ($canConfirm) {
                $booking->update(['status' => Booking::STATUS_CONFIRMED, 'expires_at' => null]);
            } elseif ($booking && !in_array($booking->status, [Booking::STATUS_CONFIRMED, Booking::STATUS_CHECKED_IN, Booking::STATUS_CHECKED_OUT], true)) {
                // El cobro llegó tarde (reserva expirada/cancelada o habitación ya tomada): se devuelve.
                RefundPolicy::recordRefund($booking, (float) $payment->amount, 'Pago recibido para una reserva no disponible');
                Log::warning('Webhook: payment for unavailable booking, refund recorded', ['booking_id' => $booking->id]);
            }

            return response()->json(['message' => 'Pago confirmado exitosamente.']);
        });
    }

    /**
     * Pago fallido: pago -> failed, reserva pendiente -> cancelled (idempotente).
     */
    private function handlePaymentFailed(array $data): JsonResponse
    {
        $transactionId = $data['id'] ?? null;
        if (!$transactionId) {
            return response()->json(['message' => 'Transaction ID no proporcionado.'], 422);
        }

        return DB::transaction(function () use ($transactionId, $data) {
            $payment = Payment::where('transaction_id', $transactionId)->lockForUpdate()->first();

            if (!$payment) {
                return response()->json(['message' => 'Pago no encontrado.'], 404);
            }

            if (in_array($payment->status, [Payment::STATUS_FAILED, Payment::STATUS_COMPLETED], true)) {
                return response()->json(['message' => 'Pago ya procesado previamente.']);
            }

            $payment->update([
                'status'          => Payment::STATUS_FAILED,
                'payment_details' => array_merge($payment->payment_details ?? [], [
                    'decline_reason' => $data['last_payment_error']['code'] ?? 'unknown',
                ]),
            ]);

            $booking = Booking::whereKey($payment->booking_id)->lockForUpdate()->first();
            if ($booking && $booking->status === Booking::STATUS_PENDING_PAYMENT) {
                $this->coupons->releaseForBooking($booking);
                $booking->update(['status' => Booking::STATUS_CANCELLED, 'expires_at' => null]);
            }

            return response()->json(['message' => 'Pago fallido registrado.']);
        });
    }
}
