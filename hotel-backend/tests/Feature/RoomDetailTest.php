<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Guest;
use App\Models\Room;
use App\Models\Season;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * SHE-023: detalle público de una habitación.
 */
class RoomDetailTest extends TestCase
{
    use RefreshDatabase;

    private function makeRoom(array $overrides = []): Room
    {
        return Room::create(array_merge([
            'room_number'     => '301',
            'name'            => 'Suite King Imperial',
            'bed_type'        => 'king',
            'capacity'        => 2,
            'size_m2'         => 40,
            'price_per_night' => 300.00,
            'status'          => 'disponible',
            'description'     => 'Suite con vista a la ciudad.',
            'image_url'       => '/storage/rooms/suite.jpg',
        ], $overrides));
    }

    public function test_public_can_view_room_detail_without_auth(): void
    {
        $room = $this->makeRoom();

        $response = $this->getJson("/api/rooms/{$room->id}");

        $response->assertOk()
            ->assertJsonStructure([
                'room' => [
                    'id', 'room_number', 'name', 'type', 'description', 'capacity', 'bed_type',
                    'price_per_night', 'season_price_today' => ['date', 'price', 'season'],
                    'upcoming_seasons', 'amenities' => [['key', 'label', 'icon']],
                    'images' => [['url', 'alt']], 'is_bookable', 'prices_include_igv',
                ],
            ])
            ->assertJsonPath('room.id', $room->id)
            ->assertJsonPath('room.capacity', 2)
            ->assertJsonPath('room.is_bookable', true)
            ->assertJsonPath('room.season_price_today.price', 300);

        $this->assertStringStartsWith('http', $response->json('room.images.0.url'));
    }

    public function test_room_detail_does_not_expose_internal_fields(): void
    {
        $room = $this->makeRoom();
        $guest = Guest::create([
            'name' => 'Ana', 'surname' => 'Secreta', 'document_type' => 'DNI',
            'document_number' => '12345678', 'email' => 'ana@example.com',
        ]);
        Booking::create([
            'guest_id' => $guest->id, 'room_id' => $room->id,
            'check_in' => now()->addDays(3)->toDateString(), 'check_out' => now()->addDays(5)->toDateString(),
            'total_amount' => 600, 'status' => 'confirmed',
        ]);

        $response = $this->getJson("/api/rooms/{$room->id}")->assertOk();

        $data = $response->json('room');
        $this->assertArrayNotHasKey('status', $data);
        $this->assertArrayNotHasKey('bookings', $data);
        $this->assertArrayNotHasKey('created_at', $data);
        $this->assertArrayNotHasKey('updated_at', $data);
        $this->assertStringNotContainsString('Secreta', $response->getContent());
        $this->assertStringNotContainsString('ana@example.com', $response->getContent());
    }

    public function test_room_detail_applies_active_season_and_lists_upcoming(): void
    {
        $room = $this->makeRoom();
        Season::create([
            'name' => 'Temporada Alta', 'start_date' => now()->subDay()->toDateString(),
            'end_date' => now()->addDays(10)->toDateString(), 'rate_adjustment' => 20, 'is_active' => true,
        ]);
        Season::create([
            'name' => 'Inactiva', 'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(10)->toDateString(), 'rate_adjustment' => 50, 'is_active' => false,
        ]);

        $this->getJson("/api/rooms/{$room->id}")
            ->assertOk()
            ->assertJsonPath('room.season_price_today.price', 360)
            ->assertJsonPath('room.season_price_today.season', 'Temporada Alta')
            ->assertJsonCount(1, 'room.upcoming_seasons')
            ->assertJsonPath('room.upcoming_seasons.0.price_per_night', 360);
    }

    public function test_room_in_maintenance_or_missing_returns_404(): void
    {
        $room = $this->makeRoom(['status' => 'mantenimiento']);

        $this->getJson("/api/rooms/{$room->id}")->assertNotFound()->assertJsonStructure(['message']);
        $this->getJson('/api/rooms/999999')->assertNotFound();
        $this->getJson('/api/rooms/abc')->assertNotFound();
    }
}
