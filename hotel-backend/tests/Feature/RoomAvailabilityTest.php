<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Guest;
use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoomAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Una habitación con reserva confirmada en un rango de fechas
     * NO aparece disponible si se busca ese mismo rango.
     */
    public function test_room_with_confirmed_booking_is_not_available_in_same_date_range(): void
    {
        // Crear habitación disponible
        $room = Room::create([
            'room_number'     => '101',
            'name'            => 'Suite de Prueba',
            'description'     => 'Habitación para test',
            'bed_type'        => 'king',
            'capacity'        => 2,
            'size_m2'         => 40,
            'price_per_night' => 300.00,
            'status'          => 'disponible',
        ]);

        // Crear huésped
        $guest = Guest::create([
            'name'            => 'Juan',
            'surname'         => 'Pérez',
            'document_type'   => 'DNI',
            'document_number' => '12345678',
            'email'           => 'juan@test.com',
        ]);

        // Reserva confirmada (en +60 a +65 días)
        Booking::create([
            'guest_id'     => $guest->id,
            'room_id'      => $room->id,
            'check_in'     => now()->addDays(60)->toDateString(),
            'check_out'    => now()->addDays(65)->toDateString(),
            'total_amount' => 1500.00,
            'status'       => 'confirmed',
        ]);

        // Buscar el mismo rango: NO debe aparecer
        $response = $this->getJson('/api/rooms/available?check_in=' . now()->addDays(60)->toDateString() . '&check_out=' . now()->addDays(65)->toDateString());

        $response->assertStatus(200);
        $response->assertJsonMissing(['room_number' => '101']);
    }

    /**
     * Una habitación con reserva confirmada en un rango
     * SÍ aparece disponible si se busca un rango sin cruce.
     */
    public function test_room_with_confirmed_booking_is_available_in_different_date_range(): void
    {
        $room = Room::create([
            'room_number'     => '202',
            'name'            => 'Suite de Prueba 2',
            'description'     => 'Habitación para test',
            'bed_type'        => 'doble',
            'capacity'        => 2,
            'size_m2'         => 35,
            'price_per_night' => 200.00,
            'status'          => 'disponible',
        ]);

        $guest = Guest::create([
            'name'            => 'María',
            'surname'         => 'García',
            'document_type'   => 'DNI',
            'document_number' => '87654321',
            'email'           => 'maria@test.com',
        ]);

        // Reserva confirmada (en +80 a +85 días)
        Booking::create([
            'guest_id'     => $guest->id,
            'room_id'      => $room->id,
            'check_in'     => now()->addDays(80)->toDateString(),
            'check_out'    => now()->addDays(85)->toDateString(),
            'total_amount' => 1000.00,
            'status'       => 'confirmed',
        ]);

        // Buscar rango diferente (+90 a +95 días): SÍ debe aparecer
        $response = $this->getJson('/api/rooms/available?check_in=' . now()->addDays(90)->toDateString() . '&check_out=' . now()->addDays(95)->toDateString());

        $response->assertStatus(200);
        $response->assertJsonFragment(['room_number' => '202']);
    }

    /**
     * Una reserva cancelada no bloquea la disponibilidad de la habitación.
     */
    public function test_room_with_cancelled_booking_is_still_available(): void
    {
        $room = Room::create([
            'room_number'     => '303',
            'name'            => 'Suite de Prueba 3',
            'description'     => 'Habitación para test',
            'bed_type'        => 'king',
            'capacity'        => 3,
            'size_m2'         => 60,
            'price_per_night' => 400.00,
            'status'          => 'disponible',
        ]);

        $guest = Guest::create([
            'name'            => 'Carlos',
            'surname'         => 'López',
            'document_type'   => 'DNI',
            'document_number' => '11223344',
            'email'           => 'carlos@test.com',
        ]);

        // Reserva cancelada (no debe bloquear)
        Booking::create([
            'guest_id'     => $guest->id,
            'room_id'      => $room->id,
            'check_in'     => now()->addDays(100)->toDateString(),
            'check_out'    => now()->addDays(104)->toDateString(),
            'total_amount' => 2000.00,
            'status'       => 'cancelled',
        ]);

        // Mismo rango: SÍ debe aparecer (la reserva está cancelada)
        $response = $this->getJson('/api/rooms/available?check_in=' . now()->addDays(100)->toDateString() . '&check_out=' . now()->addDays(104)->toDateString());

        $response->assertStatus(200);
        $response->assertJsonFragment(['room_number' => '303']);
    }

    /**
     * Filtrar por tipo de cama devuelve solo habitaciones de ese tipo.
     */
    public function test_filter_by_bed_type_returns_matching_rooms(): void
    {
        Room::create([
            'room_number'     => '401',
            'name'            => 'Individual Test',
            'bed_type'        => 'individual',
            'capacity'        => 1,
            'price_per_night' => 150.00,
            'status'          => 'disponible',
        ]);

        Room::create([
            'room_number'     => '402',
            'name'            => 'King Test',
            'bed_type'        => 'king',
            'capacity'        => 2,
            'price_per_night' => 350.00,
            'status'          => 'disponible',
        ]);

        $response = $this->getJson('/api/rooms/available?bed_type=individual');

        $response->assertStatus(200);
        $response->assertJsonFragment(['room_number' => '401']);
        $response->assertJsonMissing(['room_number' => '402']);
    }

    /**
     * Habitaciones en mantenimiento no aparecen en resultados.
     */
    public function test_rooms_in_maintenance_are_not_returned(): void
    {
        Room::create([
            'room_number'     => '501',
            'name'            => 'Habitación en mantenimiento',
            'bed_type'        => 'doble',
            'capacity'        => 2,
            'price_per_night' => 250.00,
            'status'          => 'mantenimiento',
        ]);

        $response = $this->getJson('/api/rooms/available');

        $response->assertStatus(200);
        $response->assertJsonMissing(['room_number' => '501']);
    }

    /**
     * Habitaciones con estado 'reservada', 'ocupada' o 'mantenimiento'
     * NO aparecen en el catálogo público de habitaciones disponibles.
     */
    public function test_rooms_with_non_available_statuses_are_not_returned(): void
    {
        Room::create([
            'room_number'     => '502',
            'name'            => 'Habitación Reservada por Recepción',
            'bed_type'        => 'king',
            'capacity'        => 2,
            'price_per_night' => 300.00,
            'status'          => 'reservada',
        ]);

        Room::create([
            'room_number'     => '503',
            'name'            => 'Habitación Ocupada',
            'bed_type'        => 'doble',
            'capacity'        => 2,
            'price_per_night' => 220.00,
            'status'          => 'ocupada',
        ]);

        $response = $this->getJson('/api/rooms/available');

        $response->assertStatus(200);
        $response->assertJsonMissing(['room_number' => '502']);
        $response->assertJsonMissing(['room_number' => '503']);
    }

    /**
     * Filtrar por rango de precios (min_price y max_price).
     */
    public function test_filter_by_price_range_returns_correct_rooms(): void
    {
        Room::create([
            'room_number'     => '601',
            'name'            => 'Económica',
            'bed_type'        => 'individual',
            'capacity'        => 1,
            'price_per_night' => 150.00,
            'status'          => 'disponible',
        ]);

        Room::create([
            'room_number'     => '602',
            'name'            => 'Media',
            'bed_type'        => 'doble',
            'capacity'        => 2,
            'price_per_night' => 300.00,
            'status'          => 'disponible',
        ]);

        Room::create([
            'room_number'     => '603',
            'name'            => 'Lujo',
            'bed_type'        => 'king',
            'capacity'        => 2,
            'price_per_night' => 600.00,
            'status'          => 'disponible',
        ]);

        // Filtrar entre 200 y 500
        $response = $this->getJson('/api/rooms/available?min_price=200&max_price=500');

        $response->assertStatus(200);
        $response->assertJsonFragment(['room_number' => '602']);
        $response->assertJsonMissing(['room_number' => '601']);
        $response->assertJsonMissing(['room_number' => '603']);
    }

    /**
     * Ordenamiento por precio descendente.
     */
    public function test_sort_by_price_desc_orders_correctly(): void
    {
        Room::create([
            'room_number'     => '701',
            'name'            => 'Barata',
            'bed_type'        => 'individual',
            'capacity'        => 1,
            'price_per_night' => 100.00,
            'status'          => 'disponible',
        ]);

        Room::create([
            'room_number'     => '702',
            'name'            => 'Cara',
            'bed_type'        => 'king',
            'capacity'        => 2,
            'price_per_night' => 900.00,
            'status'          => 'disponible',
        ]);

        $response = $this->getJson('/api/rooms/available?sort_by=price_desc');

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertEquals('702', $data[0]['room_number']);
        $this->assertEquals('701', $data[1]['room_number']);
    }

    /**
     * Búsqueda por término de palabra clave.
     */
    public function test_search_by_keyword_filters_by_name_or_description(): void
    {
        Room::create([
            'room_number'     => '801',
            'name'            => 'Suite Presidencial con Balcón',
            'bed_type'        => 'king',
            'capacity'        => 4,
            'price_per_night' => 800.00,
            'status'          => 'disponible',
        ]);

        Room::create([
            'room_number'     => '802',
            'name'            => 'Habitación Simple Jardín',
            'bed_type'        => 'individual',
            'capacity'        => 1,
            'price_per_night' => 150.00,
            'status'          => 'disponible',
        ]);

        $response = $this->getJson('/api/rooms/available?search=Presidencial');

        $response->assertStatus(200);
        $response->assertJsonFragment(['room_number' => '801']);
        $response->assertJsonMissing(['room_number' => '802']);
    }

    /**
     * Una reserva pending_payment vencida (expires_at pasado) no bloquea; una vigente sí.
     */
    public function test_expired_pending_booking_does_not_block_but_active_pending_does(): void
    {
        $room = Room::create([
            'room_number'     => '909',
            'name'            => 'Suite Pendiente',
            'description'     => 'Habitación para test',
            'bed_type'        => 'king',
            'capacity'        => 2,
            'size_m2'         => 40,
            'price_per_night' => 300.00,
            'status'          => 'disponible',
        ]);

        $guest = Guest::create([
            'name'            => 'Pedro',
            'surname'         => 'Ramos',
            'document_type'   => 'DNI',
            'document_number' => '99887766',
            'email'           => 'pedro@test.com',
        ]);

        $booking = Booking::create([
            'guest_id'     => $guest->id,
            'room_id'      => $room->id,
            'check_in'     => now()->addDays(20)->toDateString(),
            'check_out'    => now()->addDays(22)->toDateString(),
            'total_amount' => 600.00,
            'status'       => 'pending_payment',
            'expires_at'   => now()->subMinute(),
        ]);

        $url = '/api/rooms/available?check_in=' . now()->addDays(20)->toDateString()
            . '&check_out=' . now()->addDays(22)->toDateString();

        $this->getJson($url)->assertStatus(200)->assertJsonFragment(['room_number' => '909']);

        $booking->update(['expires_at' => now()->addMinutes(10)]);

        $this->getJson($url)->assertStatus(200)->assertJsonMissing(['room_number' => '909']);
    }
}
