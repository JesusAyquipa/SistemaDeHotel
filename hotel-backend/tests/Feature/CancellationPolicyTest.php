<?php

namespace Tests\Feature;

use App\Services\CancellationPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CancellationPolicyTest extends TestCase
{
    use RefreshDatabase, BillingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpBilling();
    }

    private function policy(array $overrides = []): array
    {
        return array_merge(CancellationPolicy::DEFAULTS, $overrides);
    }

    public function test_public_can_read_default_policy(): void
    {
        $this->getJson('/api/settings/cancellation-policy')
            ->assertOk()
            ->assertExactJson(CancellationPolicy::DEFAULTS);
    }

    public function test_admin_updates_policy_others_cannot(): void
    {
        $new = $this->policy(['free_cancellation_hours' => 72, 'late_cancellation_penalty_nights' => 2, 'no_show_grace_hours' => 4]);

        $this->putJson('/api/settings/cancellation-policy', $new)->assertStatus(401);

        Sanctum::actingAs($this->receptionist);
        $this->putJson('/api/settings/cancellation-policy', $new)->assertStatus(403);

        Sanctum::actingAs($this->admin);
        $this->putJson('/api/settings/cancellation-policy', $this->policy(['free_cancellation_hours' => -1]))
            ->assertStatus(422)->assertJsonValidationErrors('free_cancellation_hours');
        $this->putJson('/api/settings/cancellation-policy', $new)->assertOk()->assertExactJson($new);

        $this->getJson('/api/settings/cancellation-policy')->assertExactJson($new);
        $this->assertDatabaseHas('activity_logs', ['action' => 'policy_updated']);
    }

    public function test_cancellation_outside_window_refunds_everything(): void
    {
        $booking = $this->makeBooking(); // 10 días antes, 2 noches x 200
        Sanctum::actingAs($this->client);

        $this->postJson("/api/bookings/{$booking->booking_code}/cancel")
            ->assertOk()
            ->assertJsonPath('refund_percentage', 100)
            ->assertJsonPath('refund_amount', 400);
    }

    public function test_late_cancellation_retains_penalty_nights(): void
    {
        $booking = $this->makeBooking([
            'check_in'  => now()->addDay()->toDateString(),
            'check_out' => now()->addDays(3)->toDateString(),
        ]);
        Sanctum::actingAs($this->client);

        // < 48 h: se retiene 1 noche (200) de 400 pagados
        $this->postJson("/api/bookings/{$booking->booking_code}/cancel")
            ->assertOk()
            ->assertJsonPath('refund_percentage', 50)
            ->assertJsonPath('refund_amount', 200);
        $this->assertDatabaseHas('payments', ['booking_id' => $booking->id, 'status' => 'refund_pending', 'amount' => -200.00]);
    }

    public function test_configured_values_change_refund_amounts(): void
    {
        Sanctum::actingAs($this->admin);
        $this->putJson('/api/settings/cancellation-policy', $this->policy(['late_cancellation_penalty_nights' => 2]))->assertOk();

        $late = $this->makeBooking([
            'check_in'  => now()->addDay()->toDateString(),
            'check_out' => now()->addDays(3)->toDateString(),
        ]);
        Sanctum::actingAs($this->client);
        $this->postJson("/api/bookings/{$late->booking_code}/cancel")
            ->assertOk()
            ->assertJsonPath('refund_amount', 0);
        $this->assertDatabaseMissing('payments', ['booking_id' => $late->id, 'status' => 'refund_pending']);

        // Ventana gratuita de 0 h: cancelar un día antes devuelve todo
        Sanctum::actingAs($this->admin);
        $this->putJson('/api/settings/cancellation-policy', $this->policy(['free_cancellation_hours' => 0]))->assertOk();
        $free = $this->makeBooking([
            'check_in'  => now()->addDays(2)->toDateString(),
            'check_out' => now()->addDays(4)->toDateString(),
        ]);
        Sanctum::actingAs($this->client);
        $this->postJson("/api/bookings/{$free->booking_code}/cancel")
            ->assertOk()
            ->assertJsonPath('refund_percentage', 100)
            ->assertJsonPath('refund_amount', 400);
    }

    public function test_same_day_cancellation_applies_no_show_penalty(): void
    {
        $booking = $this->makeBooking([
            'check_in'  => now()->toDateString(),
            'check_out' => now()->addDays(2)->toDateString(),
        ]);
        Sanctum::actingAs($this->client);

        $this->postJson("/api/bookings/{$booking->booking_code}/cancel")
            ->assertOk()
            ->assertJsonPath('refund_amount', 200);
    }
}
