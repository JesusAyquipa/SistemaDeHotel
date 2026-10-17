<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Charge;
use App\Models\Guest;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Room;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * SHE-020: estadísticas agregadas para gráficos.
 */
class ReportStatsTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/staff/reports/stats?start_date=2026-10-01&end_date=2026-10-10';

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['admin', 'recepcionista', 'cliente'] as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function actingAsRole(string $role): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);
        Sanctum::actingAs($user);
    }

    /** Ejecuta $fn con "ahora" fijado en $datetime (para controlar created_at). */
    private function at(string $datetime, callable $fn)
    {
        Carbon::setTestNow(Carbon::parse($datetime));
        $result = $fn();
        Carbon::setTestNow(Carbon::parse('2026-10-17 12:00:00'));

        return $result;
    }

    private function seedFixture(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-17 12:00:00'));

        $room1 = Room::create(['room_number' => '101', 'name' => 'Simple', 'bed_type' => 'individual', 'capacity' => 1, 'price_per_night' => 100, 'status' => 'disponible']);
        $room2 = Room::create(['room_number' => '201', 'name' => 'Doble', 'bed_type' => 'doble', 'capacity' => 2, 'price_per_night' => 100, 'status' => 'disponible']);
        $guest = Guest::create(['name' => 'Ana', 'surname' => 'Stats', 'document_type' => 'DNI', 'document_number' => '11112222', 'email' => 'ana@stats.pe']);

        // B1: 3 noches dentro del rango (02, 03, 04) a 100/noche
        $b1 = $this->at('2026-10-01 10:00:00', fn () => Booking::create([
            'guest_id' => $guest->id, 'room_id' => $room1->id, 'check_in' => '2026-10-02', 'check_out' => '2026-10-05',
            'total_amount' => 300, 'status' => 'confirmed',
        ]));
        // B2: 4 noches, 2 dentro del rango (01, 02) a 100/noche; creada fuera del rango
        $b2 = $this->at('2026-09-20 10:00:00', fn () => Booking::create([
            'guest_id' => $guest->id, 'room_id' => $room2->id, 'check_in' => '2026-09-29', 'check_out' => '2026-10-03',
            'total_amount' => 400, 'status' => 'checked_out',
        ]));
        // B3: cancelada, no cuenta para ocupación
        $b3 = $this->at('2026-10-03 09:00:00', fn () => Booking::create([
            'guest_id' => $guest->id, 'room_id' => $room2->id, 'check_in' => '2026-10-06', 'check_out' => '2026-10-08',
            'total_amount' => 999, 'status' => 'cancelled',
        ]));

        $this->at('2026-10-02 11:00:00', fn () => Payment::create(['booking_id' => $b1->id, 'amount' => 300, 'payment_method' => 'cash', 'status' => 'completed']));
        $this->at('2026-10-03 11:00:00', fn () => Payment::create(['booking_id' => $b2->id, 'amount' => 400, 'payment_method' => 'card', 'status' => 'completed']));
        $this->at('2026-10-03 15:00:00', fn () => Payment::create(['booking_id' => $b3->id, 'amount' => 100, 'payment_method' => 'Efectivo', 'status' => 'completed']));
        $this->at('2026-10-04 10:00:00', fn () => Payment::create(['booking_id' => $b3->id, 'amount' => -100, 'payment_method' => 'Efectivo', 'status' => 'refunded']));
        $this->at('2026-10-04 10:00:00', fn () => Payment::create(['booking_id' => $b1->id, 'amount' => 50, 'payment_method' => 'card', 'status' => 'failed']));
        $this->at('2026-11-01 10:00:00', fn () => Payment::create(['booking_id' => $b1->id, 'amount' => 70, 'payment_method' => 'card', 'status' => 'completed']));

        $agua = Product::create(['name' => 'Agua', 'category' => 'bebidas', 'price' => 5, 'stock' => 10]);
        $gaseosa = Product::create(['name' => 'Gaseosa', 'category' => 'bebidas', 'price' => 6, 'stock' => 10]);

        Charge::create(['booking_id' => $b1->id, 'product_id' => $agua->id, 'date' => '2026-10-03', 'concept' => 'Agua', 'quantity' => 3, 'unit_price' => 5, 'total' => 15]);
        Charge::create(['booking_id' => $b1->id, 'product_id' => $gaseosa->id, 'date' => '2026-10-04', 'concept' => 'Gaseosa', 'quantity' => 1, 'unit_price' => 6, 'total' => 6]);
        Charge::create(['booking_id' => $b1->id, 'product_id' => null, 'date' => '2026-10-04', 'concept' => 'Lavado', 'quantity' => 2, 'unit_price' => 20, 'total' => 40]);
        Charge::create(['booking_id' => $b1->id, 'product_id' => $gaseosa->id, 'date' => '2026-09-01', 'concept' => 'Gaseosa', 'quantity' => 10, 'unit_price' => 6, 'total' => 60]);
    }

    public function test_stats_requires_staff_role(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();

        $this->actingAsRole('cliente');
        $this->getJson(self::URL)->assertForbidden();
    }

    public function test_stats_structure(): void
    {
        $this->actingAsRole('recepcionista');

        $this->getJson('/api/staff/reports/stats?dateRange=30_days')
            ->assertOk()
            ->assertJsonStructure([
                'range' => ['key', 'start_date', 'end_date', 'days'],
                'kpis' => ['gross_revenue', 'refunds', 'net_revenue', 'room_revenue', 'room_nights_sold',
                    'available_room_nights', 'occupancy_rate', 'adr', 'revpar', 'total_bookings'],
                'revenue_by_day', 'occupancy_by_day', 'bookings_by_status',
                'revenue_by_room_type', 'payment_methods', 'top_products',
            ])
            ->assertJsonPath('range.key', '30_days');

        $this->getJson('/api/staff/reports/stats?dateRange=bogus')->assertStatus(422);
        $this->getJson('/api/staff/reports/stats?start_date=2025-01-01&end_date=2026-06-01')->assertStatus(422);
    }

    public function test_stats_numbers_on_fixture(): void
    {
        $this->seedFixture();
        $this->actingAsRole('admin');

        $res = $this->getJson(self::URL)->assertOk();

        $res->assertJsonPath('range.days', 10)
            ->assertJsonCount(10, 'revenue_by_day')
            ->assertJsonCount(10, 'occupancy_by_day');

        $kpis = $res->json('kpis');
        $this->assertEquals(800, $kpis['gross_revenue']);
        $this->assertEquals(100, $kpis['refunds']);
        $this->assertEquals(700, $kpis['net_revenue']);
        $this->assertEquals(5, $kpis['room_nights_sold']);
        $this->assertEquals(20, $kpis['available_room_nights']);
        $this->assertEquals(25, $kpis['occupancy_rate']);
        $this->assertEquals(500, $kpis['room_revenue']);
        $this->assertEquals(100, $kpis['adr']);
        $this->assertEquals(25, $kpis['revpar']);
        $this->assertEquals(2, $kpis['total_bookings']);

        $revenue = collect($res->json('revenue_by_day'))->keyBy('date');
        $this->assertEquals(300, $revenue['2026-10-02']['revenue']);
        $this->assertEquals(500, $revenue['2026-10-03']['revenue']);
        $this->assertEquals(0, $revenue['2026-10-05']['revenue']);

        $occupancy = collect($res->json('occupancy_by_day'))->keyBy('date');
        $this->assertEquals(50, $occupancy['2026-10-01']['occupancy']);
        $this->assertEquals(100, $occupancy['2026-10-02']['occupancy']);
        $this->assertEquals(2, $occupancy['2026-10-02']['occupied_rooms']);
        $this->assertEquals(50, $occupancy['2026-10-04']['occupancy']);
        $this->assertEquals(0, $occupancy['2026-10-05']['occupancy']);
        $this->assertEquals(0, $occupancy['2026-10-06']['occupancy']); // cancelada

        $statuses = collect($res->json('bookings_by_status'))->pluck('count', 'status');
        $this->assertCount(2, $statuses);
        $this->assertEquals(1, $statuses['confirmed']);
        $this->assertEquals(1, $statuses['cancelled']);

        $types = collect($res->json('revenue_by_room_type'));
        $this->assertSame('doble', $types[0]['room_type']);
        $this->assertEquals(500, $types[0]['revenue']);
        $this->assertEquals(300, $types->firstWhere('room_type', 'individual')['revenue']);

        $methods = collect($res->json('payment_methods'))->keyBy('method');
        $this->assertCount(2, $methods);
        $this->assertEquals(400, $methods['Efectivo']['total']);
        $this->assertEquals(2, $methods['Efectivo']['count']);
        $this->assertEquals(400, $methods['Tarjeta']['total']);

        $top = $res->json('top_products');
        $this->assertCount(3, $top);
        $this->assertSame('Agua', $top[0]['name']);
        $this->assertEquals(3, $top[0]['quantity']);
        $this->assertSame('Lavado', $top[1]['name']);
        $this->assertEquals(1, collect($top)->firstWhere('name', 'Gaseosa')['quantity']);
    }
}
