<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\Guest;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * SHE-017: validación de cambios de estado de habitación (PATCH /api/staff/rooms/{id}/status).
 */
class RoomStatusChangeTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;
    private User $receptionist;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['admin', 'recepcionista', 'cliente'] as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }

        $this->receptionist = User::factory()->create(['is_active' => true]);
        $this->receptionist->assignRole('recepcionista');
        $this->admin = User::factory()->create(['is_active' => true]);
        $this->admin->assignRole('admin');

        Sanctum::actingAs($this->receptionist);

        $this->room = Room::create([
            'room_number'     => '210',
            'name'            => 'Doble Estándar',
            'bed_type'        => 'doble',
            'capacity'        => 2,
            'price_per_night' => 150,
            'status'          => 'disponible',
        ]);
    }

    private function booking(string $status, int $fromDays, int $toDays): Booking
    {
        $guest = Guest::firstOrCreate(['document_number' => '10203040'], [
            'name'          => 'Luis',
            'surname'       => 'Ramos',
            'document_type' => 'DNI',
            'email'         => 'luis@example.com',
        ]);

        return Booking::create([
            'guest_id'     => $guest->id,
            'room_id'      => $this->room->id,
            'check_in'     => now()->addDays($fromDays)->toDateString(),
            'check_out'    => now()->addDays($toDays)->toDateString(),
            'total_amount' => 300,
            'status'       => $status,
        ]);
    }

    private function patchStatus(array $payload)
    {
        return $this->patchJson("/api/staff/rooms/{$this->room->id}/status", $payload);
    }

    public function test_same_status_returns_422(): void
    {
        $this->patchStatus(['status' => 'disponible'])->assertStatus(422);
    }

    public function test_invalid_status_returns_422(): void
    {
        $this->patchStatus(['status' => 'demolida'])->assertStatus(422);
    }

    public function test_cleaning_to_available_is_allowed_and_logged(): void
    {
        $this->room->update(['status' => 'limpieza']);

        $this->patchStatus(['status' => 'disponible', 'reason' => 'Inspeccionada'])
            ->assertOk()
            ->assertJsonPath('new_status', 'disponible');

        $log = ActivityLog::where('action', 'status_change')->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertSame($this->receptionist->id, $log->user_id);
        $this->assertSame('limpieza', $log->changes['old']['status']);
        $this->assertSame('disponible', $log->changes['new']['status']);
        $this->assertSame('Inspeccionada', $log->changes['reason']);
    }

    public function test_cannot_set_available_or_maintenance_with_guest_checked_in(): void
    {
        $this->booking(Booking::STATUS_CHECKED_IN, 0, 2);
        $this->room->update(['status' => 'limpieza']);

        $this->patchStatus(['status' => 'disponible'])
            ->assertStatus(409)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'huésped alojado'));

        $this->patchStatus(['status' => 'mantenimiento', 'reason' => 'Aire acondicionado'])
            ->assertStatus(409);

        $this->assertDatabaseHas('rooms', ['id' => $this->room->id, 'status' => 'limpieza']);
    }

    public function test_cannot_set_occupied_without_checked_in_booking(): void
    {
        $this->patchStatus(['status' => 'ocupada'])
            ->assertStatus(409)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'check-in'));

        $this->assertDatabaseHas('rooms', ['id' => $this->room->id, 'status' => 'disponible']);
    }

    public function test_can_set_occupied_with_checked_in_booking(): void
    {
        $this->booking(Booking::STATUS_CHECKED_IN, 0, 2);
        $this->room->update(['status' => 'limpieza']);

        $this->patchStatus(['status' => 'ocupada'])->assertOk();
    }

    public function test_maintenance_requires_reason(): void
    {
        $this->patchStatus(['status' => 'mantenimiento'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('reason');
    }

    public function test_maintenance_with_upcoming_bookings_returns_409_with_affected_codes(): void
    {
        $soon = $this->booking(Booking::STATUS_CONFIRMED, 3, 5);
        $later = $this->booking(Booking::STATUS_CONFIRMED, 20, 22);

        $response = $this->patchStatus(['status' => 'mantenimiento', 'reason' => 'Fuga de agua'])
            ->assertStatus(409)
            ->assertJsonPath('requires_force', true)
            ->assertJsonCount(1, 'affected_bookings')
            ->assertJsonPath('affected_bookings.0.booking_code', $soon->booking_code);

        $this->assertStringNotContainsString($later->booking_code, $response->json('message'));
        $this->assertDatabaseHas('rooms', ['id' => $this->room->id, 'status' => 'disponible']);
    }

    public function test_receptionist_cannot_force_maintenance(): void
    {
        $this->booking(Booking::STATUS_CONFIRMED, 1, 3);

        $this->patchStatus(['status' => 'mantenimiento', 'reason' => 'Fuga', 'force' => true])
            ->assertStatus(403);
    }

    public function test_admin_can_force_maintenance_and_it_is_logged(): void
    {
        $this->booking(Booking::STATUS_CONFIRMED, 1, 3);
        Sanctum::actingAs($this->admin);

        $this->patchStatus(['status' => 'mantenimiento', 'reason' => 'Fuga', 'force' => true])
            ->assertOk()
            ->assertJsonPath('new_status', 'mantenimiento');

        $log = ActivityLog::where('action', 'status_change')->latest('id')->first();
        $this->assertTrue($log->changes['forced']);
        $this->assertStringContainsString('Fuga', $log->description);
    }

    public function test_maintenance_without_upcoming_bookings_is_allowed(): void
    {
        $this->booking(Booking::STATUS_CANCELLED, 1, 3);

        $this->patchStatus(['status' => 'mantenimiento', 'reason' => 'Pintura'])
            ->assertOk();
    }

    private function putRoom(array $overrides = [])
    {
        Sanctum::actingAs($this->admin);

        return $this->putJson("/api/staff/rooms/{$this->room->id}", array_merge([
            'room_number'     => '210',
            'name'            => 'Doble Estándar',
            'bed_type'        => 'doble',
            'capacity'        => 2,
            'price_per_night' => 150,
            'status'          => 'disponible',
        ], $overrides));
    }

    public function test_put_with_occupied_status_without_guest_returns_409(): void
    {
        $this->putRoom(['status' => 'ocupada', 'name' => 'Cambiado'])
            ->assertStatus(409)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'check-in'));

        // Nada se guardó (ni el estado ni los demás campos)
        $this->assertDatabaseHas('rooms', ['id' => $this->room->id, 'status' => 'disponible', 'name' => 'Doble Estándar']);
    }

    public function test_put_with_maintenance_without_reason_returns_422(): void
    {
        $this->putRoom(['status' => 'mantenimiento'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('reason');

        $this->putRoom(['status' => 'mantenimiento', 'reason' => 'Cambio de alfombra'])
            ->assertOk();

        $log = ActivityLog::where('action', 'status_change')->latest('id')->first();
        $this->assertSame('Cambio de alfombra', $log->changes['reason']);
    }

    public function test_put_with_maintenance_and_upcoming_booking_requires_force(): void
    {
        $this->booking(Booking::STATUS_CONFIRMED, 2, 4);

        $this->putRoom(['status' => 'mantenimiento', 'reason' => 'Fuga'])
            ->assertStatus(409)
            ->assertJsonPath('requires_force', true);

        $this->putRoom(['status' => 'mantenimiento', 'reason' => 'Fuga', 'force' => true])
            ->assertOk();
    }

    public function test_put_without_status_change_is_unaffected(): void
    {
        // Huésped alojado y estado actual ocupada: editar otros datos sigue funcionando
        $this->booking(Booking::STATUS_CHECKED_IN, 0, 2);
        $this->room->update(['status' => 'ocupada']);

        $this->putRoom(['status' => 'ocupada', 'price_per_night' => 175])
            ->assertOk();

        $this->assertDatabaseHas('rooms', ['id' => $this->room->id, 'status' => 'ocupada', 'price_per_night' => 175]);
    }

    public function test_staff_rooms_listing_exposes_has_guest_flag(): void
    {
        $this->booking(Booking::STATUS_CHECKED_IN, 0, 2);

        $response = $this->getJson('/api/staff/rooms')->assertOk();
        $this->assertTrue((bool) $response->json('rooms.0.has_guest'));
    }
}
