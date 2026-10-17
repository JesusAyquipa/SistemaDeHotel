<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomType;
use App\Models\Season;
use App\Models\User;
use App\Services\BookingPricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * SHE-034: tipos de habitación, tarifas por tipo y temporadas por tipo.
 */
class RoomTypeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['admin', 'recepcionista', 'cliente'] as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }

    private function makeType(array $attrs = []): RoomType
    {
        return RoomType::create(array_merge([
            'name' => 'Suite', 'slug' => 'suite', 'base_price' => 400, 'capacity' => 2,
            'bed_type' => 'king', 'amenities' => ['wifi', 'minibar'], 'active' => true,
        ], $attrs));
    }

    private function makeRoom(array $attrs = []): Room
    {
        return Room::create(array_merge([
            'room_number' => (string) random_int(100, 999), 'name' => 'Hab', 'bed_type' => 'king',
            'capacity' => 2, 'price_per_night' => null, 'status' => 'disponible',
        ], $attrs));
    }

    public function test_admin_can_crud_room_types(): void
    {
        $this->actingAsRole('admin');

        $res = $this->postJson('/api/staff/room-types', [
            'name' => 'Junior Suite', 'base_price' => 350, 'capacity' => 2,
            'bed_type' => 'king', 'amenities' => ['wifi', 'tv'], 'description' => 'Test',
        ])->assertCreated()
            ->assertJsonPath('room_type.slug', 'junior-suite')
            ->assertJsonPath('room_type.amenities', ['wifi', 'tv']);
        $id = $res->json('room_type.id');

        $this->getJson('/api/staff/room-types')->assertOk()
            ->assertJsonPath('room_types.0.name', 'Junior Suite')
            ->assertJsonStructure(['amenity_catalog' => [['key', 'label', 'icon']]]);

        $this->putJson("/api/staff/room-types/{$id}", ['base_price' => 380, 'active' => false])
            ->assertOk()
            ->assertJsonPath('room_type.base_price', '380.00')
            ->assertJsonPath('room_type.active', false);

        $this->deleteJson("/api/staff/room-types/{$id}")->assertOk();
        $this->assertDatabaseMissing('room_types', ['id' => $id]);
    }

    public function test_room_type_validation_rejects_unknown_amenity_and_duplicate_name(): void
    {
        $this->actingAsRole('admin');
        $this->makeType();

        $this->postJson('/api/staff/room-types', [
            'name' => 'Suite', 'base_price' => 100, 'capacity' => 1, 'amenities' => ['jacuzzi_volador'],
        ])->assertStatus(422)->assertJsonValidationErrors(['name', 'amenities.0']);
    }

    public function test_cannot_delete_room_type_with_rooms(): void
    {
        $this->actingAsRole('admin');
        $type = $this->makeType();
        $this->makeRoom(['room_type_id' => $type->id]);

        $this->deleteJson("/api/staff/room-types/{$type->id}")
            ->assertStatus(409)
            ->assertJsonStructure(['message']);
        $this->assertDatabaseHas('room_types', ['id' => $type->id]);
    }

    public function test_room_type_roles(): void
    {
        $type = $this->makeType();

        $this->actingAsRole('recepcionista');
        $this->getJson('/api/staff/room-types')->assertOk();
        $this->getJson("/api/staff/room-types/{$type->id}")->assertOk();
        $this->postJson('/api/staff/room-types', ['name' => 'X', 'base_price' => 1, 'capacity' => 1])->assertForbidden();
        $this->putJson("/api/staff/room-types/{$type->id}", ['base_price' => 1])->assertForbidden();
        $this->deleteJson("/api/staff/room-types/{$type->id}")->assertForbidden();

        $this->actingAsRole('cliente');
        $this->getJson('/api/staff/room-types')->assertForbidden();
    }

    public function test_unauthenticated_cannot_access_staff_room_types(): void
    {
        $this->getJson('/api/staff/room-types')->assertUnauthorized();
    }

    public function test_public_room_types_lists_only_active(): void
    {
        $this->makeType();
        $this->makeType(['name' => 'Oculto', 'slug' => 'oculto', 'active' => false]);

        $this->getJson('/api/room-types')->assertOk()
            ->assertJsonCount(1, 'room_types')
            ->assertJsonPath('room_types.0.slug', 'suite')
            ->assertJsonPath('room_types.0.amenities.0.key', 'wifi')
            ->assertJsonPath('room_types.0.amenities.0.icon', 'wifi');
    }

    public function test_effective_price_uses_override_or_type_base_price(): void
    {
        $type = $this->makeType(['base_price' => 400]);
        $inherit = $this->makeRoom(['room_number' => '301', 'room_type_id' => $type->id]);
        $override = $this->makeRoom(['room_number' => '302', 'room_type_id' => $type->id, 'price_per_night' => 550]);
        $legacy = $this->makeRoom(['room_number' => '303', 'price_per_night' => 120]);

        $this->assertSame(400.0, $inherit->fresh()->effective_price);
        $this->assertSame(550.0, $override->fresh()->effective_price);
        $this->assertSame(120.0, $legacy->fresh()->effective_price);

        // JSON: price_per_night = efectivo (compatibilidad), price_override = crudo
        $json = $inherit->fresh()->toArray();
        $this->assertSame(400.0, $json['price_per_night']);
        $this->assertNull($json['price_override']);
    }

    public function test_pricing_quote_uses_type_base_price_override_and_type_season(): void
    {
        $suite = $this->makeType(['base_price' => 400]);
        $doble = $this->makeType(['name' => 'Doble', 'slug' => 'doble', 'base_price' => 200]);
        $inherit = $this->makeRoom(['room_number' => '401', 'room_type_id' => $suite->id]);
        $override = $this->makeRoom(['room_number' => '402', 'room_type_id' => $suite->id, 'price_per_night' => 500]);
        $other = $this->makeRoom(['room_number' => '403', 'room_type_id' => $doble->id]);

        $in = now()->addDays(30)->startOfDay();
        $out = $in->copy()->addDays(2);

        // Temporada solo para Suite (+50%) y general (+10%) que se cruzan: gana la del tipo
        Season::create(['name' => 'Suite alta', 'start_date' => $in, 'end_date' => $in, 'rate_adjustment' => 50, 'is_active' => true, 'room_type_id' => $suite->id]);
        Season::create(['name' => 'General', 'start_date' => $in, 'end_date' => $out, 'rate_adjustment' => 10, 'is_active' => true]);

        $pricing = app(BookingPricingService::class);

        $q1 = $pricing->quote($inherit, $in, $out);
        $this->assertSame(400.0, $q1['price_per_night']);
        $this->assertEquals([600.0, 440.0], array_column($q1['nightly'], 'price'));
        $this->assertSame('Suite alta', $q1['nightly'][0]['season']);

        $q2 = $pricing->quote($override, $in, $out);
        $this->assertEquals([750.0, 550.0], array_column($q2['nightly'], 'price'));

        // Otro tipo: solo aplica la temporada general
        $q3 = $pricing->quote($other, $in, $out);
        $this->assertEquals([220.0, 220.0], array_column($q3['nightly'], 'price'));
    }

    public function test_available_filters_by_type_and_effective_price(): void
    {
        $suite = $this->makeType(['base_price' => 400]);
        $doble = $this->makeType(['name' => 'Doble', 'slug' => 'doble', 'base_price' => 200]);
        $this->makeRoom(['room_number' => '501', 'room_type_id' => $suite->id]);
        $this->makeRoom(['room_number' => '502', 'room_type_id' => $doble->id]);
        $this->makeRoom(['room_number' => '503', 'room_type_id' => $doble->id, 'price_per_night' => 260]);

        $this->getJson('/api/rooms/available?room_type_id=' . $suite->id)
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.room_number', '501')
            ->assertJsonPath('0.room_type.name', 'Suite');

        $this->getJson('/api/rooms/available?room_type=doble&sort_by=price_desc')
            ->assertOk()->assertJsonCount(2)
            ->assertJsonPath('0.room_number', '503')
            ->assertJsonPath('1.price_per_night', 200);

        // max_price usa el precio efectivo (tipo)
        $this->getJson('/api/rooms/available?max_price=250')
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.room_number', '502');
    }

    public function test_admin_creates_room_with_type_and_without_price(): void
    {
        $this->actingAsRole('admin');
        $type = $this->makeType(['base_price' => 400, 'bed_type' => 'king']);

        $this->postJson('/api/staff/rooms', [
            'room_number' => '601', 'name' => 'Suite 601', 'room_type_id' => $type->id,
            'capacity' => 2, 'status' => 'disponible', 'extra_amenities' => ['balcony'],
        ])->assertCreated()
            ->assertJsonPath('room.price_per_night', 400)
            ->assertJsonPath('room.price_override', null)
            ->assertJsonPath('room.bed_type', 'king')
            ->assertJsonPath('room.extra_amenities', ['balcony']);

        // Sin tipo, la tarifa sigue siendo obligatoria
        $this->postJson('/api/staff/rooms', [
            'room_number' => '602', 'name' => 'Sin tipo', 'bed_type' => 'doble',
            'capacity' => 2, 'status' => 'disponible',
        ])->assertStatus(422)->assertJsonValidationErrors(['price_per_night']);
    }

    public function test_season_can_be_scoped_to_room_type(): void
    {
        $this->actingAsRole('admin');
        $type = $this->makeType();

        $this->postJson('/api/settings/seasons', [
            'name' => 'Suite Navidad', 'start_date' => '2027-12-20', 'end_date' => '2027-12-31',
            'rate_adjustment' => 25, 'room_type_id' => $type->id,
        ])->assertCreated()->assertJsonPath('room_type_id', $type->id);

        $this->postJson('/api/settings/seasons', [
            'name' => 'Mala', 'start_date' => '2027-12-20', 'end_date' => '2027-12-31',
            'rate_adjustment' => 25, 'room_type_id' => 9999,
        ])->assertStatus(422);
    }

    public function test_report_groups_revenue_by_room_type_name(): void
    {
        $this->actingAsRole('admin');
        $type = $this->makeType(['name' => 'Suite Real']);
        $room = $this->makeRoom(['room_type_id' => $type->id]);
        $guest = \App\Models\Guest::create(['name' => 'A', 'surname' => 'B', 'email' => 'a@b.com', 'document_type' => 'DNI', 'document_number' => '12345678', 'phone' => '999']);
        $booking = \App\Models\Booking::create([
            'guest_id' => $guest->id, 'room_id' => $room->id, 'check_in' => now()->toDateString(),
            'check_out' => now()->addDay()->toDateString(), 'total_amount' => 400, 'status' => 'confirmed',
        ]);
        \App\Models\Payment::create([
            'booking_id' => $booking->id, 'amount' => 400, 'payment_method' => 'cash',
            'status' => \App\Models\Payment::STATUS_COMPLETED,
        ]);

        $types = collect($this->getJson('/api/staff/reports/stats')->assertOk()->json('revenue_by_room_type'));
        $this->assertNotNull($types->firstWhere('room_type', 'Suite Real'));
    }
}
