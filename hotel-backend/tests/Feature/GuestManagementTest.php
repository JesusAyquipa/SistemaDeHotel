<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Guest;
use App\Models\Payment;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * SHE-024 / SHE-025: gestión e historial de huéspedes.
 */
class GuestManagementTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['admin', 'recepcionista', 'cliente'] as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }

        $this->room = Room::create([
            'room_number' => '101', 'name' => 'Simple', 'bed_type' => 'individual',
            'capacity' => 1, 'price_per_night' => 100, 'status' => 'disponible',
        ]);
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }

    private function makeGuest(array $overrides = []): Guest
    {
        static $n = 0;
        $n++;

        return Guest::create(array_merge([
            'name' => 'Huésped', 'surname' => "Prueba{$n}", 'document_type' => 'DNI',
            'document_number' => str_pad((string) (40000000 + $n), 8, '0', STR_PAD_LEFT),
            'email' => "guest{$n}@example.com", 'phone' => '999888777',
        ], $overrides));
    }

    private function makeBooking(Guest $guest, string $status, string $in, string $out, float $total): Booking
    {
        return Booking::create([
            'guest_id' => $guest->id, 'room_id' => $this->room->id,
            'check_in' => $in, 'check_out' => $out, 'total_amount' => $total, 'status' => $status,
        ]);
    }

    public function test_guests_index_requires_staff_role(): void
    {
        $this->getJson('/api/guests')->assertUnauthorized();

        $this->actingAsRole('cliente');
        $this->getJson('/api/guests')->assertForbidden();
    }

    public function test_index_paginates_searches_and_sorts(): void
    {
        $this->actingAsRole('recepcionista');

        for ($i = 0; $i < 22; $i++) {
            $this->makeGuest();
        }
        $target = $this->makeGuest(['name' => 'Zoila', 'surname' => 'Buscable', 'email' => 'zoila@hotel.pe']);
        $this->makeBooking($target, 'checked_out', '2026-01-01', '2026-01-03', 200);

        $this->getJson('/api/guests')
            ->assertOk()
            ->assertJsonPath('per_page', 20)
            ->assertJsonPath('total', 23)
            ->assertJsonCount(20, 'data');

        $this->getJson('/api/guests?search=buscable')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $target->id)
            ->assertJsonPath('data.0.stays_count', 1);

        $this->getJson('/api/guests?search=zoila@hotel')->assertJsonPath('total', 1);
        $this->getJson('/api/guests?search=' . $target->document_number)->assertJsonPath('total', 1);

        $this->getJson('/api/guests?sort=stays')->assertOk()->assertJsonPath('data.0.id', $target->id);
        $this->getJson('/api/guests?sort=name')->assertOk()->assertJsonPath('data.0.surname', 'Buscable');
        $this->getJson('/api/guests?sort=invalid')->assertStatus(422);
    }

    public function test_show_returns_stats_and_history(): void
    {
        $this->actingAsRole('recepcionista');
        $guest = $this->makeGuest();

        $past = $this->makeBooking($guest, 'checked_out', '2026-01-10', '2026-01-12', 200);
        $past2 = $this->makeBooking($guest, 'checked_out', '2026-03-01', '2026-03-04', 300);
        $cancelled = $this->makeBooking($guest, 'cancelled', '2026-04-01', '2026-04-02', 100);
        $future = $this->makeBooking(
            $guest, 'confirmed', now()->addDays(5)->toDateString(), now()->addDays(7)->toDateString(), 200
        );

        Payment::create(['booking_id' => $past->id, 'amount' => 200, 'payment_method' => 'cash', 'status' => 'completed']);
        Payment::create(['booking_id' => $past2->id, 'amount' => 300, 'payment_method' => 'card', 'status' => 'completed']);
        Payment::create(['booking_id' => $cancelled->id, 'amount' => 100, 'payment_method' => 'card', 'status' => 'completed']);
        Payment::create(['booking_id' => $cancelled->id, 'amount' => -100, 'payment_method' => 'card', 'status' => 'refund_pending']);
        Payment::create(['booking_id' => $future->id, 'amount' => 50, 'payment_method' => 'card', 'status' => 'failed']);

        $this->getJson("/api/guests/{$guest->id}")
            ->assertOk()
            ->assertJsonPath('guest.id', $guest->id)
            ->assertJsonPath('stats.total_bookings', 4)
            ->assertJsonPath('stats.total_stays', 2)
            ->assertJsonPath('stats.total_spent', 500)
            ->assertJsonPath('stats.last_stay.id', $past2->id)
            ->assertJsonPath('stats.upcoming_count', 1)
            ->assertJsonPath('upcoming_bookings.0.id', $future->id)
            ->assertJsonCount(4, 'bookings')
            ->assertJsonStructure(['bookings' => [['id', 'booking_code', 'check_in', 'check_out', 'status', 'total_amount', 'room' => ['room_number', 'name']]]]);

        $this->getJson('/api/guests/999999')->assertNotFound();
    }

    public function test_update_validates_and_enforces_uniqueness_excluding_self(): void
    {
        $this->actingAsRole('recepcionista');
        $guest = $this->makeGuest();
        $other = $this->makeGuest();

        $payload = [
            'name' => 'Nuevo', 'surname' => 'Nombre', 'document_type' => 'DNI',
            'document_number' => $guest->document_number, 'email' => $guest->email, 'phone' => '+51 999 111 222',
        ];

        // Mismo email/documento propio: permitido
        $this->putJson("/api/guests/{$guest->id}", $payload)
            ->assertOk()
            ->assertJsonPath('data.name', 'Nuevo');
        $this->assertDatabaseHas('guests', ['id' => $guest->id, 'surname' => 'Nombre']);

        // Email / documento de otro huésped: 422
        $this->putJson("/api/guests/{$guest->id}", array_merge($payload, ['email' => $other->email]))
            ->assertStatus(422)->assertJsonValidationErrors('email');
        $this->putJson("/api/guests/{$guest->id}", array_merge($payload, ['document_number' => $other->document_number]))
            ->assertStatus(422)->assertJsonValidationErrors('document_number');

        // DNI inválido
        $this->putJson("/api/guests/{$guest->id}", array_merge($payload, ['document_number' => '123']))
            ->assertStatus(422)->assertJsonValidationErrors('document_number');
    }

    public function test_only_admin_can_delete_and_guest_with_bookings_returns_409(): void
    {
        $guest = $this->makeGuest();
        $withBookings = $this->makeGuest();
        $this->makeBooking($withBookings, 'cancelled', '2026-02-01', '2026-02-02', 100);

        $this->actingAsRole('recepcionista');
        $this->deleteJson("/api/guests/{$guest->id}")->assertForbidden();

        $this->actingAsRole('admin');
        $this->deleteJson("/api/guests/{$withBookings->id}")->assertStatus(409)->assertJsonStructure(['message']);
        $this->assertDatabaseHas('guests', ['id' => $withBookings->id]);

        $this->deleteJson("/api/guests/{$guest->id}")->assertOk();
        $this->assertDatabaseMissing('guests', ['id' => $guest->id]);

        $this->deleteJson('/api/guests/999999')->assertNotFound();
    }

    public function test_existing_search_and_store_still_work(): void
    {
        $this->actingAsRole('recepcionista');
        $this->makeGuest(['surname' => 'Existente']);

        $this->getJson('/api/guests/search?query=Existente')->assertOk()->assertJsonCount(1);

        $this->postJson('/api/guests', [
            'name' => 'Carlos', 'surname' => 'Nuevo', 'document_type' => 'DNI',
            'document_number' => '87654321', 'email' => 'carlos@example.com',
        ])->assertCreated();
    }
}
