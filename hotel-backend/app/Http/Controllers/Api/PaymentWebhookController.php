<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\Payment\PaymentGatewayInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Controlador de webhooks de la pasarela de pago.
 * Recibe notificaciones asíncronas de confirmación/fallo de pagos
 * y actualiza el estado de reservas y pagos de forma idempotente.
 */
class PaymentWebhookController extends Controller
{
    private PaymentGatewayInterface $paymentGateway;

    public function __construct(PaymentGatewayInterface $paymentGateway)
    {
        $this->paymentGateway = $paymentGateway;
    }

    /**
     * Recibe y procesa un webhook de la pasarela de pago.
     * Valida la firma criptográfica del evento y actualiza la reserva y pago.
     *
     * POST /api/webhooks/payment
     */
    public function handleWebhook(Request $request): JsonResponse
    {
        $payload = $request->getContent();
        $signatureHeader = $request->header('Stripe-Signature', $request->header('X-Webhook-Signature', ''));

        try {
            $event = $this->paymentGateway->verifyWebhookSignature($payload, $signatureHeader);
        } catch (\Exception $e) {
            Log::warning('Webhook signature verification failed', [
                'error'    => $e->getMessage(),
                'provider' => $this->paymentGateway->getProviderName(),
            ]);
            return response()->json(['error' => 'Firma inválida.'], 403);
        }

        $eventType = $event['type'] ?? null;
        $eventData = $event['data'] ?? [];

        Log::info('Webhook received', [
            'type'     => $eventType,
            'provider' => $this->paymentGateway->getProviderName(),
        ]);

        return match ($eventType) {
            'payment_intent.succeeded'       => $this->handlePaymentSucceeded($eventData),
            'payment_intent.payment_failed'  => $this->handlePaymentFailed($eventData),
            default => response()->json(['message' => 'Evento no manejado: ' . $eventType]),
        };
    }

    /**
     * Procesa un evento de pago exitoso.
     * Actualiza el pago a 'completed' y la reserva a 'confirmed' de forma idempotente.
     */
    private function handlePaymentSucceeded(array $data): JsonResponse
    {
        $transactionId = $data['id'] ?? null;

        if (!$transactionId) {
            return response()->json(['error' => 'Transaction ID no proporcionado.'], 400);
        }

        $payment = Payment::where('transaction_id', $transactionId)->first();

        if (!$payment) {
            Log::warning('Webhook: Payment not found for transaction', ['transaction_id' => $transactionId]);
            return response()->json(['message' => 'Pago no encontrado.'], 404);
        }

        // Idempotencia: si ya fue procesado, ignorar
        if ($payment->status === 'completed') {
            return response()->json(['message' => 'Pago ya procesado previamente.']);
        }

        $receiptNumber = Payment::generateReceiptNumber();

        DB::transaction(function () use ($payment, $data, $receiptNumber) {
            $payment->update([
                'status'          => 'completed',
                'receipt_number'  => $receiptNumber,
                'paid_at'         => now(),
                'payment_details' => [
                    'brand'         => $data['payment_method_details']['card']['brand'] ?? null,
                    'last4'         => $data['payment_method_details']['card']['last4'] ?? null,
                    'authorized_at' => now()->toIso8601String(),
                ],
            ]);

            $booking = $payment->booking;
            $booking->update(['status' => 'confirmed']);
            $booking->room->update(['status' => 'reservada']);
        });

        Log::info('Webhook: Payment succeeded', [
            'transaction_id' => $transactionId,
            'receipt_number' => $receiptNumber,
        ]);

        return response()->json(['message' => 'Pago confirmado exitosamente.']);
    }

    /**
     * Procesa un evento de pago fallido.
     * Actualiza el pago a 'failed' y cancela la reserva.
     */
    private function handlePaymentFailed(array $data): JsonResponse
    {
        $transactionId = $data['id'] ?? null;

        if (!$transactionId) {
            return response()->json(['error' => 'Transaction ID no proporcionado.'], 400);
        }

        $payment = Payment::where('transaction_id', $transactionId)->first();

        if (!$payment) {
            return response()->json(['message' => 'Pago no encontrado.'], 404);
        }

        // Idempotencia
        if (in_array($payment->status, ['failed', 'completed'])) {
            return response()->json(['message' => 'Pago ya procesado previamente.']);
        }

        DB::transaction(function () use ($payment, $data) {
            $payment->update([
                'status'          => 'failed',
                'payment_details' => [
                    'decline_reason' => $data['last_payment_error']['code'] ?? 'unknown',
                    'decline_message' => $data['last_payment_error']['message'] ?? 'Pago rechazado.',
                ],
            ]);

            $payment->booking->update(['status' => 'cancelled']);
        });

        Log::info('Webhook: Payment failed', ['transaction_id' => $transactionId]);

        return response()->json(['message' => 'Pago fallido registrado.']);
    }
}
