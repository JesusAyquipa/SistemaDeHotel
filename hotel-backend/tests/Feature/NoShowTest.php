<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Coupon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NoShowTest extends TestCase
{
    use RefreshDatabase, BillingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpBilling();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_receptionist_marks_no_show_applies_penalty_and_releases_coupon(): void
    {
        $coupon = Coupon::create([
            'code' => 'NOSHOW10', 'discount_type' => 'percentage', 'discount_value' => 10,
            'expires_at' => now()->addMonth()->toDateString(), 'max_uses' => 5, 'current_uses' => 1, 'is_active' => true,
        ]);
        $booking = $this->makeBooking([
            'check_in'       => now()->toDateString(),
            'check_out'      => now()->addDays(2)->toDateString(),
            'coupon_id'      => $coupon->id,
            'coupon_counted' => true,
        ]);
        Sanctum::actingAs($this->receptionist);

        $this->postJson("/api/staff/bookings/{$booking->booking_code}/no-show")
            ->assertOk()
            ->assertJsonPath('booking.status', 'no_show')
            ->assertJsonPath('penalty_amount', 200)
            ->assertJsonPath('refund_amount', 200);

        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'no_show']);
        $this->assertDatabaseHas('payments', ['booking_id' => $booking->id, 'status' => 'refund_pending', 'amount' => -200.00]);
        $this->assertEquals(0, $coupon->fresh()->current_uses);
        $this->assertDatabaseHas('activity_logs', ['action' => 'no_show', 'subject_id' => $booking->id]);

        // no_show ya no bloquea la habitación
        $this->assertFalse(Booking::blocking()->whereKey($booking->id)->exists());
    }

    public function test_cannot_mark_future_or_non_confirmed_booking(): void
    {
        $future = $this->makeBooking();
        $checkedIn = $this->makeBooking([
            'check_in'  => now()->subDay()->toDateString(),
            'check_out' => now()->addDay()->toDateString(),
            'status'    => Booking::STATUS_CHECKED_IN,
        ]);
        Sanctum::actingAs($this->receptionist);

        $this->postJson("/api/staff/bookings/{$future->booking_code}/no-show")->assertStatus(422);
        $this->postJson("/api/staff/bookings/{$checkedIn->booking_code}/no-show")->assertStatus(422);
        $this->postJson('/api/staff/bookings/NOPE-0000/no-show')->assertStatus(404);
    }

    public function test_client_cannot_mark_no_show(): void
    {
        $booking = $this->makeBooking(['check_in' => now()->toDateString(), 'check_out' => now()->addDay()->toDateString()]);
        Sanctum::actingAs($this->client);

        $this->postJson("/api/staff/bookings/{$booking->booking_code}/no-show")->assertStatus(403);
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'confirmed']);
    }

    public function test_command_marks_only_overdue_confirmed_bookings(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-20 15:00:00'));

        // check-in 19/10: plazo 20/10 12:00 + 2 h = 14:00 → vencido
        $overdue = $this->makeBooking(['check_in' => '2026-10-19', 'check_out' => '2026-10-21']);
        // check-in hoy: aún en plazo
        $today = $this->makeBooking(['check_in' => '2026-10-20', 'check_out' => '2026-10-22']);
        // ya hizo check-in
        $inHouse = $this->makeBooking(['check_in' => '2026-10-18', 'check_out' => '2026-10-21', 'status' => Booking::STATUS_CHECKED_IN]);

        $this->artisan('app:mark-no-shows')->assertSuccessful();

        $this->assertEquals('no_show', $overdue->fresh()->status);
        $this->assertEquals('confirmed', $today->fresh()->status);
        $this->assertEquals('checked_in', $inHouse->fresh()->status);
    }

    public function test_command_respects_grace_hours(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-20 13:00:00'));
        $booking = $this->makeBooking(['check_in' => '2026-10-19', 'check_out' => '2026-10-21']);

        // 13:00 < 12:00 + 2 h de gracia → todavía no
        $this->artisan('app:mark-no-shows')->assertSuccessful();
        $this->assertEquals('confirmed', $booking->fresh()->status);

        Carbon::setTestNow(Carbon::parse('2026-10-20 14:30:00'));
        $this->artisan('app:mark-no-shows')->assertSuccessful();
        $this->assertEquals('no_show', $booking->fresh()->status);
    }
}
