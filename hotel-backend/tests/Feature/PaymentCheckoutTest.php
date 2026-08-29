<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Guest;
use App\Models\Payment;
use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentCheckoutTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();

        // Crear una habitación disponible para pruebas
        $this->room = Room::create([
            'room_number'     => '501',
            'name'            => 'Suite Presidencial de Pruebas',
            'bed_type'        => 'king',
            'capacity'        => 2,
            'price_per_night' => 350.00,
            'status'          => 'disponible',
            'description'     => 'Habitación de prueba para módulo de pagos.',
        ]);
    }

    /**
     * Test 1: Intención de checkout crea reserva pending_payment e intent de pago.
     */
    public function test_can_create_checkout_intent(): void
    {
        $payload = [
            'room_id'         => $this->room->id,
            'check_in'        => now()->addDays(1)->toDateString(),
            'check_out'       => now()->addDays(3)->toDateString(),
            'guest_name'      => 'María',
            'guest_surname'   => 'García',
            'guest_email'     => 'maria.garcia@example.com',
            'document_type'   => 'DNI',
            'document_number' => '87654321',
            'guest_phone'     => '+51987654321',
        ];

        $response = $this->postJson('/api/payments/checkout-intent', $payload);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'message',
                'booking_code',
                'booking',
                'client_secret',
                'transaction_id',
                'provider',
                'summary' => ['nights', 'price_per_night', 'total_amount', 'currency'],
            ]);

        $bookingCode = $response->json('booking_code');

        // Verificar reserva en base de datos
        $this->assertDatabaseHas('bookings', [
            'booking_code' => $bookingCode,
            'status'       => 'pending_payment',
            'total_amount' => 700.00, // 2 noches * 350.00
        ]);

        // Verificar registro de pago pendiente
        $this->assertDatabaseHas('payments', [
            'status'           => 'pending',
            'amount'           => 700.00,
            'gateway_provider' => 'simulation',
        ]);
    }

    /**
     * Test 2: Pago simulado exitoso confirma reserva y genera comprobante REC-YYYYMM-XXXX.
     */
    public function test_successful_mock_payment_confirms_booking_and_generates_receipt(): void
    {
        // 1. Crear checkout intent
        $intentPayload = [
            'room_id'         => $this->room->id,
            'check_in'        => now()->addDays(1)->toDateString(),
            'check_out'       => now()->addDays(2)->toDateString(), // 1 noche = 350.00
            'guest_name'      => 'Carlos',
            'guest_surname'   => 'López',
            'guest_email'     => 'carlos.lopez@example.com',
            'document_type'   => 'DNI',
            'document_number' => '12345678',
        ];

        $intentResponse = $this->postJson('/api/payments/checkout-intent', $intentPayload);
        $bookingCode = $intentResponse->json('booking_code');

        // 2. Procesar pago con Visa de prueba (4242...)
        $paymentPayload = [
            'booking_code' => $bookingCode,
            'card_number'  => '4242 4242 4242 4242',
            'card_expiry'  => '12/28',
            'card_cvc'     => '123',
            'card_holder'  => 'CARLOS LOPEZ',
        ];

        $paymentResponse = $this->postJson('/api/payments/process-mock', $paymentPayload);

        $paymentResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonStructure([
                'message',
                'booking_code',
                'receipt_number',
                'booking',
                'payment' => ['transaction_id', 'amount', 'currency', 'payment_details', 'receipt_number', 'paid_at'],
            ]);

        $receiptNumber = $paymentResponse->json('receipt_number');
        $this->assertStringStartsWith('REC-', $receiptNumber);

        // Verificar que la reserva esté confirmada
        $this->assertDatabaseHas('bookings', [
            'booking_code' => $bookingCode,
            'status'       => 'confirmed',
        ]);

        // Verificar que la habitación pasó a estado reservada
        $this->assertDatabaseHas('rooms', [
            'id'     => $this->room->id,
            'status' => 'reservada',
        ]);

        // Verificar pago completado con número de comprobante
        $this->assertDatabaseHas('payments', [
            'status'         => 'completed',
            'receipt_number' => $receiptNumber,
        ]);
    }

    /**
     * Test 3: Tarjeta rechazada marca pago como failed y cancela reserva.
     */
    public function test_declined_card_marks_payment_failed_and_cancels_booking(): void
    {
        $intentPayload = [
            'room_id'         => $this->room->id,
            'check_in'        => now()->addDays(5)->toDateString(),
            'check_out'       => now()->addDays(6)->toDateString(),
            'guest_name'      => 'Ana',
            'guest_surname'   => 'Martínez',
            'guest_email'     => 'ana.martinez@example.com',
            'document_type'   => 'DNI',
            'document_number' => '87651234',
        ];

        $intentResponse = $this->postJson('/api/payments/checkout-intent', $intentPayload);
        $bookingCode = $intentResponse->json('booking_code');

        // Procesar pago con tarjeta rechazada de prueba (4000 0000 0000 0002)
        $paymentPayload = [
            'booking_code' => $bookingCode,
            'card_number'  => '4000 0000 0000 0002',
            'card_expiry'  => '10/27',
            'card_cvc'     => '999',
            'card_holder'  => 'ANA MARTINEZ',
        ];

        $paymentResponse = $this->postJson('/api/payments/process-mock', $paymentPayload);

        $paymentResponse->assertStatus(422)
            ->assertJson([
                'success' => false,
                'status'  => 'failed',
            ]);

        // La reserva debe estar en estado cancelada
        $this->assertDatabaseHas('bookings', [
            'booking_code' => $bookingCode,
            'status'       => 'cancelled',
        ]);
    }

    /**
     * Test 4: Endpoint GET /api/bookings/{code}/receipt retorna el comprobante detallado.
     */
    public function test_can_fetch_payment_receipt(): void
    {
        // Crear checkout e ingresar pago exitoso
        $intentPayload = [
            'room_id'         => $this->room->id,
            'check_in'        => now()->addDays(2)->toDateString(),
            'check_out'       => now()->addDays(4)->toDateString(),
            'guest_name'      => 'Roberto',
            'guest_surname'   => 'Díaz',
            'guest_email'     => 'roberto.diaz@example.com',
            'document_type'   => 'DNI',
            'document_number' => '44332211',
        ];

        $intentResponse = $this->postJson('/api/payments/checkout-intent', $intentPayload);
        $bookingCode = $intentResponse->json('booking_code');

        $this->postJson('/api/payments/process-mock', [
            'booking_code' => $bookingCode,
            'card_number'  => '5555 5555 5555 4444', // Mastercard
            'card_expiry'  => '11/29',
            'card_cvc'     => '456',
            'card_holder'  => 'ROBERTO DIAZ',
        ]);

        // Consultar comprobante
        $receiptResponse = $this->getJson("/api/bookings/{$bookingCode}/receipt");

        $receiptResponse->assertStatus(200)
            ->assertJsonStructure([
                'receipt' => [
                    'receipt_number',
                    'booking_code',
                    'transaction_id',
                    'gateway',
                    'hotel' => ['name', 'address', 'ruc', 'phone'],
                    'guest' => ['name', 'document_type', 'document_number', 'email'],
                    'room'  => ['name', 'room_number', 'bed_type'],
                    'stay'  => ['check_in', 'check_out', 'nights', 'price_per_night'],
                    'payment' => ['method', 'brand', 'last4', 'amount', 'currency', 'status', 'paid_at'],
                    'issued_at',
                ],
            ]);
    }

    /**
     * Test 5: Webhook de pago confirmado procesa el evento correctamente.
     */
    public function test_webhook_payment_succeeded_confirms_booking(): void
    {
        $guest = Guest::create([
            'name'            => 'Luis',
            'surname'         => 'Vargas',
            'document_type'   => 'DNI',
            'document_number' => '55667788',
            'email'           => 'luis.vargas@example.com',
        ]);

        $booking = Booking::create([
            'booking_code' => 'RES-TESTWEBHOOK',
            'guest_id'     => $guest->id,
            'room_id'      => $this->room->id,
            'check_in'     => now()->addDays(1)->toDateString(),
            'check_out'    => now()->addDays(2)->toDateString(),
            'total_amount' => 350.00,
            'status'       => 'pending_payment',
        ]);

        $payment = Payment::create([
            'booking_id'       => $booking->id,
            'amount'           => 350.00,
            'payment_method'   => 'card',
            'status'           => 'pending',
            'transaction_id'   => 'pi_stripe_test_123',
            'gateway_provider' => 'simulation',
            'currency'         => 'PEN',
        ]);

        $webhookPayload = [
            'type' => 'payment_intent.succeeded',
            'data' => [
                'id' => 'pi_stripe_test_123',
                'payment_method_details' => [
                    'card' => [
                        'brand' => 'visa',
                        'last4' => '4242',
                    ]
                ]
            ]
        ];

        $response = $this->postJson('/api/webhooks/payment', $webhookPayload);

        $response->assertStatus(200);

        // La reserva debe haberse actualizado a confirmed
        $this->assertDatabaseHas('bookings', [
            'id'     => $booking->id,
            'status' => 'confirmed',
        ]);

        // El pago debe estar completado
        $this->assertDatabaseHas('payments', [
            'id'     => $payment->id,
            'status' => 'completed',
        ]);
    }
}
