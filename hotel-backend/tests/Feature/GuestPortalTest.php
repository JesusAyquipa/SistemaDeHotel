<?php

namespace Tests\Feature;

use App\Mail\CheckInReminderMail;
use App\Models\Booking;
use App\Models\BookingPrecheck;
use App\Models\Charge;
use App\Models\Guest;
use App\Models\Payment;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * SHE-036: portal del cliente (folio) y pre check-in online.
 */
class GuestPortalTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;
    private User $owner;
    private User $other;
    private User $receptionist;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['admin', 'recepcionista', 'cliente'] as $role) {
            Role::create(['name' => $role, 'guard_name' => 'web']);
        }

        $this->owner = User::factory()->create(['email' => 'owner@example.com', 'is_active' => true]);
        $this->owner->assignRole('cliente');
        $this->other = User::factory()->create(['email' => 'other@example.com', 'is_active' => true]);
        $this->other->assignRole('cliente');
        $this->receptionist = User::factory()->create(['is_active' => true]);
        $this->receptionist->assignRole('recepcionista');

        $this->room = Room::create([
            'room_number'     => '401',
            'name'            => 'Doble Portal',
            'bed_type'        => 'doble',
            'capacity'        => 2,
            'price_per_night' => 300.00,
            'status'          => 'disponible',
        ]);
    }

    private function booking(array $overrides = []): Booking
    {
        $guest = Guest::firstOrCreate(['document_number' => '12345678'], [
            'name'          => 'Ana',
            'surname'       => 'Duena',
            'document_type' => 'DNI',
            'email'         => 'owner@example.com',
            'user_id'       => $this->owner->id,
        ]);

        return Booking::create(array_merge([
            'guest_id'     => $guest->id,
            'room_id'      => $this->room->id,
            'check_in'     => now()->addDays(3)->toDateString(),
            'check_out'    => now()->addDays(5)->toDateString(),
            'total_amount' => 600.00,
            'status'       => Booking::STATUS_CONFIRMED,
        ], $overrides));
    }

    private function precheckPayload(array $overrides = []): array
    {
        return array_merge([
            'arrival_time'     => '14:30',
            'document_type'    => 'DNI',
            'document_number'  => '12345678',
            'nationality'      => 'Peruana',
            'address'          => 'Av. Siempre Viva 123',
            'companions'       => [
                ['name' => 'Luis', 'surname' => 'Pérez', 'document_type' => 'DNI', 'document_number' => '87654321'],
            ],
            'special_requests' => 'Cama extra si es posible.',
        ], $overrides);
    }

    // --------------------------------------------------------------- folio

    public function test_owner_sees_folio_with_charges_payments_and_refunds(): void
    {
        $booking = $this->booking();
        Charge::create(['booking_id' => $booking->id, 'date' => now()->toDateString(), 'concept' => 'Agua', 'quantity' => 2, 'unit_price' => 5, 'total' => 10]);
        Payment::create(['booking_id' => $booking->id, 'amount' => 600, 'payment_method' => 'card', 'status' => 'completed', 'currency' => 'PEN', 'paid_at' => now(), 'payment_details' => ['brand' => 'visa', 'last4' => '4242']]);
        Payment::create(['booking_id' => $booking->id, 'amount' => -50, 'payment_method' => 'card', 'status' => 'refund_pending', 'currency' => 'PEN']);

        Sanctum::actingAs($this->owner);
        $res = $this->getJson("/api/bookings/{$booking->booking_code}/folio")->assertOk();

        $res->assertJsonPath('booking.booking_code', $booking->booking_code)
            ->assertJsonCount(1, 'charges')
            ->assertJsonCount(1, 'payments')
            ->assertJsonCount(1, 'refunds')
            ->assertJsonPath('payments.0.last4', '4242')
            ->assertJsonPath('refunds.0.amount', 50)
            ->assertJsonPath('totals.total', 610)
            ->assertJsonPath('totals.pagado', 600);
    }

    public function test_other_client_gets_404_on_folio(): void
    {
        $booking = $this->booking();
        Sanctum::actingAs($this->other);

        $this->getJson("/api/bookings/{$booking->booking_code}/folio")->assertNotFound();
    }

    public function test_staff_can_view_folio(): void
    {
        $booking = $this->booking();

        Sanctum::actingAs($this->receptionist);
        $this->getJson("/api/bookings/{$booking->booking_code}/folio")->assertOk();
    }

    public function test_guest_without_token_gets_401_on_folio(): void
    {
        $booking = $this->booking();

        $this->getJson("/api/bookings/{$booking->booking_code}/folio")->assertUnauthorized();
    }

    // -------------------------------------------------------- pre check-in

    public function test_owner_can_submit_and_update_pre_check_in(): void
    {
        $booking = $this->booking();
        Sanctum::actingAs($this->owner);

        $this->postJson("/api/bookings/{$booking->booking_code}/pre-check-in", $this->precheckPayload())
            ->assertStatus(201)
            ->assertJsonPath('pre_check_in.arrival_time', '14:30')
            ->assertJsonPath('pre_check_in.companions.0.name', 'Luis');

        $this->postJson("/api/bookings/{$booking->booking_code}/pre-check-in", $this->precheckPayload([
            'arrival_time' => '18:00',
            'companions'   => [],
        ]))->assertOk()->assertJsonPath('pre_check_in.arrival_time', '18:00');

        $this->assertSame(1, BookingPrecheck::where('booking_id', $booking->id)->count());
        $this->assertSame([], BookingPrecheck::first()->companions);

        $this->getJson("/api/bookings/{$booking->booking_code}/pre-check-in")
            ->assertOk()
            ->assertJsonPath('pre_check_in.arrival_time', '18:00')
            ->assertJsonPath('window.open', true)
            ->assertJsonPath('prefill.document_number', '12345678');
    }

    public function test_pre_check_in_allowed_on_check_in_day(): void
    {
        $booking = $this->booking(['check_in' => now()->toDateString(), 'check_out' => now()->addDays(2)->toDateString()]);
        Sanctum::actingAs($this->owner);

        $this->postJson("/api/bookings/{$booking->booking_code}/pre-check-in", $this->precheckPayload())->assertStatus(201);
    }

    public function test_pre_check_in_rejected_outside_window(): void
    {
        $booking = $this->booking(['check_in' => now()->addDays(8)->toDateString(), 'check_out' => now()->addDays(10)->toDateString()]);
        Sanctum::actingAs($this->owner);

        $this->postJson("/api/bookings/{$booking->booking_code}/pre-check-in", $this->precheckPayload())->assertStatus(422);
        $this->assertDatabaseCount('booking_prechecks', 0);
    }

    public function test_pre_check_in_rejected_when_not_confirmed(): void
    {
        $pending = $this->booking(['status' => Booking::STATUS_PENDING_PAYMENT, 'expires_at' => now()->addMinutes(20)]);
        $checkedIn = $this->booking(['status' => Booking::STATUS_CHECKED_IN, 'check_in' => now()->toDateString()]);
        Sanctum::actingAs($this->owner);

        $this->postJson("/api/bookings/{$pending->booking_code}/pre-check-in", $this->precheckPayload())->assertStatus(422);
        $this->postJson("/api/bookings/{$checkedIn->booking_code}/pre-check-in", $this->precheckPayload())->assertStatus(422);
    }

    public function test_pre_check_in_is_owner_only(): void
    {
        $booking = $this->booking();

        Sanctum::actingAs($this->other);
        $this->postJson("/api/bookings/{$booking->booking_code}/pre-check-in", $this->precheckPayload())->assertNotFound();

        Sanctum::actingAs($this->receptionist);
        $this->postJson("/api/bookings/{$booking->booking_code}/pre-check-in", $this->precheckPayload())->assertNotFound();

        $this->assertDatabaseCount('booking_prechecks', 0);
    }

    public function test_pre_check_in_validates_companions_and_capacity(): void
    {
        $booking = $this->booking();
        Sanctum::actingAs($this->owner);

        $this->postJson("/api/bookings/{$booking->booking_code}/pre-check-in", $this->precheckPayload([
            'companions' => [['name' => 'L1s', 'surname' => '', 'document_type' => 'DNI', 'document_number' => '']],
        ]))->assertStatus(422)->assertJsonValidationErrors(['companions.0.name', 'companions.0.surname', 'companions.0.document_number']);

        $companion = ['name' => 'Luis', 'surname' => 'Pérez', 'document_type' => 'DNI', 'document_number' => '87654321'];
        $this->postJson("/api/bookings/{$booking->booking_code}/pre-check-in", $this->precheckPayload([
            'companions' => [$companion, $companion],
        ]))->assertStatus(422)->assertJsonValidationErrors(['companions']);

        $this->postJson("/api/bookings/{$booking->booking_code}/pre-check-in", $this->precheckPayload([
            'document_number' => '123',
            'arrival_time'    => '25:99',
        ]))->assertStatus(422)->assertJsonValidationErrors(['document_number', 'arrival_time']);
    }

    public function test_staff_booking_payload_includes_pre_check_in(): void
    {
        $booking = $this->booking();
        BookingPrecheck::create([
            'booking_id'      => $booking->id,
            'arrival_time'    => '15:00',
            'document_type'   => 'DNI',
            'document_number' => '12345678',
            'companions'      => [],
            'submitted_at'    => now(),
        ]);
        $plain = $this->booking(['check_in' => now()->addDays(20)->toDateString(), 'check_out' => now()->addDays(21)->toDateString()]);

        Sanctum::actingAs($this->receptionist);
        $list = $this->getJson('/api/staff/bookings')->assertOk()->json('bookings');
        $byCode = collect($list)->keyBy('booking_code');
        $this->assertSame('15:00', $byCode[$booking->booking_code]['pre_check_in']['arrival_time']);
        $this->assertArrayHasKey('pre_check_in', $byCode[$plain->booking_code]);
        $this->assertNull($byCode[$plain->booking_code]['pre_check_in']);

        $this->getJson("/api/bookings/{$booking->booking_code}")
            ->assertOk()
            ->assertJsonPath('booking.pre_check_in.arrival_time', '15:00');
    }

    public function test_checkin_reminder_mail_links_to_pre_check_in(): void
    {
        Mail::fake();
        $booking = $this->booking(['check_in' => now()->addDay()->toDateString(), 'check_out' => now()->addDays(3)->toDateString()]);

        $this->artisan('app:send-checkin-reminders')->assertExitCode(0);

        $assert = is_subclass_of(CheckInReminderMail::class, \Illuminate\Contracts\Queue\ShouldQueue::class) ? 'assertQueued' : 'assertSent';
        Mail::$assert(CheckInReminderMail::class, function (CheckInReminderMail $mail) use ($booking) {
            return str_contains($mail->preCheckInUrl, '/cliente/mis-reservas/' . $booking->booking_code)
                && str_contains($mail->render(), 'pre check-in');
        });
    }
}
