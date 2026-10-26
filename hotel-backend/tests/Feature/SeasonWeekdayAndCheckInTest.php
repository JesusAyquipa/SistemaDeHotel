<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Season;
use App\Services\BookingPricingService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * SHE-017 (check-in con habitación en limpieza) y SHE-018 (temporadas por día de la semana).
 */
class SeasonWeekdayAndCheckInTest extends TestCase
{
    use RefreshDatabase, BillingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpBilling();
    }

    // ------------------------------------------------------------ SHE-017

    private function todayBooking(): Booking
    {
        return $this->makeBooking([
            'check_in'  => now()->toDateString(),
            'check_out' => now()->addDays(2)->toDateString(),
        ]);
    }

    public function test_check_in_is_blocked_while_room_is_in_cleaning(): void
    {
        $booking = $this->todayBooking();
        $this->room->update(['status' => 'limpieza']);
        Sanctum::actingAs($this->receptionist);

        $this->postJson("/api/staff/bookings/{$booking->booking_code}/check-in")
            ->assertStatus(422)
            ->assertJsonPath('message', 'La habitación está en limpieza. Márquela como disponible antes del check-in.');

        $this->assertSame('confirmed', $booking->fresh()->status);
        $this->assertDatabaseHas('rooms', ['id' => $this->room->id, 'status' => 'limpieza']);
    }

    public function test_check_in_works_once_room_is_available_and_maintenance_is_still_blocked(): void
    {
        $booking = $this->todayBooking();
        Sanctum::actingAs($this->receptionist);

        $this->room->update(['status' => 'mantenimiento']);
        $this->postJson("/api/staff/bookings/{$booking->booking_code}/check-in")
            ->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'mantenimiento'));

        $this->room->update(['status' => 'disponible']);
        $this->postJson("/api/staff/bookings/{$booking->booking_code}/check-in")->assertOk();
        $this->assertDatabaseHas('rooms', ['id' => $this->room->id, 'status' => 'ocupada']);
    }

    // ------------------------------------------------------------ SHE-018

    private function seasonPayload(array $overrides = []): array
    {
        return array_merge([
            'name'            => 'Fin de semana',
            'start_date'      => now()->addDays(1)->toDateString(),
            'end_date'        => now()->addDays(60)->toDateString(),
            'rate_adjustment' => 50,
        ], $overrides);
    }

    public function test_admin_can_create_season_with_days_of_week_and_it_is_normalized(): void
    {
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/settings/seasons', $this->seasonPayload(['days_of_week' => [6, 0, 6 - 6]]))
            ->assertStatus(422); // 0 duplicado

        $this->postJson('/api/settings/seasons', $this->seasonPayload(['days_of_week' => [6, 0]]))
            ->assertStatus(201)
            ->assertJsonPath('days_of_week', [0, 6]);

        $this->assertSame([0, 6], Season::first()->days_of_week);
    }

    public function test_season_without_days_or_with_empty_list_applies_every_day(): void
    {
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/settings/seasons', $this->seasonPayload())->assertStatus(201)->assertJsonPath('days_of_week', null);
        $this->postJson('/api/settings/seasons', $this->seasonPayload(['name' => 'Vacía', 'days_of_week' => []]))
            ->assertStatus(201)->assertJsonPath('days_of_week', null);
    }

    public function test_days_of_week_validation(): void
    {
        Sanctum::actingAs($this->admin);

        foreach ([[7], [-1], ['x'], [1.5], [1, 1], 'lunes', [0, 1, 2, 3, 4, 5, 6, 0]] as $bad) {
            $this->postJson('/api/settings/seasons', $this->seasonPayload(['days_of_week' => $bad]))
                ->assertStatus(422);
        }
        $this->assertSame(0, Season::count());
    }

    public function test_admin_can_update_days_of_week_and_clear_them(): void
    {
        $season = Season::create($this->seasonPayload(['days_of_week' => [1, 2]]));
        Sanctum::actingAs($this->admin);

        $this->putJson("/api/settings/seasons/{$season->id}", ['days_of_week' => [5, 6, 0]])
            ->assertOk()->assertJsonPath('days_of_week', [0, 5, 6]);
        $this->putJson("/api/settings/seasons/{$season->id}", ['days_of_week' => [9]])->assertStatus(422);
        $this->assertSame([0, 5, 6], $season->fresh()->days_of_week);

        // Sin enviar el campo no se toca; con null se limpia
        $this->putJson("/api/settings/seasons/{$season->id}", ['name' => 'Renombrada'])->assertOk();
        $this->assertSame([0, 5, 6], $season->fresh()->days_of_week);
        $this->putJson("/api/settings/seasons/{$season->id}", ['days_of_week' => null])
            ->assertOk()->assertJsonPath('days_of_week', null);
    }

    public function test_only_admin_can_set_days_of_week_and_settings_returns_them(): void
    {
        Sanctum::actingAs($this->receptionist);
        $this->postJson('/api/settings/seasons', $this->seasonPayload(['days_of_week' => [0]]))->assertStatus(403);

        Season::create($this->seasonPayload(['days_of_week' => [0, 6]]));
        $this->getJson('/api/settings')
            ->assertOk()
            ->assertJsonPath('seasons.0.days_of_week', [0, 6]);
    }

    public function test_quote_applies_weekend_season_only_to_weekend_nights(): void
    {
        $friday = Carbon::parse('next friday')->startOfDay();
        if ($friday->lt(now()->addDay()->startOfDay())) {
            $friday->addWeek();
        }
        Season::create($this->seasonPayload([
            'start_date'   => $friday->copy()->subDay()->toDateString(),
            'end_date'     => $friday->copy()->addDays(5)->toDateString(),
            'days_of_week' => [6, 0], // sábado y domingo
        ]));

        // Viernes, sábado, domingo, lunes (4 noches) a S/ 200
        $quote = app(BookingPricingService::class)->quote($this->room, $friday, $friday->copy()->addDays(4));

        $this->assertEquals([200.0, 300.0, 300.0, 200.0], array_column($quote['nightly'], 'price'));
        $this->assertNull($quote['nightly'][0]['season']);
        $this->assertSame('Fin de semana', $quote['nightly'][1]['season']);
        $this->assertEquals(1000.0, $quote['total']);
    }
}
