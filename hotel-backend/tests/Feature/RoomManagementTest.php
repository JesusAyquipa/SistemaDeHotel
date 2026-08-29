<?php

namespace Tests\Feature;

use App\Events\RoomStatusUpdated;
use App\Models\Booking;
use App\Models\Guest;
use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class RoomManagementTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();

        $this->room = Room::create([
            'room_number'     => '101',
            'name'            => 'Habitación Simple Deluxe',
            'bed_type'        => 'individual',
            'capacity'        => 1,
            'price_per_night' => 120.00,
            'status'          => 'disponible',
            'description'     => 'Habitación de prueba para staff.',
        ]);
    }

    /**
     * Test 1: Staff puede listar todas las habitaciones y obtener métricas de inventario.
     */
    public function test_staff_can_list_all_rooms_with_metrics(): void
    {
        Room::create([
            'room_number'     => '102',
            'name'            => 'Habitación Mantenimiento',
            'bed_type'        => 'doble',
            'capacity'        => 2,
            'price_per_night' => 200.00,
            'status'          => 'mantenimiento',
        ]);

        $response = $this->getJson('/api/staff/rooms');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'rooms',
                'metrics' => ['total', 'disponible', 'ocupada', 'mantenimiento', 'limpieza', 'reservada'],
            ])
            ->assertJsonPath('metrics.total', 2)
            ->assertJsonPath('metrics.disponible', 1)
            ->assertJsonPath('metrics.mantenimiento', 1);
    }

    /**
     * Test 2: Staff puede registrar una nueva habitación.
     */
    public function test_staff_can_create_new_room(): void
    {
        $payload = [
            'room_number'     => '201',
            'name'            => 'Suite Matrimonial Premium',
            'bed_type'        => 'king',
            'capacity'        => 2,
            'size_m2'         => 35,
            'price_per_night' => 280.00,
            'status'          => 'disponible',
            'description'     => 'Suite con vista panorámica a la ciudad.',
        ];

        $response = $this->postJson('/api/staff/rooms', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('room.room_number', '201')
            ->assertJsonPath('room.status', 'disponible');

        $this->assertDatabaseHas('rooms', ['room_number' => '201']);
    }

    /**
     * Test 3: Staff puede realizar un cambio rápido de estado y dispara evento broadcast.
     */
    public function test_staff_can_update_room_status_and_triggers_event(): void
    {
        Event::fake([RoomStatusUpdated::class]);

        $payload = ['status' => 'mantenimiento'];

        $response = $this->patchJson("/api/staff/rooms/{$this->room->id}/status", $payload);

        $response->assertStatus(200)
            ->assertJsonPath('new_status', 'mantenimiento')
            ->assertJsonPath('old_status', 'disponible');

        $this->assertDatabaseHas('rooms', [
            'id'     => $this->room->id,
            'status' => 'mantenimiento',
        ]);

        Event::assertDispatched(RoomStatusUpdated::class, function ($event) {
            return $event->room->id === $this->room->id &&
                   $event->oldStatus === 'disponible' &&
                   $event->newStatus === 'mantenimiento';
        });
    }

    /**
     * Test 4: Staff puede actualizar los datos técnicos de una habitación.
     */
    public function test_staff_can_update_room_details(): void
    {
        $payload = [
            'room_number'     => '101',
            'name'            => 'Habitación Simple Remodelada',
            'bed_type'        => 'individual',
            'capacity'        => 1,
            'price_per_night' => 150.00,
            'status'          => 'disponible',
        ];

        $response = $this->putJson("/api/staff/rooms/{$this->room->id}", $payload);

        $response->assertStatus(200);
        $this->assertEquals(150.00, (float) $response->json('room.price_per_night'));

        $this->assertDatabaseHas('rooms', [
            'id'              => $this->room->id,
            'price_per_night' => 150.00,
        ]);
    }

    /**
     * Test 5: No se puede eliminar una habitación que tiene reservas vigentes.
     */
    public function test_cannot_delete_room_with_active_bookings(): void
    {
        $guest = Guest::create([
            'name'            => 'Pedro',
            'surname'         => 'Sánchez',
            'document_type'   => 'DNI',
            'document_number' => '11223344',
            'email'           => 'pedro@example.com',
        ]);

        Booking::create([
            'booking_code' => 'RES-TESTDEL',
            'guest_id'     => $guest->id,
            'room_id'      => $this->room->id,
            'check_in'     => now()->addDays(1)->toDateString(),
            'check_out'    => now()->addDays(3)->toDateString(),
            'total_amount' => 240.00,
            'status'       => 'confirmed',
        ]);

        $response = $this->deleteJson("/api/staff/rooms/{$this->room->id}");

        $response->assertStatus(422)
            ->assertJsonPath('message', 'No se puede eliminar la habitación porque tiene reservas vigentes asociadas.');

        $this->assertDatabaseHas('rooms', ['id' => $this->room->id]);
    }
}
