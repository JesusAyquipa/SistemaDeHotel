<?php

namespace Tests\Feature;

use App\Mail\BookingVerificationCodeMail;
use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\BookingVerification;
use App\Models\Room;
use App\Models\User;
use App\Services\BookingVerificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * SHE-026: verificación de correo (OTP) para reservas sin cuenta.
 */
class BookingVerificationTest extends TestCase
{
    use RefreshDatabase, IssuesVerificationTokens;

    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();

        $this->room = Room::create([
            'room_number' => '601', 'name' => 'Doble OTP', 'bed_type' => 'doble',
            'capacity' => 2, 'price_per_night' => 200, 'status' => 'disponible',
        ]);
    }

    /** Envía el código y lo recupera del correo encolado. */
    private function sendAndCapture(string $email): string
    {
        $this->postJson('/api/booking-verification/send', ['email' => $email])->assertOk();

        $code = null;
        Mail::assertQueued(BookingVerificationCodeMail::class, function (BookingVerificationCodeMail $mail) use (&$code, $email) {
            if ($mail->hasTo(mb_strtolower($email))) {
                $code = $mail->code;
            }

            return true;
        });

        return $code;
    }

    private function intentPayload(array $overrides = []): array
    {
        return array_merge([
            'room_id'         => $this->room->id,
            'check_in'        => now()->addDays(1)->toDateString(),
            'check_out'       => now()->addDays(3)->toDateString(),
            'guest_name'      => 'Lucía',
            'guest_surname'   => 'Paredes',
            'guest_email'     => 'lucia@example.com',
            'document_type'   => 'DNI',
            'document_number' => '70112233',
        ], $overrides);
    }

    // ------------------------------------------------------------ send

    public function test_send_always_returns_the_same_message_and_queues_the_mail(): void
    {
        $this->postJson('/api/booking-verification/send', ['email' => 'lucia@example.com'])
            ->assertOk()
            ->assertExactJson(['message' => 'Si el correo es válido, enviamos un código']);

        Mail::assertQueued(BookingVerificationCodeMail::class, 1);
        $this->assertSame(1, BookingVerification::count());

        // Correo malformado: misma respuesta, sin correo ni registro
        $this->postJson('/api/booking-verification/send', ['email' => 'no-es-correo'])
            ->assertOk()
            ->assertExactJson(['message' => 'Si el correo es válido, enviamos un código']);
        $this->postJson('/api/booking-verification/send', [])->assertOk();
        Mail::assertQueued(BookingVerificationCodeMail::class, 1);
    }

    public function test_mailable_is_queued_after_commit(): void
    {
        $mail = new BookingVerificationCodeMail('123456');

        $this->assertInstanceOf(ShouldQueue::class, $mail);
        $this->assertTrue($mail->afterCommit);
    }

    public function test_code_is_stored_hashed_and_never_logged(): void
    {
        $code = $this->sendAndCapture('lucia@example.com');

        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
        $record = BookingVerification::first();
        $this->assertNotSame($code, $record->code_hash);
        $this->assertSame(BookingVerificationService::hashCode('lucia@example.com', $code), $record->code_hash);
        $this->assertTrue($record->code_expires_at->between(now()->addMinutes(9), now()->addMinutes(10)->addSecond()));

        $this->postJson('/api/booking-verification/verify', ['email' => 'lucia@example.com', 'code' => $code])->assertOk();
        $logs = ActivityLog::whereIn('action', ['verification_sent', 'verification_succeeded', 'verification_failed'])->get();
        $this->assertCount(2, $logs);
        $this->assertStringNotContainsString($code, $logs->toJson());
        $this->assertStringNotContainsString('lucia@example.com', $logs->toJson());
    }

    public function test_send_is_throttled_to_three_per_ten_minutes_per_email_and_ip(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/booking-verification/send', ['email' => 'lucia@example.com'])->assertOk();
        }
        $this->postJson('/api/booking-verification/send', ['email' => 'lucia@example.com'])->assertStatus(429);

        // Otro correo desde la misma IP no está limitado
        $this->postJson('/api/booking-verification/send', ['email' => 'otra@example.com'])->assertOk();
        Mail::assertQueued(BookingVerificationCodeMail::class, 4);
    }

    public function test_resend_does_not_delete_a_verified_unconsumed_token(): void
    {
        $token = $this->verificationTokenFor('lucia@example.com');
        $verified = BookingVerification::where('email', 'lucia@example.com')->firstOrFail();

        $this->postJson('/api/booking-verification/send', ['email' => 'lucia@example.com'])->assertOk();

        $this->assertNotNull(BookingVerification::find($verified->id));
        $this->assertSame(2, BookingVerification::where('email', 'lucia@example.com')->count());
        $this->assertNotNull(BookingVerification::where('token_hash', BookingVerificationService::hashToken($token))->first());
    }

    public function test_resend_invalidates_the_previous_code(): void
    {
        $first = $this->sendAndCapture('lucia@example.com');
        Mail::fake(); // reinicia la captura
        $second = $this->sendAndCapture('lucia@example.com');

        $this->assertSame(1, BookingVerification::where('email', 'lucia@example.com')->count());
        if ($first !== $second) {
            $this->postJson('/api/booking-verification/verify', ['email' => 'lucia@example.com', 'code' => $first])
                ->assertStatus(422);
        }
        $this->postJson('/api/booking-verification/verify', ['email' => 'lucia@example.com', 'code' => $second])->assertOk();
    }

    // ------------------------------------------------------------ verify

    public function test_verify_with_correct_code_returns_a_token_stored_hashed(): void
    {
        $code = $this->sendAndCapture('Lucia@Example.com');

        $response = $this->postJson('/api/booking-verification/verify', ['email' => 'lucia@example.com', 'code' => $code])
            ->assertOk()
            ->assertJsonStructure(['verification_token', 'expires_at']);

        $token = $response->json('verification_token');
        $this->assertSame(64, strlen($token));

        $record = BookingVerification::first();
        $this->assertNull($record->code_hash);
        $this->assertSame(hash('sha256', $token), $record->token_hash);
        $this->assertNotSame($token, $record->token_hash);
        $this->assertTrue($record->token_expires_at->between(now()->addMinutes(29), now()->addMinutes(30)->addSecond()));
    }

    public function test_verify_rejects_wrong_expired_and_malformed_codes(): void
    {
        $code = $this->sendAndCapture('lucia@example.com');
        $wrong = $code === '000000' ? '111111' : '000000';

        $this->postJson('/api/booking-verification/verify', ['email' => 'lucia@example.com', 'code' => $wrong])
            ->assertStatus(422)->assertJsonPath('message', 'Código inválido o vencido');
        $this->postJson('/api/booking-verification/verify', ['email' => 'lucia@example.com', 'code' => '12ab'])
            ->assertStatus(422)->assertJsonPath('message', 'Código inválido o vencido');
        $this->postJson('/api/booking-verification/verify', ['email' => 'nadie@example.com', 'code' => $code])
            ->assertStatus(422)->assertJsonPath('message', 'Código inválido o vencido');

        $this->travel(11)->minutes();
        $this->postJson('/api/booking-verification/verify', ['email' => 'lucia@example.com', 'code' => $code])
            ->assertStatus(422)->assertJsonPath('message', 'Código inválido o vencido');
    }

    public function test_code_is_locked_after_five_failed_attempts_even_with_the_right_code(): void
    {
        $code = $this->sendAndCapture('lucia@example.com');
        $wrong = $code === '000000' ? '111111' : '000000';

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/booking-verification/verify', ['email' => 'lucia@example.com', 'code' => $wrong])
                ->assertStatus(422);
        }

        $this->postJson('/api/booking-verification/verify', ['email' => 'lucia@example.com', 'code' => $code])
            ->assertStatus(422)->assertJsonPath('message', 'Código inválido o vencido');
        $this->assertSame(5, BookingVerification::first()->attempts);
    }

    public function test_code_cannot_be_reused_after_success(): void
    {
        $code = $this->sendAndCapture('lucia@example.com');

        $this->postJson('/api/booking-verification/verify', ['email' => 'lucia@example.com', 'code' => $code])->assertOk();
        $this->postJson('/api/booking-verification/verify', ['email' => 'lucia@example.com', 'code' => $code])->assertStatus(422);
    }

    public function test_verify_is_throttled(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/booking-verification/verify', ['email' => 'lucia@example.com', 'code' => '000000']);
        }
        $this->postJson('/api/booking-verification/verify', ['email' => 'lucia@example.com', 'code' => '000000'])
            ->assertStatus(429);
    }

    // ------------------------------------------------------------ checkout-intent

    public function test_guest_checkout_without_token_requires_verification(): void
    {
        $this->postJson('/api/payments/checkout-intent', $this->intentPayload())
            ->assertStatus(422)
            ->assertJsonPath('message', 'Verifica tu correo para continuar')
            ->assertJsonPath('requires_verification', true);

        $this->assertSame(0, Booking::count());
    }

    public function test_guest_checkout_with_valid_token_creates_booking_and_consumes_the_token(): void
    {
        $code = $this->sendAndCapture('lucia@example.com');
        $token = $this->postJson('/api/booking-verification/verify', ['email' => 'LUCIA@example.com', 'code' => $code])
            ->json('verification_token');

        // El correo del huésped se compara sin distinguir mayúsculas
        $this->postJson('/api/payments/checkout-intent', $this->intentPayload([
            'guest_email' => 'Lucia@Example.com', 'verification_token' => $token,
        ]))->assertStatus(201);
        $this->assertSame(1, Booking::count());
        $this->assertNotNull(BookingVerification::first()->consumed_at);

        // Un solo uso
        $this->postJson('/api/payments/checkout-intent', $this->intentPayload([
            'check_in' => now()->addDays(10)->toDateString(), 'check_out' => now()->addDays(12)->toDateString(),
            'verification_token' => $token,
        ]))->assertStatus(422)->assertJsonPath('requires_verification', true);
        $this->assertSame(1, Booking::count());
    }

    public function test_token_for_another_email_is_rejected(): void
    {
        $token = $this->verificationTokenFor('otra@example.com');

        $this->postJson('/api/payments/checkout-intent', $this->intentPayload(['verification_token' => $token]))
            ->assertStatus(422)
            ->assertJsonPath('requires_verification', true);
        $this->assertSame(0, Booking::count());
        $this->assertNull(BookingVerification::first()->consumed_at);
    }

    public function test_expired_or_invented_token_is_rejected(): void
    {
        $expired = $this->verificationTokenFor('lucia@example.com');
        $this->travel(31)->minutes();

        $this->postJson('/api/payments/checkout-intent', $this->intentPayload(['verification_token' => $expired]))
            ->assertStatus(422)->assertJsonPath('requires_verification', true);
        $this->postJson('/api/payments/checkout-intent', $this->intentPayload(['verification_token' => str_repeat('a', 64)]))
            ->assertStatus(422)->assertJsonPath('requires_verification', true);
        $this->assertSame(0, Booking::count());
    }

    public function test_failed_booking_does_not_consume_the_token(): void
    {
        $token = $this->verificationTokenFor('lucia@example.com');

        // Fechas inválidas: la validación falla antes de crear la reserva
        $this->postJson('/api/payments/checkout-intent', $this->intentPayload([
            'check_out' => now()->toDateString(), 'verification_token' => $token,
        ]))->assertStatus(422);

        $this->assertNull(BookingVerification::first()->consumed_at);
        $this->postJson('/api/payments/checkout-intent', $this->intentPayload(['verification_token' => $token]))
            ->assertStatus(201);
    }

    public function test_authenticated_user_skips_verification(): void
    {
        Role::findOrCreate('cliente', 'web');
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('cliente');
        Sanctum::actingAs($user);

        $this->postJson('/api/payments/checkout-intent', $this->intentPayload())->assertStatus(201);
        $this->assertSame(1, Booking::count());
    }
}
