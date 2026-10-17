<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Guest;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * SHE-033: notas, preferencias, VIP y lista negra de huéspedes.
 */
class GuestScreeningTest extends TestCase
{
    use RefreshDatabase;

    private User $receptionist;
    private User $admin;
    private Room $room;
    private Guest $guest;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();

        foreach (['admin', 'recepcionista', 'cliente'] as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }

        $this->receptionist = User::factory()->create(['is_active' => true]);
        $this->receptionist->assignRole('recepcionista');
        $this->admin = User::factory()->create(['is_active' => true]);
        $this->admin->assignRole('admin');

        $this->room = Room::create([
            'room_number' => '105', 'name' => 'Doble', 'bed_type' => 'doble',
            'capacity' => 2, 'price_per_night' => 120, 'status' => 'disponible',
        ]);

        $this->guest = Guest::create([
            'name' => 'Pedro', 'surname' => 'Vega', 'document_type' => 'DNI',
            'document_number' => '87654321', 'email' => 'pedro@example.com',
        ]);
    }

    private function profile(array $extra = []): array
    {
        return array_merge([
            'name' => 'Pedro', 'surname' => 'Vega', 'document_type' => 'DNI',
            'document_number' => '87654321', 'email' => 'pedro@example.com',
        ], $extra);
    }

    private function bookingPayload(): array
    {
        return [
            'room_id'         => $this->room->id,
            'check_in'        => now()->addDays(2)->toDateString(),
            'check_out'       => now()->addDays(4)->toDateString(),
            'guest_name'      => 'Pedro',
            'guest_surname'   => 'Vega',
            'guest_email'     => 'pedro@example.com',
            'document_type'   => 'DNI',
            'document_number' => '87654321',
        ];
    }

    public function test_receptionist_can_set_vip_notes_and_preferences(): void
    {
        Sanctum::actingAs($this->receptionist);

        $this->putJson("/api/guests/{$this->guest->id}", $this->profile([
            'is_vip' => true,
            'notes' => 'Cliente frecuente',
            'preferences' => ['Almohada firme', 'Piso alto'],
        ]))->assertOk()
            ->assertJsonPath('data.is_vip', true)
            ->assertJsonPath('data.preferences.1', 'Piso alto');

        $this->guest->refresh();
        $this->assertTrue($this->guest->is_vip);
        $this->assertSame(['Almohada firme', 'Piso alto'], $this->guest->preferences);

        $this->getJson('/api/guests?flag=vip')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.is_vip', true);
        $this->getJson('/api/guests?flag=blacklisted')->assertOk()->assertJsonPath('total', 0);
        $this->getJson('/api/guests?flag=otro')->assertStatus(422);
    }

    public function test_blacklist_fields_are_admin_only(): void
    {
        Sanctum::actingAs($this->receptionist);
        $this->putJson("/api/guests/{$this->guest->id}", $this->profile([
            'is_blacklisted' => true, 'blacklist_reason' => 'Daños',
        ]))->assertStatus(403);
        $this->assertFalse((bool) $this->guest->fresh()->is_blacklisted);

        Sanctum::actingAs($this->admin);
        $this->putJson("/api/guests/{$this->guest->id}", $this->profile(['is_blacklisted' => true]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('blacklist_reason');

        $this->putJson("/api/guests/{$this->guest->id}", $this->profile([
            'is_blacklisted' => true, 'blacklist_reason' => 'Daños a la habitación',
        ]))->assertOk()->assertJsonPath('data.is_blacklisted', true);

        $this->getJson('/api/guests?flag=blacklisted')->assertOk()->assertJsonPath('total', 1);

        // Al quitarlo de la lista negra se borra el motivo
        $this->putJson("/api/guests/{$this->guest->id}", $this->profile(['is_blacklisted' => false]))
            ->assertOk()
            ->assertJsonPath('data.blacklist_reason', null);
    }

    public function test_blacklisted_guest_blocks_staff_booking(): void
    {
        $this->guest->update(['is_blacklisted' => true, 'blacklist_reason' => 'Impago']);
        Sanctum::actingAs($this->receptionist);

        $this->postJson('/api/bookings', $this->bookingPayload())
            ->assertStatus(422)
            ->assertJsonPath('message', 'No es posible procesar la reserva');

        $this->assertSame(0, Booking::count());
    }

    public function test_blacklisted_guest_blocks_public_checkout_intent(): void
    {
        $this->guest->update(['is_blacklisted' => true, 'blacklist_reason' => 'Fraude']);

        $this->postJson('/api/payments/checkout-intent', $this->bookingPayload())
            ->assertStatus(422)
            ->assertJsonPath('message', 'No es posible procesar la reserva');

        $this->assertSame(0, Booking::count());
    }

    public function test_non_blacklisted_guest_can_still_book(): void
    {
        $this->guest->update(['is_vip' => true]);
        Sanctum::actingAs($this->receptionist);

        $this->postJson('/api/bookings', $this->bookingPayload())->assertStatus(201);
        $this->assertSame(1, Booking::count());
    }
}
