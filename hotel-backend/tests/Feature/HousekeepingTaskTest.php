<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Guest;
use App\Models\HousekeepingTask;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * SHE-032: tareas de housekeeping (auto-limpieza al check-out, flujo e inspección).
 */
class HousekeepingTaskTest extends TestCase
{
    use RefreshDatabase;

    private User $receptionist;
    private User $admin;
    private Room $room;

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
            'room_number' => '301', 'name' => 'Suite', 'bed_type' => 'king',
            'capacity' => 2, 'price_per_night' => 200, 'status' => 'ocupada',
        ]);
    }

    private function checkedInBooking(): Booking
    {
        $guest = Guest::create([
            'name' => 'Raúl', 'surname' => 'Díaz', 'document_type' => 'DNI',
            'document_number' => '12121212', 'email' => 'raul@example.com',
        ]);

        return Booking::create([
            'guest_id' => $guest->id, 'room_id' => $this->room->id,
            'check_in' => now()->subDays(2)->toDateString(), 'check_out' => now()->toDateString(),
            'total_amount' => 0, 'status' => Booking::STATUS_CHECKED_IN,
        ]);
    }

    public function test_full_flow_checkout_creates_task_and_inspection_releases_room(): void
    {
        $booking = $this->checkedInBooking();
        Sanctum::actingAs($this->receptionist);

        $this->postJson("/api/staff/bookings/{$booking->booking_code}/check-out")->assertOk();
        $this->assertDatabaseHas('rooms', ['id' => $this->room->id, 'status' => 'limpieza']);

        $task = HousekeepingTask::where('room_id', $this->room->id)->first();
        $this->assertNotNull($task, 'El check-out debe crear una tarea de limpieza');
        $this->assertSame('cleaning', $task->type);
        $this->assertSame('pending', $task->status);
        $this->assertSame($booking->id, $task->booking_id);

        // Listado por defecto (abiertas)
        $this->getJson('/api/staff/housekeeping/tasks')
            ->assertOk()
            ->assertJsonPath('tasks.0.id', $task->id)
            ->assertJsonPath('tasks.0.room.room_number', '301');

        // No se puede finalizar ni inspeccionar antes de iniciar
        $this->postJson("/api/staff/housekeeping/tasks/{$task->id}/finish")->assertStatus(422);
        $this->postJson("/api/staff/housekeeping/tasks/{$task->id}/inspect")->assertStatus(422);

        $this->postJson("/api/staff/housekeeping/tasks/{$task->id}/start")
            ->assertOk()
            ->assertJsonPath('task.status', 'in_progress')
            ->assertJsonPath('task.assigned_to', $this->receptionist->id);

        $this->postJson("/api/staff/housekeeping/tasks/{$task->id}/finish")
            ->assertOk()
            ->assertJsonPath('task.status', 'done');
        $this->assertDatabaseHas('rooms', ['id' => $this->room->id, 'status' => 'limpieza']);

        $this->postJson("/api/staff/housekeeping/tasks/{$task->id}/inspect", ['notes' => 'Todo correcto'])
            ->assertOk()
            ->assertJsonPath('task.status', 'inspected')
            ->assertJsonPath('task.inspected_by', $this->receptionist->id)
            ->assertJsonPath('room_released', true);

        $this->assertDatabaseHas('rooms', ['id' => $this->room->id, 'status' => 'disponible']);
        $task->refresh();
        $this->assertNotNull($task->started_at);
        $this->assertNotNull($task->finished_at);
        $this->assertNotNull($task->inspected_at);
    }

    public function test_checkout_does_not_duplicate_open_cleaning_task(): void
    {
        HousekeepingTask::create(['room_id' => $this->room->id, 'type' => 'cleaning', 'status' => 'pending']);
        $booking = $this->checkedInBooking();
        Sanctum::actingAs($this->receptionist);

        $this->postJson("/api/staff/bookings/{$booking->booking_code}/check-out")->assertOk();

        $this->assertSame(1, HousekeepingTask::where('room_id', $this->room->id)->count());
    }

    public function test_inspection_does_not_release_room_with_guest_checked_in(): void
    {
        $this->checkedInBooking();
        $task = HousekeepingTask::create(['room_id' => $this->room->id, 'type' => 'cleaning', 'status' => 'done']);
        Sanctum::actingAs($this->admin);

        $this->postJson("/api/staff/housekeeping/tasks/{$task->id}/inspect")
            ->assertOk()
            ->assertJsonPath('room_released', false);

        $this->assertDatabaseHas('rooms', ['id' => $this->room->id, 'status' => 'ocupada']);
    }

    public function test_create_and_assign_rules_by_role(): void
    {
        $other = User::factory()->create(['is_active' => true]);
        $other->assignRole('recepcionista');
        $client = User::factory()->create(['is_active' => true]);
        $client->assignRole('cliente');

        // Recepcionista: crea y se asigna a sí mismo, pero no a otros
        Sanctum::actingAs($this->receptionist);
        $taskId = $this->postJson('/api/staff/housekeeping/tasks', [
            'room_id' => $this->room->id, 'type' => 'maintenance', 'notes' => 'Grifo gotea',
        ])->assertStatus(201)->assertJsonPath('task.status', 'pending')->json('task.id');

        $this->postJson('/api/staff/housekeeping/tasks', ['room_id' => $this->room->id, 'type' => 'demolition'])
            ->assertStatus(422);

        $this->patchJson("/api/staff/housekeeping/tasks/{$taskId}/assign", ['assigned_to' => $other->id])
            ->assertStatus(403);
        $this->patchJson("/api/staff/housekeeping/tasks/{$taskId}/assign", ['assigned_to' => $this->receptionist->id])
            ->assertOk()
            ->assertJsonPath('task.assignee.id', $this->receptionist->id);

        $this->getJson('/api/staff/housekeeping/tasks?assigned_to=me')
            ->assertOk()
            ->assertJsonCount(1, 'tasks');

        // Admin: asigna a cualquier miembro activo del personal, pero no a clientes
        Sanctum::actingAs($this->admin);
        $this->patchJson("/api/staff/housekeeping/tasks/{$taskId}/assign", ['assigned_to' => $other->id])
            ->assertOk()
            ->assertJsonPath('task.assigned_to', $other->id);
        $this->patchJson("/api/staff/housekeeping/tasks/{$taskId}/assign", ['assigned_to' => $client->id])
            ->assertStatus(422);
        $this->patchJson('/api/staff/housekeeping/tasks/99999/assign', ['assigned_to' => null])
            ->assertStatus(404);

        $this->getJson("/api/staff/housekeeping/tasks?assigned_to={$other->id}&status=pending")
            ->assertOk()
            ->assertJsonCount(1, 'tasks');

        // Cliente: sin acceso
        Sanctum::actingAs($client);
        $this->getJson('/api/staff/housekeeping/tasks')->assertStatus(403);
        $this->postJson("/api/staff/housekeeping/tasks/{$taskId}/start")->assertStatus(403);
    }

    public function test_list_filters_by_status_and_date(): void
    {
        HousekeepingTask::create(['room_id' => $this->room->id, 'type' => 'cleaning', 'status' => 'pending']);
        $old = HousekeepingTask::create(['room_id' => $this->room->id, 'type' => 'inspection', 'status' => 'inspected', 'inspected_at' => now()->subDays(3)]);
        $old->forceFill(['created_at' => now()->subDays(3)])->save();
        Sanctum::actingAs($this->receptionist);

        $this->getJson('/api/staff/housekeeping/tasks')->assertOk()->assertJsonCount(1, 'tasks');
        $this->getJson('/api/staff/housekeeping/tasks?status=inspected')->assertOk()->assertJsonCount(1, 'tasks');
        $this->getJson('/api/staff/housekeeping/tasks?date=' . now()->subDays(3)->toDateString())
            ->assertOk()
            ->assertJsonCount(1, 'tasks')
            ->assertJsonPath('tasks.0.id', $old->id);
        $this->getJson('/api/staff/housekeeping/tasks?status=bogus')->assertStatus(422);
    }
}
