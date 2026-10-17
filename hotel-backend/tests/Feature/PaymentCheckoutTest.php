<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Guest;
use App\Models\Payment;
use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class PaymentCheckoutTest extends TestCase
{
    use RefreshDatabase;

    private const WEBHOOK_SECRET = 'test-webhook-secret';

    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.payment.webhook_secret' => self::WEBHOOK_SECRET]);

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

    private function intentPayload(array $overrides = []): array
    {
        return array_merge([
            'room_id'         => $this->room->id,
            'check_in'        => now()->addDays(1)->toDateString(),
            'check_out'       => now()->addDays(3)->toDateString(),
            'guest_name'      => 'María',
            'guest_surname'   => 'García',
            'guest_email'     => 'maria.garcia@example.com',
            'document_type'   => 'DNI',
            'document_number' => '87654321',
            'guest_phone'     => '+51987654321',
        ], $overrides);
    }

    private function cardPayload(string $bookingCode, string $card = '4242 4242 4242 4242'): array
    {
        return [
            'booking_code' => $bookingCode,
            'card_number'  => $card,
            'card_expiry'  => now()->addYears(2)->format('m/y'),
            'card_cvc'     => '123',
            'card_holder'  => 'CARLOS LOPEZ',
        ];
    }

    private function postSignedWebhook(array $payload, ?string $signature = null): TestResponse
    {
        $body = json_encode($payload);
        $signature ??= hash_hmac('sha256', $body, self::WEBHOOK_SECRET);

        return $this->call('POST', '/api/webhooks/payment', [], [], [], [
            'CONTENT_TYPE'     => 'application/json',
            'HTTP_ACCEPT'      => 'application/json',
            'HTTP_X_SIGNATURE' => $signature,
        ], $body);
    }

    public function test_can_create_checkout_intent_with_pending_status_and_expiry(): void
    {
        $response = $this->postJson('/api/payments/checkout-intent', $this->intentPayload());

        $response->assertStatus(201)
            ->assertJsonStructure([
                'message',
                'booking_code',
                'booking',
                'expires_at',
                'client_secret',
                'transaction_id',
                'provider',
                'summary' => ['nights', 'price_per_night', 'total_amount', 'currency', 'igv_included'],
            ]);

        $booking = Booking::where('booking_code', $response->json('booking_code'))->first();

        $this->assertSame(Booking::STATUS_PENDING_PAYMENT, $booking->status);
        $this->assertEquals(700.00, (float) $booking->total_amount); // 2 noches * 350.00 (IGV incluido)
        $this->assertNotNull($booking->expires_at);
        $this->assertTrue($booking->expires_at->between(now()->addMinutes(29), now()->addMinutes(31)));

        $this->assertDatabaseHas('payments', [
            'booking_id'       => $booking->id,
            'status'           => 'pending',
            'amount'           => 700.00,
            'gateway_provider' => 'simulation',
        ]);
    }

    public function test_public_checkout_rejects_cash_payment_methods(): void
    {
        $this->postJson('/api/payments/checkout-intent', $this->intentPayload(['payment_method' => 'cash']))
            ->assertStatus(422);

        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_successful_mock_payment_confirms_booking_and_generates_receipt(): void
    {
        $bookingCode = $this->postJson('/api/payments/checkout-intent', $this->intentPayload([
            'check_out' => now()->addDays(2)->toDateString(),
        ]))->json('booking_code');

        $paymentResponse = $this->postJson('/api/payments/process-mock', $this->cardPayload($bookingCode));

        $paymentResponse->assertStatus(200)
            ->assertJson(['success' => true])
            ->assertJsonStructure([
                'message',
                'booking_code',
                'receipt_number',
                'booking',
                'payment' => ['transaction_id', 'amount', 'currency', 'payment_details', 'receipt_number', 'paid_at'],
            ]);

        $receiptNumber = $paymentResponse->json('receipt_number');
        $this->assertStringStartsWith('REC-', $receiptNumber);

        $this->assertDatabaseHas('bookings', ['booking_code' => $bookingCode, 'status' => 'confirmed', 'expires_at' => null]);
        // El estado operativo de la habitación no cambia por una reserva futura.
        $this->assertDatabaseHas('rooms', ['id' => $this->room->id, 'status' => 'disponible']);
        $this->assertDatabaseHas('payments', ['status' => 'completed', 'receipt_number' => $receiptNumber]);

        // Solo se almacena marca + últimos 4 dígitos.
        $payment = Payment::where('receipt_number', $receiptNumber)->first();
        $this->assertSame('4242', $payment->payment_details['last4']);
        $this->assertStringNotContainsString('4242424242424242', json_encode($payment->payment_details));
    }

    public function test_paying_an_already_confirmed_booking_returns_409(): void
    {
        $bookingCode = $this->postJson('/api/payments/checkout-intent', $this->intentPayload())->json('booking_code');

        $this->postJson('/api/payments/process-mock', $this->cardPayload($bookingCode))->assertStatus(200);
        $this->postJson('/api/payments/process-mock', $this->cardPayload($bookingCode))->assertStatus(409);

        $this->assertSame(1, Payment::where('status', 'completed')->count());
    }

    public function test_invalid_card_data_is_rejected(): void
    {
        $bookingCode = $this->postJson('/api/payments/checkout-intent', $this->intentPayload())->json('booking_code');

        // Luhn inválido
        $this->postJson('/api/payments/process-mock', $this->cardPayload($bookingCode, '4242 4242 4242 4241'))
            ->assertStatus(422)->assertJsonValidationErrors('card_number');

        // Tarjeta vencida
        $payload = $this->cardPayload($bookingCode);
        $payload['card_expiry'] = now()->subMonths(2)->format('m/y');
        $this->postJson('/api/payments/process-mock', $payload)
            ->assertStatus(422)->assertJsonValidationErrors('card_expiry');

        $this->assertDatabaseHas('bookings', ['booking_code' => $bookingCode, 'status' => 'pending_payment']);
    }

    public function test_declined_card_marks_payment_failed_and_cancels_booking(): void
    {
        $bookingCode = $this->postJson('/api/payments/checkout-intent', $this->intentPayload([
            'check_in'  => now()->addDays(5)->toDateString(),
            'check_out' => now()->addDays(6)->toDateString(),
        ]))->json('booking_code');

        $this->postJson('/api/payments/process-mock', $this->cardPayload($bookingCode, '4000 0000 0000 0002'))
            ->assertStatus(422)
            ->assertJson(['success' => false, 'status' => 'failed']);

        $this->assertDatabaseHas('bookings', ['booking_code' => $bookingCode, 'status' => 'cancelled']);
        $this->assertDatabaseHas('payments', ['status' => 'failed']);
    }

    public function test_expired_pending_booking_cannot_be_paid_and_does_not_block_the_room(): void
    {
        $bookingCode = $this->postJson('/api/payments/checkout-intent', $this->intentPayload())->json('booking_code');
        Booking::where('booking_code', $bookingCode)->update(['expires_at' => now()->subMinute()]);

        // Otro huésped puede reservar las mismas fechas
        $this->postJson('/api/payments/checkout-intent', $this->intentPayload([
            'guest_email'     => 'otro@example.com',
            'document_number' => '11112222',
        ]))->assertStatus(201);

        // El pago de la reserva vencida se rechaza
        $this->postJson('/api/payments/process-mock', $this->cardPayload($bookingCode))->assertStatus(409);
        $this->assertDatabaseHas('bookings', ['booking_code' => $bookingCode, 'status' => 'expired']);
    }

    public function test_active_pending_booking_blocks_the_room(): void
    {
        $this->postJson('/api/payments/checkout-intent', $this->intentPayload())->assertStatus(201);

        $this->postJson('/api/payments/checkout-intent', $this->intentPayload([
            'guest_email'     => 'otro@example.com',
            'document_number' => '11112222',
        ]))->assertStatus(409);
    }

    public function test_public_checkout_never_modifies_an_existing_guest(): void
    {
        $guest = Guest::create([
            'name'            => 'Original',
            'surname'         => 'Titular',
            'document_type'   => 'DNI',
            'document_number' => '87654321',
            'email'           => 'titular@example.com',
            'phone'           => '+51900000000',
        ]);

        // Mismo documento con otro email -> 422 genérico, sin cambios
        $this->postJson('/api/payments/checkout-intent', $this->intentPayload([
            'guest_name'  => 'Atacante',
            'guest_email' => 'atacante@example.com',
        ]))->assertStatus(422);

        // Mismo documento y email (distinto uso de mayúsculas) -> se reutiliza sin modificar
        $this->postJson('/api/payments/checkout-intent', $this->intentPayload([
            'guest_name'  => 'Otro Nombre',
            'guest_email' => 'TITULAR@example.com',
        ]))->assertStatus(201);

        $guest->refresh();
        $this->assertSame('Original', $guest->name);
        $this->assertSame('titular@example.com', $guest->email);
        $this->assertSame('+51900000000', $guest->phone);
    }

    public function test_receipt_requires_matching_email_and_hides_sensitive_data(): void
    {
        $bookingCode = $this->postJson('/api/payments/checkout-intent', $this->intentPayload([
            'guest_email'     => 'roberto.diaz@example.com',
            'document_number' => '44332211',
        ]))->json('booking_code');

        $this->postJson('/api/payments/process-mock', $this->cardPayload($bookingCode, '5555 5555 5555 4444'))
            ->assertStatus(200);

        $this->getJson("/api/bookings/{$bookingCode}/receipt")->assertStatus(404);
        $this->getJson("/api/bookings/{$bookingCode}/receipt?email=otro@example.com")->assertStatus(404);

        $response = $this->getJson("/api/bookings/{$bookingCode}/receipt?email=ROBERTO.DIAZ@example.com");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'receipt' => [
                    'receipt_number',
                    'booking_code',
                    'transaction_id',
                    'gateway',
                    'hotel' => ['name', 'address', 'ruc', 'phone'],
                    'guest' => ['name', 'document_type', 'email', 'phone'],
                    'room'  => ['name', 'room_number', 'bed_type'],
                    'stay'  => ['check_in', 'check_out', 'nights', 'price_per_night'],
                    'payment' => ['method', 'brand', 'last4', 'amount', 'currency', 'status', 'paid_at'],
                    'tax' => ['rate', 'base', 'amount', 'total', 'prices_include_igv'],
                    'issued_at',
                ],
            ])
            ->assertJsonMissingPath('receipt.guest.document_number');

        $this->assertStringStartsWith('*', $response->json('receipt.guest.phone'));
        $this->assertStringEndsWith('321', $response->json('receipt.guest.phone'));
        $this->assertEquals(
            round((float) $response->json('receipt.payment.amount') / 1.18, 2),
            $response->json('receipt.tax.base')
        );
    }

    private function pendingBookingWithPayment(string $transactionId): array
    {
        $guest = Guest::create([
            'name'            => 'Luis',
            'surname'         => 'Vargas',
            'document_type'   => 'DNI',
            'document_number' => '55667788',
            'email'           => 'luis.vargas@example.com',
        ]);

        $booking = Booking::create([
            'guest_id'     => $guest->id,
            'room_id'      => $this->room->id,
            'check_in'     => now()->addDays(1)->toDateString(),
            'check_out'    => now()->addDays(2)->toDateString(),
            'total_amount' => 350.00,
            'status'       => 'pending_payment',
            'expires_at'   => now()->addMinutes(30),
        ]);

        $payment = Payment::create([
            'booking_id'       => $booking->id,
            'amount'           => 350.00,
            'payment_method'   => 'card',
            'status'           => 'pending',
            'transaction_id'   => $transactionId,
            'gateway_provider' => 'simulation',
            'currency'         => 'PEN',
        ]);

        return [$booking, $payment];
    }

    public function test_signed_webhook_payment_succeeded_confirms_booking(): void
    {
        [$booking, $payment] = $this->pendingBookingWithPayment('pi_test_123');

        $payload = [
            'type' => 'payment_intent.succeeded',
            'data' => [
                'id' => 'pi_test_123',
                'payment_method_details' => ['card' => ['brand' => 'visa', 'last4' => '4242']],
            ],
        ];

        $this->postSignedWebhook($payload)->assertStatus(200);

        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'confirmed']);
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'completed']);

        // Idempotente
        $this->postSignedWebhook($payload)->assertStatus(200);
        $this->assertSame(1, Payment::where('status', 'completed')->count());
    }

    public function test_webhook_without_or_with_invalid_signature_is_rejected(): void
    {
        [$booking] = $this->pendingBookingWithPayment('pi_test_456');

        $payload = ['type' => 'payment_intent.succeeded', 'data' => ['id' => 'pi_test_456']];

        $this->postJson('/api/webhooks/payment', $payload)->assertStatus(401);
        $this->postSignedWebhook($payload, hash_hmac('sha256', json_encode($payload), 'wrong-secret'))->assertStatus(401);

        // Sin secreto configurado se rechaza incluso una firma "válida" para cadena vacía
        config(['services.payment.webhook_secret' => null]);
        $this->postSignedWebhook($payload, hash_hmac('sha256', json_encode($payload), ''))->assertStatus(401);

        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'pending_payment']);
    }
}
