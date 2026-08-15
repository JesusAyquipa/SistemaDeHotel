<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use Spatie\Permission\Models\Role;

class StaffManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::create(['name' => 'admin', 'guard_name' => 'web']);
        Role::create(['name' => 'recepcionista', 'guard_name' => 'web']);
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
            'password' => 'secret123',
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
}
