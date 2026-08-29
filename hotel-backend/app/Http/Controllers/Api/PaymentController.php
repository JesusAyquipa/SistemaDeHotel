<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Guest;
use App\Models\Payment;
use App\Models\Room;
use App\Services\Payment\MockPaymentService;
use App\Services\Payment\PaymentGatewayInterface;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    private PaymentGatewayInterface $paymentGateway;

    public function __construct(PaymentGatewayInterface $paymentGateway)
    {
        $this->paymentGateway = $paymentGateway;
    }

    /**
     * Crea una intención de pago para el checkout de una reserva.
     * Registra la reserva en estado 'pending_payment' y genera el intent de la pasarela.
     *
     * POST /api/payments/checkout-intent
     */
    public function createCheckoutIntent(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'room_id'         => 'required|exists:rooms,id',
            'check_in'        => 'required|date|after_or_equal:today',
            'check_out'       => 'required|date|after:check_in',
            'guest_name'      => 'required|string|max:100',
            'guest_surname'   => 'required|string|max:100',
            'guest_email'     => 'required|email|max:150',
            'document_type'   => 'required|string|in:DNI,Pasaporte,Carnet Extranjería',
            'document_number' => 'required|string|max:20',
            'guest_phone'     => 'nullable|string|max:20',
            'notes'           => 'nullable|string|max:500',
        ]);

        $room = Room::findOrFail($validated['room_id']);

        // Calcular noches y monto total
        $checkIn = Carbon::parse($validated['check_in'])->startOfDay();
        $checkOut = Carbon::parse($validated['check_out'])->startOfDay();
        $nights = max(1, $checkIn->diffInDays($checkOut));
        $totalAmount = $room->price_per_night * $nights;

        // Verificar disponibilidad (sin conflictos de fechas)
        $isOverlapping = Booking::where('room_id', $room->id)
            ->where(function ($query) use ($validated) {
                $query->where('check_in', '<', $validated['check_out'])
                      ->where('check_out', '>', $validated['check_in']);
            })
            ->whereIn('status', ['confirmed', 'checked_in', 'reservada', 'pending_payment'])
            ->exists();

        if ($isOverlapping) {
            return response()->json([
                'message' => 'La habitación seleccionada ya no se encuentra disponible en las fechas especificadas.',
                'errors'  => [
                    'dates' => ['Conflicto de fechas con una reserva existente.']
                ]
            ], 422);
        }

        // Crear intención de pago en la pasarela
        $paymentIntent = $this->paymentGateway->createPaymentIntent($totalAmount, 'PEN', [
            'room_id'    => $room->id,
            'guest_email' => $validated['guest_email'],
        ]);

        // Crear reserva en estado pending_payment dentro de una transacción
        $booking = DB::transaction(function () use ($validated, $room, $totalAmount, $paymentIntent) {
            // Obtener o registrar huésped
            $guest = Guest::where('document_number', $validated['document_number'])
                ->orWhere('email', $validated['guest_email'])
                ->first();

            if (!$guest) {
                $guest = Guest::create([
                    'name'            => $validated['guest_name'],
                    'surname'         => $validated['guest_surname'],
                    'document_type'   => $validated['document_type'],
                    'document_number' => $validated['document_number'],
                    'phone'           => $validated['guest_phone'] ?? null,
                    'email'           => $validated['guest_email'],
                    'notes'           => $validated['notes'] ?? null,
                ]);
            } else {
                $guest->update([
                    'name'    => $validated['guest_name'],
                    'surname' => $validated['guest_surname'],
                    'phone'   => $validated['guest_phone'] ?? $guest->phone,
                    'notes'   => $validated['notes'] ?? $guest->notes,
                ]);
            }

            // Generar código único de reserva
            do {
                $bookingCode = 'RES-' . strtoupper(Str::random(8));
            } while (Booking::where('booking_code', $bookingCode)->exists());

            // Crear reserva con estado pendiente de pago
            $newBooking = Booking::create([
                'booking_code' => $bookingCode,
                'guest_id'     => $guest->id,
                'room_id'      => $room->id,
                'check_in'     => $validated['check_in'],
                'check_out'    => $validated['check_out'],
                'total_amount' => $totalAmount,
                'status'       => 'pending_payment',
            ]);

            // Registrar pago en estado pending
            Payment::create([
                'booking_id'       => $newBooking->id,
                'amount'           => $totalAmount,
                'payment_method'   => 'card',
                'status'           => 'pending',
                'transaction_id'   => $paymentIntent['transaction_id'],
                'gateway_provider' => $paymentIntent['provider'],
                'currency'         => 'PEN',
            ]);

            return $newBooking;
        });

        $booking->load(['guest', 'room']);

        return response()->json([
            'message'        => 'Intención de pago creada. Proceda con el pago seguro.',
            'booking_code'   => $booking->booking_code,
            'booking'        => $booking,
            'client_secret'  => $paymentIntent['client_secret'],
            'transaction_id' => $paymentIntent['transaction_id'],
            'provider'       => $paymentIntent['provider'],
            'summary'        => [
                'nights'          => $nights,
                'price_per_night' => $room->price_per_night,
                'total_amount'    => $totalAmount,
                'currency'        => 'PEN',
            ],
        ], 201);
    }

    /**
     * Procesa un pago simulado (solo en modo simulation).
     * Confirma la reserva y genera el comprobante de pago.
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
            'booking_code' => 'required|string|exists:bookings,booking_code',
            'card_number'  => 'required|string|min:13|max:19',
            'card_expiry'  => ['required', 'string', 'regex:/^\d{2}\/\d{2}$/'],
            'card_cvc'     => 'required|string|min:3|max:4',
            'card_holder'  => 'required|string|max:100',
        ]);

        $booking = Booking::where('booking_code', $validated['booking_code'])
            ->where('status', 'pending_payment')
            ->firstOrFail();

        $payment = Payment::where('booking_id', $booking->id)
            ->where('status', 'pending')
            ->firstOrFail();

        /** @var MockPaymentService $gateway */
        $gateway = $this->paymentGateway;

        $result = $gateway->processPayment(
            $validated['card_number'],
            $validated['card_expiry'],
            $validated['card_cvc'],
            (float) $payment->amount,
            $payment->currency ?? 'PEN',
            ['booking_code' => $booking->booking_code]
        );

        if (!$result['success']) {
            // Pago rechazado (tarjeta de prueba inválida)
            $payment->update([
                'status'          => 'failed',
                'transaction_id'  => $result['transaction_id'],
                'payment_details' => ['decline_reason' => $result['decline_reason']],
            ]);

            // Cancelar la reserva
            $booking->update(['status' => 'cancelled']);

            return response()->json([
                'message' => $result['message'],
                'success' => false,
                'status'  => 'failed',
            ], 422);
        }

        // Pago exitoso: confirmar reserva y generar comprobante
        $receiptNumber = Payment::generateReceiptNumber();

        DB::transaction(function () use ($booking, $payment, $result, $receiptNumber) {
            $payment->update([
                'status'           => 'completed',
                'transaction_id'   => $result['transaction_id'],
                'receipt_number'   => $receiptNumber,
                'payment_details'  => $result['payment_details'],
                'paid_at'          => now(),
            ]);

            $booking->update(['status' => 'confirmed']);

            $booking->room->update(['status' => 'reservada']);
        });

        $booking->load(['guest', 'room', 'latestPayment']);

        return response()->json([
            'message'        => '¡Pago procesado exitosamente! Tu reserva ha sido confirmada.',
            'success'        => true,
            'booking_code'   => $booking->booking_code,
            'receipt_number' => $receiptNumber,
            'booking'        => $booking,
            'payment'        => [
                'transaction_id'  => $result['transaction_id'],
                'amount'          => $payment->amount,
                'currency'        => $payment->currency,
                'payment_details' => $result['payment_details'],
                'receipt_number'  => $receiptNumber,
                'paid_at'         => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Obtiene el comprobante de pago de una reserva confirmada.
     * GET /api/bookings/{code}/receipt
     */
    public function getReceipt(string $code): JsonResponse
    {
        $booking = Booking::with(['guest', 'room', 'payments'])
            ->where('booking_code', $code)
            ->first();

        if (!$booking) {
            return response()->json([
                'message' => 'Reserva no encontrada con el código proporcionado.',
            ], 404);
        }

        $payment = $booking->payments()
            ->where('status', 'completed')
            ->latest()
            ->first();

        if (!$payment) {
            return response()->json([
                'message' => 'No se encontró un pago completado para esta reserva.',
            ], 404);
        }

        $checkIn = Carbon::parse($booking->check_in);
        $checkOut = Carbon::parse($booking->check_out);
        $nights = max(1, $checkIn->diffInDays($checkOut));

        return response()->json([
            'receipt' => [
                'receipt_number'  => $payment->receipt_number,
                'booking_code'    => $booking->booking_code,
                'transaction_id'  => $payment->transaction_id,
                'gateway'         => $payment->gateway_provider,
                'hotel'           => [
                    'name'    => 'Sheraton Lima Hotel & Convention Center',
                    'address' => 'Av. Paseo de la República 170, Lima, Perú',
                    'ruc'     => '20100128218',
                    'phone'   => '+51 1 315-5000',
                ],
                'guest'           => [
                    'name'            => $booking->guest->name . ' ' . $booking->guest->surname,
                    'document_type'   => $booking->guest->document_type,
                    'document_number' => $booking->guest->document_number,
                    'email'           => $booking->guest->email,
                    'phone'           => $booking->guest->phone,
                ],
                'room'            => [
                    'name'        => $booking->room->name,
                    'room_number' => $booking->room->room_number,
                    'bed_type'    => $booking->room->bed_type,
                ],
                'stay'            => [
                    'check_in'        => $booking->check_in,
                    'check_out'       => $booking->check_out,
                    'nights'          => $nights,
                    'price_per_night' => $booking->room->price_per_night,
                ],
                'payment'         => [
                    'method'          => $payment->payment_method,
                    'brand'           => $payment->payment_details['brand'] ?? null,
                    'last4'           => $payment->payment_details['last4'] ?? null,
                    'amount'          => $payment->amount,
                    'currency'        => $payment->currency,
                    'status'          => $payment->status,
                    'paid_at'         => $payment->paid_at?->toIso8601String(),
                ],
                'issued_at'       => now()->toIso8601String(),
            ],
        ]);
    }
}
