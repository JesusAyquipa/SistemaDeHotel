<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\Guest;
use App\Models\Room;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * SHE-021: bitácora de auditoría.
 */
class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['admin', 'recepcionista', 'cliente'] as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }
    }

    private function userWithRole(string $role, array $attrs = []): User
    {
        $user = User::factory()->create(array_merge(['is_active' => true], $attrs));
        $user->assignRole($role);

        return $user;
    }

    private function makeRoom(string $number = '301'): Room
    {
        return Room::create([
            'room_number'     => $number,
            'name'            => 'Habitación Auditoría',
            'bed_type'        => 'doble',
            'capacity'        => 2,
            'price_per_night' => 150,
            'status'          => 'disponible',
        ]);
    }

    private function makeBooking(Room $room): Booking
    {
        $guest = Guest::create([
            'name'            => 'Ana',
            'surname'         => 'Torres',
            'document_type'   => 'DNI',
            'document_number' => '44556677',
            'email'           => 'ana@example.com',
        ]);

        return Booking::create([
            'guest_id'     => $guest->id,
            'room_id'      => $room->id,
            'check_in'     => now()->addDays(10)->toDateString(),
            'check_out'    => now()->addDays(12)->toDateString(),
            'total_amount' => 300,
            'status'       => Booking::STATUS_CONFIRMED,
        ]);
    }

    public function test_room_update_is_logged_with_old_and_new_values_and_author(): void
    {
        $admin = $this->userWithRole('admin');
        Sanctum::actingAs($admin);
        $room = $this->makeRoom();

        $this->putJson("/api/staff/rooms/{$room->id}", [
            'room_number'     => '301',
            'name'            => 'Habitación Renovada',
            'bed_type'        => 'doble',
            'capacity'        => 2,
            'price_per_night' => 180,
            'status'          => 'disponible',
        ])->assertOk();

        $log = ActivityLog::where('action', 'updated')
            ->where('subject_type', 'Room')
            ->where('subject_id', $room->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($log);
        $this->assertSame($admin->id, $log->user_id);
        $this->assertSame('Habitación Auditoría', $log->changes['old']['name']);
        $this->assertSame('Habitación Renovada', $log->changes['new']['name']);
        $this->assertArrayNotHasKey('updated_at', $log->changes['new']);
    }

    public function test_booking_create_and_update_are_logged(): void
    {
        $room = $this->makeRoom();
        $booking = $this->makeBooking($room);

        $this->assertDatabaseHas('activity_logs', [
            'action'       => 'created',
            'subject_type' => 'Booking',
            'subject_id'   => $booking->id,
        ]);

        $booking->update(['total_amount' => 350]);

        $log = ActivityLog::where('action', 'updated')->where('subject_type', 'Booking')->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertEquals(350, $log->changes['new']['total_amount']);
        $this->assertStringContainsString($booking->booking_code, $log->description);
    }

    public function test_login_is_logged_without_password(): void
    {
        $user = $this->userWithRole('recepcionista', [
            'email'    => 'recep@example.com',
            'password' => Hash::make('secreto-123'),
        ]);

        $this->postJson('/api/login', ['email' => 'recep@example.com', 'password' => 'secreto-123'])
            ->assertOk();
        $this->postJson('/api/login', ['email' => 'recep@example.com', 'password' => 'clave-incorrecta'])
            ->assertStatus(422);

        $this->assertDatabaseHas('activity_logs', ['action' => 'login', 'user_id' => $user->id]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'login_failed']);

        foreach (ActivityLog::all() as $log) {
            $serialized = json_encode($log->toArray());
            $this->assertStringNotContainsString('secreto-123', $serialized);
            $this->assertStringNotContainsString('clave-incorrecta', $serialized);
        }
    }

    public function test_sensitive_fields_are_excluded_from_changes(): void
    {
        $user = $this->userWithRole('cliente');
        $user->update(['password' => Hash::make('otra-clave-999'), 'name' => 'Nuevo Nombre']);

        $log = ActivityLog::where('action', 'updated')->where('subject_type', 'User')->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertArrayHasKey('name', $log->changes['new']);
        $this->assertArrayNotHasKey('password', $log->changes['new']);
        $this->assertArrayNotHasKey('password', $log->changes['old']);

        $created = ActivityLog::where('action', 'created')->where('subject_type', 'User')->first();
        $this->assertArrayNotHasKey('password', $created->changes['new']);
        $this->assertArrayNotHasKey('remember_token', $created->changes['new']);

        $clean = ActivityLogger::sanitize([
            'card_number' => '4111111111111111',
            'card_cvc'    => '123',
            'nested'      => ['password' => 'x', 'ok' => 1],
            'amount'      => 10,
        ]);
        $this->assertSame(['nested' => ['ok' => 1], 'amount' => 10], $clean);
    }

    public function test_admin_can_list_and_filter_activity_logs(): void
    {
        $admin = $this->userWithRole('admin');
        Sanctum::actingAs($admin);
        $this->makeRoom('401');
        $this->makeBooking($this->makeRoom('402'));

        $response = $this->getJson('/api/staff/activity-logs?subject_type=Room&action=created');
        $response->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonPath('per_page', 25)
            ->assertJsonStructure(['data' => [['id', 'action', 'subject_type', 'subject_id', 'description', 'changes', 'ip_address', 'created_at', 'user' => ['id', 'name', 'email']]]]);

        $this->getJson('/api/staff/activity-logs?search=402')
            ->assertOk()
            ->assertJsonPath('data.0.subject_type', 'Room');

        $this->getJson('/api/staff/activity-logs?date_from=' . now()->addDay()->toDateString())
            ->assertOk()
            ->assertJsonPath('total', 0);
    }

    public function test_admin_can_export_csv(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));
        $this->makeRoom('=501');

        $response = $this->get('/api/staff/activity-logs/export');
        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));

        $csv = $response->streamedContent();
        $this->assertStringContainsString('Fecha', $csv);
        $this->assertStringContainsString('Habitación', $csv);
    }

    public function test_receptionist_and_client_cannot_access_activity_logs(): void
    {
        Sanctum::actingAs($this->userWithRole('recepcionista'));
        $this->getJson('/api/staff/activity-logs')->assertForbidden();
        $this->getJson('/api/staff/activity-logs/export')->assertForbidden();

        Sanctum::actingAs($this->userWithRole('cliente'));
        $this->getJson('/api/staff/activity-logs')->assertForbidden();
    }

    public function test_logging_failure_does_not_break_the_request(): void
    {
        \Illuminate\Support\Facades\Schema::drop('activity_logs');

        $room = $this->makeRoom('601');
        $room->update(['name' => 'Sigue funcionando']);

        $this->assertDatabaseHas('rooms', ['id' => $room->id, 'name' => 'Sigue funcionando']);
    }
}
