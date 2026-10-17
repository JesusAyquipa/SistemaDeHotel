<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Verifica el control de acceso por rol definido en routes/api.php y
 * routes/api/staff.php (contrato de la API).
 */
class AuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['admin', 'recepcionista', 'cliente'] as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    private function makeRoom(): Room
    {
        return Room::create([
            'room_number'     => '901',
            'name'            => 'Habitación de Pruebas',
            'bed_type'        => 'doble',
            'capacity'        => 2,
            'price_per_night' => 200.00,
            'status'          => 'disponible',
        ]);
    }

    // ── Sin autenticación ─────────────────────────────────────────────

    public function test_unauthenticated_requests_get_401_json(): void
    {
        $this->getJson('/api/staff')->assertStatus(401);
        $this->getJson('/api/staff/bookings')->assertStatus(401);
        $this->getJson('/api/guests/search?query=ab')->assertStatus(401);
        $this->postJson('/api/settings/coupons', [])->assertStatus(401);
        $this->getJson('/api/me')->assertStatus(401);
        $this->postJson('/api/bookings', [])->assertStatus(401);
    }

    public function test_unauthenticated_request_without_accept_header_does_not_redirect(): void
    {
        $this->get('/api/me')->assertStatus(401);
    }

    public function test_removed_user_route_no_longer_exists(): void
    {
        Sanctum::actingAs($this->userWithRole('cliente'));

        $this->getJson('/api/user')->assertStatus(404);
    }

    // ── Cliente ────────────────────────────────────────────────────────

    public function test_cliente_cannot_create_staff_accounts(): void
    {
        Sanctum::actingAs($this->userWithRole('cliente'));

        $this->postJson('/api/staff', [
            'name'     => 'Intruso',
            'email'    => 'intruso@example.com',
            'password' => 'password-segura',
            'role'     => 'admin',
        ])->assertStatus(403);

        $this->assertDatabaseMissing('users', ['email' => 'intruso@example.com']);
    }

    public function test_cliente_cannot_list_staff_bookings(): void
    {
        Sanctum::actingAs($this->userWithRole('cliente'));

        $this->getJson('/api/staff/bookings')->assertStatus(403);
    }

    public function test_cliente_cannot_create_coupons(): void
    {
        Sanctum::actingAs($this->userWithRole('cliente'));

        $this->postJson('/api/settings/coupons', [
            'code'           => 'HACK100',
            'discount_type'  => 'percentage',
            'discount_value' => 100,
            'expires_at'     => now()->addYear()->toDateString(),
        ])->assertStatus(403);

        $this->assertDatabaseMissing('coupons', ['code' => 'HACK100']);
    }

    public function test_cliente_cannot_search_guests(): void
    {
        Sanctum::actingAs($this->userWithRole('cliente'));

        $this->getJson('/api/guests/search?query=ab')->assertStatus(403);
    }

    public function test_cliente_cannot_read_settings(): void
    {
        Sanctum::actingAs($this->userWithRole('cliente'));

        $this->getJson('/api/settings')->assertStatus(403);
    }

    // ── Recepcionista ──────────────────────────────────────────────────

    public function test_recepcionista_cannot_create_staff_accounts(): void
    {
        Sanctum::actingAs($this->userWithRole('recepcionista'));

        $this->postJson('/api/staff', [
            'name'     => 'Nuevo Admin',
            'email'    => 'nuevo.admin@example.com',
            'password' => 'password-segura',
            'role'     => 'admin',
        ])->assertStatus(403);

        $this->assertDatabaseMissing('users', ['email' => 'nuevo.admin@example.com']);
    }

    public function test_recepcionista_cannot_delete_rooms(): void
    {
        $room = $this->makeRoom();
        Sanctum::actingAs($this->userWithRole('recepcionista'));

        $this->deleteJson("/api/staff/rooms/{$room->id}")->assertStatus(403);

        $this->assertDatabaseHas('rooms', ['id' => $room->id]);
    }

    public function test_recepcionista_cannot_create_coupons(): void
    {
        Sanctum::actingAs($this->userWithRole('recepcionista'));

        $this->postJson('/api/settings/coupons', [
            'code'           => 'RECEP10',
            'discount_type'  => 'percentage',
            'discount_value' => 10,
            'expires_at'     => now()->addYear()->toDateString(),
        ])->assertStatus(403);
    }

    public function test_recepcionista_can_use_staff_endpoints(): void
    {
        $this->makeRoom();
        Sanctum::actingAs($this->userWithRole('recepcionista'));

        $this->getJson('/api/staff/rooms')->assertStatus(200);
        $this->getJson('/api/guests/search?query=ab')->assertStatus(200);
        $this->getJson('/api/settings')->assertStatus(200);
    }

    // ── Admin ──────────────────────────────────────────────────────────

    public function test_admin_can_create_staff_accounts(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->postJson('/api/staff', [
            'name'      => 'Recepción Nueva',
            'email'     => 'recepcion.nueva@example.com',
            'password'  => 'password-segura',
            'role'      => 'recepcionista',
            'is_active' => true,
        ])->assertStatus(201);

        $this->assertDatabaseHas('users', ['email' => 'recepcion.nueva@example.com']);
    }

    public function test_admin_can_create_coupon_but_percentage_cannot_exceed_100(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->postJson('/api/settings/coupons', [
            'code'           => 'DEMASIADO',
            'discount_type'  => 'percentage',
            'discount_value' => 150,
            'expires_at'     => now()->addYear()->toDateString(),
        ])->assertStatus(422);

        $this->postJson('/api/settings/coupons', [
            'code'           => 'VALIDO20',
            'discount_type'  => 'percentage',
            'discount_value' => 20,
            'expires_at'     => now()->addYear()->toDateString(),
        ])->assertStatus(201);

        $this->assertDatabaseHas('coupons', ['code' => 'VALIDO20']);
    }

    // ── Validación pública de cupones ─────────────────────────────────

    public function test_coupon_is_valid_through_the_whole_expiry_day(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));
        $this->postJson('/api/settings/coupons', [
            'code'           => 'HOYVENCE',
            'discount_type'  => 'fixed',
            'discount_value' => 10,
            'expires_at'     => now()->toDateString(),
        ])->assertStatus(201);

        $this->postJson('/api/coupons/validate', ['code' => 'HOYVENCE'])
             ->assertStatus(200)
             ->assertJsonPath('coupon.code', 'HOYVENCE');
    }

    public function test_unknown_coupon_returns_generic_message(): void
    {
        $this->postJson('/api/coupons/validate', ['code' => 'NOEXISTE'])
             ->assertStatus(422)
             ->assertJsonStructure(['message']);
    }
}
