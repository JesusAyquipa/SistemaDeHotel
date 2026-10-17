<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

class StaffManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Role::create(['name' => 'admin', 'guard_name' => 'web']);
        Role::create(['name' => 'recepcionista', 'guard_name' => 'web']);
        Role::create(['name' => 'cliente', 'guard_name' => 'web']);

        // La gestión de cuentas de personal es exclusiva del rol admin
        $this->admin = User::factory()->create(['is_active' => true]);
        $this->admin->assignRole('admin');
        Sanctum::actingAs($this->admin);
    }

    public function test_can_list_staff_members(): void
    {
        $user = User::factory()->create(['name' => 'Maria Recepcion']);
        $user->assignRole('recepcionista');

        $response = $this->getJson('/api/staff');

        $response->assertStatus(200)
                 ->assertJsonStructure(['status', 'data'])
                 ->assertJsonFragment(['name' => 'Maria Recepcion']);
    }

    public function test_can_create_staff_member(): void
    {
        $payload = [
            'name' => 'Juan Perez',
            'email' => 'juan@hotel.com',
            'password' => 'secret1234',
            'role' => 'recepcionista',
            'is_active' => true,
        ];

        $response = $this->postJson('/api/staff', $payload);

        $response->assertStatus(201)
                 ->assertJsonFragment(['email' => 'juan@hotel.com']);

        $this->assertDatabaseHas('users', [
            'email' => 'juan@hotel.com',
            'is_active' => 1,
        ]);
    }

    public function test_can_update_staff_member(): void
    {
        $user = User::factory()->create(['name' => 'Pedro Antiguo']);
        $user->assignRole('recepcionista');

        $payload = [
            'name' => 'Pedro Actualizado',
            'email' => $user->email,
            'role' => 'admin',
        ];

        $response = $this->putJson("/api/staff/{$user->id}", $payload);

        $response->assertStatus(200)
                 ->assertJsonFragment(['name' => 'Pedro Actualizado', 'primary_role' => 'admin']);
    }

    public function test_can_toggle_staff_active_status(): void
    {
        $user = User::factory()->create(['is_active' => true]);

        // Desactivar
        $response = $this->patchJson("/api/staff/{$user->id}/toggle-status");
        $response->assertStatus(200)
                 ->assertJsonFragment(['is_active' => false]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'is_active' => 0,
        ]);

        // Activar nuevamente
        $response2 = $this->patchJson("/api/staff/{$user->id}/toggle-status");
        $response2->assertStatus(200)
                  ->assertJsonFragment(['is_active' => true]);
    }

    public function test_staff_password_must_have_at_least_8_characters(): void
    {
        $response = $this->postJson('/api/staff', [
            'name' => 'Clave Corta',
            'email' => 'corta@hotel.com',
            'password' => 'abc123',
            'role' => 'recepcionista',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors(['password']);
    }

    public function test_invalid_role_filter_returns_422_instead_of_500(): void
    {
        $this->getJson('/api/staff?role=superusuario')
             ->assertStatus(422)
             ->assertJsonValidationErrors(['role']);
    }

    public function test_admin_cannot_deactivate_themselves(): void
    {
        $this->patchJson("/api/staff/{$this->admin->id}/toggle-status")
             ->assertStatus(422);

        $this->assertDatabaseHas('users', ['id' => $this->admin->id, 'is_active' => 1]);
    }

    public function test_admin_cannot_remove_own_admin_role(): void
    {
        $this->putJson("/api/staff/{$this->admin->id}", [
            'name' => $this->admin->name,
            'email' => $this->admin->email,
            'role' => 'recepcionista',
        ])->assertStatus(422);

        $this->assertTrue($this->admin->fresh()->hasRole('admin'));
    }
}
