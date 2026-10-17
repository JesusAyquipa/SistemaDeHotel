<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Charge;
use App\Models\Guest;
use App\Models\Payment;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * SHE-030 (rack de ocupación) y SHE-031 (llegadas y salidas del día).
 */
class FrontDeskTest extends TestCase
{
    use RefreshDatabase;

    private User $receptionist;
    private Guest $guest;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['admin', 'recepcionista', 'cliente'] as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }

        $this->receptionist = User::factory()->create(['is_active' => true]);
        $this->receptionist->assignRole('recepcionista');

        $this->guest = Guest::create([
            'name' => 'Ana', 'surname' => 'Torres', 'document_type' => 'DNI',
            'document_number' => '44556677', 'email' => 'ana@example.com', 'is_vip' => true,
        ]);
    }

    private function room(string $number, string $status = 'disponible'): Room
    {
        return Room::create([
            'room_number' => $number, 'name' => "Hab {$number}", 'bed_type' => 'doble',
            'capacity' => 2, 'price_per_night' => 100, 'status' => $status,
        ]);
    }

    private function booking(Room $room, string $status, int $from, int $to, array $extra = []): Booking
    {
        return Booking::create(array_merge([
            'guest_id'     => $this->guest->id,
            'room_id'      => $room->id,
            'check_in'     => now()->addDays($from)->toDateString(),
            'check_out'    => now()->addDays($to)->toDateString(),
            'total_amount' => 100 * max(1, $to - $from),
            'status'       => $status,
        ], $extra));
    }

    // ── Rack ─────────────────────────────────────────────────────────────

    public function test_rack_requires_staff_role(): void
    {
        $this->getJson('/api/staff/front-desk/rack')->assertStatus(401);

        $client = User::factory()->create(['is_active' => true]);
        $client->assignRole('cliente');
        Sanctum::actingAs($client);
        $this->getJson('/api/staff/front-desk/rack')->assertStatus(403);
    }

    public function test_rack_returns_rooms_sorted_by_floor_and_number_with_status(): void
    {
        $this->room('201');
        $this->room('102', 'limpieza');
        $this->room('101');
        Sanctum::actingAs($this->receptionist);

        $res = $this->getJson('/api/staff/front-desk/rack?days=7')->assertOk();

        $this->assertSame(['101', '102', '201'], array_column($res->json('rooms'), 'room_number'));
        $this->assertSame(1, $res->json('rooms.0.floor'));
        $this->assertSame(2, $res->json('rooms.2.floor'));
        $this->assertSame('limpieza', $res->json('rooms.1.status'));
        $this->assertSame(7, $res->json('days'));
        $this->assertSame(now()->toDateString(), $res->json('start'));
        $this->assertSame(now()->addDays(7)->toDateString(), $res->json('end'));
    }

    public function test_rack_includes_only_bookings_in_range_with_blocking_or_checked_out_status(): void
    {
        $room = $this->room('101');
        Sanctum::actingAs($this->receptionist);

        $confirmed = $this->booking($room, Booking::STATUS_CONFIRMED, 1, 3);
        $checkedIn = $this->booking($room, Booking::STATUS_CHECKED_IN, -2, 1);
        $checkedOut = $this->booking($room, Booking::STATUS_CHECKED_OUT, -4, -2);
        $pendingLive = $this->booking($room, Booking::STATUS_PENDING_PAYMENT, 4, 5, ['expires_at' => now()->addMinutes(20)]);
        $this->booking($room, Booking::STATUS_PENDING_PAYMENT, 5, 6, ['expires_at' => now()->subMinutes(5)]); // vencida
        $this->booking($room, Booking::STATUS_CANCELLED, 2, 4);
        $this->booking($room, Booking::STATUS_EXPIRED, 2, 4);
        $this->booking($room, Booking::STATUS_CONFIRMED, 20, 22); // fuera de rango

        $res = $this->getJson('/api/staff/front-desk/rack?start=' . now()->subDays(5)->toDateString() . '&days=14')->assertOk();

        $codes = collect($res->json('rooms.0.bookings'))->pluck('code')->sort()->values()->all();
        $expected = collect([$confirmed, $checkedIn, $checkedOut, $pendingLive])->pluck('booking_code')->sort()->values()->all();
        $this->assertSame($expected, $codes);

        $first = collect($res->json('rooms.0.bookings'))->firstWhere('code', $confirmed->booking_code);
        $this->assertSame('Ana Torres', $first['guest_name']);
        $this->assertTrue($first['vip']);
        $this->assertSame(now()->addDay()->toDateString(), $first['check_in']);
    }

    public function test_rack_validates_parameters(): void
    {
        Sanctum::actingAs($this->receptionist);
        $this->getJson('/api/staff/front-desk/rack?days=90')->assertStatus(422);
        $this->getJson('/api/staff/front-desk/rack?start=17-10-2026')->assertStatus(422);
    }

    // ── Hoy ──────────────────────────────────────────────────────────────

    public function test_today_buckets_and_counts(): void
    {
        $r1 = $this->room('101');
        $r2 = $this->room('102');
        $r3 = $this->room('103');
        $r4 = $this->room('104');
        $r5 = $this->room('105');
        Sanctum::actingAs($this->receptionist);

        $arrival = $this->booking($r1, Booking::STATUS_CONFIRMED, 0, 2);
        $departure = $this->booking($r2, Booking::STATUS_CHECKED_IN, -2, 0);
        $staying = $this->booking($r3, Booking::STATUS_CHECKED_IN, -1, 3);
        $noShow = $this->booking($r4, Booking::STATUS_CONFIRMED, -1, 2);
        $this->booking($r5, Booking::STATUS_CANCELLED, 0, 2);
        $this->booking($r5, Booking::STATUS_CONFIRMED, 3, 5); // futura

        // Saldo de la salida: 200 alojamiento + 50 consumo - 120 pagado = 130
        Charge::create([
            'booking_id' => $departure->id, 'date' => now()->toDateString(), 'concept' => 'Frigobar',
            'quantity' => 1, 'unit_price' => 50, 'total' => 50,
        ]);
        Payment::create([
            'booking_id' => $departure->id, 'amount' => 120, 'payment_method' => 'Efectivo',
            'status' => Payment::STATUS_COMPLETED, 'transaction_id' => 'T-1',
        ]);

        $res = $this->getJson('/api/staff/front-desk/today')->assertOk();

        $this->assertSame([$arrival->booking_code], array_column($res->json('arrivals'), 'booking_code'));
        $this->assertSame([$departure->booking_code], array_column($res->json('departures'), 'booking_code'));
        $this->assertEqualsCanonicalizing(
            [$departure->booking_code, $staying->booking_code],
            array_column($res->json('in_house'), 'booking_code')
        );
        $this->assertSame([$noShow->booking_code], array_column($res->json('no_show_candidates'), 'booking_code'));

        $this->assertEquals(130, $res->json('departures.0.balance'));
        $this->assertTrue($res->json('arrivals.0.guest.is_vip'));
        $this->assertSame('101', $res->json('arrivals.0.room.room_number'));
        $this->assertArrayHasKey('pre_check_in', $res->json('arrivals.0'));
        $this->assertSame(1, $res->json('counts.arrivals'));
        $this->assertSame(1, $res->json('counts.departures'));
        $this->assertSame(2, $res->json('counts.in_house'));
        $this->assertSame(1, $res->json('counts.no_show_candidates'));
    }

    public function test_today_forbidden_for_clients(): void
    {
        $client = User::factory()->create(['is_active' => true]);
        $client->assignRole('cliente');
        Sanctum::actingAs($client);

        $this->getJson('/api/staff/front-desk/today')->assertStatus(403);
    }
}
