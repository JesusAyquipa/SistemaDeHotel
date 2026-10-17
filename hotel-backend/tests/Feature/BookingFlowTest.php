<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Coupon;
use App\Models\Guest;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class BookingFlowTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;
    private User $owner;
    private User $otherClient;
    private User $receptionist;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Role::create(['name' => 'admin', 'guard_name' => 'web']);
        Role::create(['name' => 'recepcionista', 'guard_name' => 'web']);
        Role::create(['name' => 'cliente', 'guard_name' => 'web']);

        $this->owner = User::factory()->create(['email' => 'owner@example.com', 'is_active' => true]);
        $this->owner->assignRole('cliente');

        $this->otherClient = User::factory()->create(['email' => 'other@example.com', 'is_active' => true]);
        $this->otherClient->assignRole('cliente');

        $this->receptionist = User::factory()->create(['is_active' => true]);
        $this->receptionist->assignRole('recepcionista');

        $this->admin = User::factory()->create(['is_active' => true]);
        $this->admin->assignRole('admin');

        $this->room = Room::create([
            'room_number'     => '301',
            'name'            => 'Doble de Pruebas',
            'bed_type'        => 'doble',
            'capacity'        => 2,
            'price_per_night' => 300.00,
            'status'          => 'disponible',
        ]);
    }

    private function confirmedOwnerBooking(array $overrides = [], float $paid = 600.00): Booking
    {
        $guest = Guest::firstOrCreate(['document_number' => '12345678'], [
            'name'          => 'Ana',
            'surname'       => 'Dueña',
            'document_type' => 'DNI',
            'email'         => 'owner@example.com',
            'user_id'       => $this->owner->id,
        ]);

        $booking = Booking::create(array_merge([
            'guest_id'     => $guest->id,
            'room_id'      => $this->room->id,
            'check_in'     => now()->addDays(10)->toDateString(),
            'check_out'    => now()->addDays(12)->toDateString(),
            'total_amount' => 600.00,
            'status'       => 'confirmed',
        ], $overrides));

        if ($paid > 0) {
            Payment::create([
                'booking_id'       => $booking->id,
                'amount'           => $paid,
                'payment_method'   => 'card',
                'status'           => 'completed',
                'transaction_id'   => 'sim_pi_' . $booking->id,
                'gateway_provider' => 'simulation',
                'currency'         => 'PEN',
                'paid_at'          => now(),
            ]);
        }

        return $booking;
    }

    private function walkInPayload(array $overrides = []): array
    {
        return array_merge([
            'room_id'         => $this->room->id,
            'check_in'        => now()->addDays(3)->toDateString(),
            'check_out'       => now()->addDays(5)->toDateString(),
            'guest_name'      => 'Walter',
            'guest_surname'   => 'Walkin',
            'guest_email'     => 'walter@example.com',
            'document_type'   => 'DNI',
            'document_number' => '76543210',
        ], $overrides);
    }

    private function validCard(): array
    {
        return [
            'card_number' => '4242424242424242',
            'card_expiry' => now()->addYears(2)->format('m/y'),
            'card_cvc'    => '123',
            'card_holder' => 'ANA DUENA',
        ];
    }

    // ---------------------------------------------------------------
    // Propiedad de la reserva
    // ---------------------------------------------------------------

    public function test_owner_can_view_and_cancel_booking_with_refund_pending(): void
    {
        $booking = $this->confirmedOwnerBooking();
        Sanctum::actingAs($this->owner);

        $this->getJson("/api/bookings/{$booking->booking_code}")->assertStatus(200);

        $this->postJson("/api/bookings/{$booking->booking_code}/cancel")
            ->assertStatus(200)
            ->assertJson(['refund_percentage' => 100]);

        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'cancelled']);
        $this->assertDatabaseHas('payments', [
            'booking_id' => $booking->id,
            'status'     => 'refund_pending',
            'amount'     => -600.00,
        ]);
    }

    public function test_owner_matched_by_email_when_guest_has_no_user(): void
    {
        $booking = $this->confirmedOwnerBooking();
        $booking->guest->update(['user_id' => null, 'email' => 'OWNER@example.com']);
        Sanctum::actingAs($this->owner);

        $this->getJson("/api/bookings/{$booking->booking_code}")->assertStatus(200);
    }

    public function test_other_client_gets_404_on_someone_elses_booking(): void
    {
        $booking = $this->confirmedOwnerBooking();
        Sanctum::actingAs($this->otherClient);

        $this->getJson("/api/bookings/{$booking->booking_code}")->assertStatus(404);
        $this->putJson("/api/bookings/{$booking->booking_code}", [
            'check_in'  => now()->addDays(10)->toDateString(),
            'check_out' => now()->addDays(11)->toDateString(),
        ])->assertStatus(404);
        $this->postJson("/api/bookings/{$booking->booking_code}/cancel")->assertStatus(404);

        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'confirmed']);
    }

    public function test_staff_can_access_any_booking(): void
    {
        $booking = $this->confirmedOwnerBooking();
        Sanctum::actingAs($this->receptionist);

        $this->getJson("/api/bookings/{$booking->booking_code}")->assertStatus(200);
    }

    public function test_unauthenticated_put_returns_401(): void
    {
        $booking = $this->confirmedOwnerBooking();

        $this->putJson("/api/bookings/{$booking->booking_code}", [
            'check_in'  => now()->addDays(10)->toDateString(),
            'check_out' => now()->addDays(11)->toDateString(),
        ])->assertStatus(401);
    }

    // ---------------------------------------------------------------
    // Modificación
    // ---------------------------------------------------------------

    public function test_payment_confirmed_flag_is_ignored_and_difference_requires_card(): void
    {
        $booking = $this->confirmedOwnerBooking();
        Sanctum::actingAs($this->owner);

        $newCheckOut = now()->addDays(14)->toDateString(); // 4 noches = 1200

        $this->putJson("/api/bookings/{$booking->booking_code}", [
            'check_in'          => now()->addDays(10)->toDateString(),
            'check_out'         => $newCheckOut,
            'payment_confirmed' => true,
        ])->assertStatus(200)
          ->assertJson(['requires_payment' => true, 'amount_difference' => 600]);

        $booking->refresh();
        $this->assertSame(now()->addDays(12)->toDateString(), \Carbon\Carbon::parse($booking->check_out)->toDateString());
        $this->assertEquals(600.00, (float) $booking->total_amount);
        $this->assertSame(1, Payment::where('booking_id', $booking->id)->count());
    }

    public function test_declined_card_on_modification_returns_402_without_changes(): void
    {
        $booking = $this->confirmedOwnerBooking();
        Sanctum::actingAs($this->owner);

        $this->putJson("/api/bookings/{$booking->booking_code}", array_merge([
            'check_in'  => now()->addDays(10)->toDateString(),
            'check_out' => now()->addDays(14)->toDateString(),
        ], $this->validCard(), ['card_number' => '4000000000000002']))->assertStatus(402);

        $this->assertEquals(600.00, (float) $booking->fresh()->total_amount);
    }

    public function test_positive_difference_is_charged_server_side(): void
    {
        $booking = $this->confirmedOwnerBooking();
        Sanctum::actingAs($this->owner);

        $this->putJson("/api/bookings/{$booking->booking_code}", array_merge([
            'check_in'  => now()->addDays(10)->toDateString(),
            'check_out' => now()->addDays(14)->toDateString(),
        ], $this->validCard()))->assertStatus(200);

        $this->assertEquals(1200.00, (float) $booking->fresh()->total_amount);
        $this->assertDatabaseHas('payments', ['booking_id' => $booking->id, 'status' => 'completed', 'amount' => 600.00]);
    }

    public function test_negative_difference_records_refund_pending(): void
    {
        $booking = $this->confirmedOwnerBooking();
        Sanctum::actingAs($this->owner);

        $this->putJson("/api/bookings/{$booking->booking_code}", [
            'check_in'  => now()->addDays(10)->toDateString(),
            'check_out' => now()->addDays(11)->toDateString(),
        ])->assertStatus(200);

        $this->assertEquals(300.00, (float) $booking->fresh()->total_amount);
        $this->assertDatabaseHas('payments', ['booking_id' => $booking->id, 'status' => 'refund_pending', 'amount' => -300.00]);
    }

    // ---------------------------------------------------------------
    // Disponibilidad / walk-in
    // ---------------------------------------------------------------

    public function test_double_booking_is_prevented(): void
    {
        Sanctum::actingAs($this->receptionist);

        $this->postJson('/api/bookings', $this->walkInPayload())->assertStatus(201);

        $this->postJson('/api/bookings', $this->walkInPayload([
            'check_in'        => now()->addDays(4)->toDateString(),
            'check_out'       => now()->addDays(6)->toDateString(),
            'guest_email'     => 'second@example.com',
            'document_number' => '11223344',
        ]))->assertStatus(409);

        $this->assertSame(1, Booking::count());
    }

    public function test_room_in_maintenance_cannot_be_booked(): void
    {
        $this->room->update(['status' => 'mantenimiento']);
        Sanctum::actingAs($this->receptionist);

        $this->postJson('/api/bookings', $this->walkInPayload())->assertStatus(422);
    }

    public function test_walk_in_does_not_overwrite_existing_guest_and_rejects_foreign_email(): void
    {
        Guest::create([
            'name' => 'Nombre', 'surname' => 'Original', 'document_type' => 'DNI',
            'document_number' => '76543210', 'email' => 'original@example.com',
        ]);
        Guest::create([
            'name' => 'Otra', 'surname' => 'Persona', 'document_type' => 'DNI',
            'document_number' => '99999999', 'email' => 'otra@example.com',
        ]);
        Sanctum::actingAs($this->receptionist);

        // Email de otro huésped -> 422
        $this->postJson('/api/bookings', $this->walkInPayload(['guest_email' => 'otra@example.com']))
            ->assertStatus(422);

        // Mismo documento: se reutiliza la ficha sin modificar nombre/email
        $this->postJson('/api/bookings', $this->walkInPayload(['guest_email' => 'nuevo@example.com', 'guest_name' => 'Cambiado']))
            ->assertStatus(201);

        $this->assertDatabaseHas('guests', ['document_number' => '76543210', 'name' => 'Nombre', 'email' => 'original@example.com']);
        $this->assertDatabaseHas('bookings', ['status' => 'confirmed']);
    }

    // ---------------------------------------------------------------
    // Cupones
    // ---------------------------------------------------------------

    public function test_coupon_usage_increments_only_on_successful_payment(): void
    {
        $coupon = Coupon::create([
            'code' => 'DESC10', 'discount_type' => 'percentage', 'discount_value' => 10,
            'expires_at' => now()->toDateString(), 'max_uses' => 5, 'current_uses' => 0, 'is_active' => true,
        ]);

        $intent = fn (string $doc, string $email, int $offset) => $this->postJson('/api/payments/checkout-intent', [
            'room_id'         => $this->room->id,
            'check_in'        => now()->addDays($offset)->toDateString(),
            'check_out'       => now()->addDays($offset + 2)->toDateString(),
            'guest_name'      => 'Cupon',
            'guest_surname'   => 'Tester',
            'guest_email'     => $email,
            'document_type'   => 'DNI',
            'document_number' => $doc,
            'coupon_code'     => 'DESC10',
        ]);

        // Intent: descuento aplicado pero uso NO contabilizado
        $first = $intent('10000001', 'c1@example.com', 2)->assertStatus(201);
        $this->assertEquals(540.00, (float) $first->json('summary.total_amount')); // 600 - 10%
        $this->assertEquals(0, $coupon->fresh()->current_uses);

        // Pago rechazado: sigue en 0
        $this->postJson('/api/payments/process-mock', array_merge(['booking_code' => $first->json('booking_code')], $this->validCard(), ['card_number' => '4000000000000002']))
            ->assertStatus(422);
        $this->assertEquals(0, $coupon->fresh()->current_uses);

        // Pago exitoso: 1
        $second = $intent('10000002', 'c2@example.com', 6)->assertStatus(201);
        $this->postJson('/api/payments/process-mock', array_merge(['booking_code' => $second->json('booking_code')], $this->validCard()))
            ->assertStatus(200);
        $this->assertEquals(1, $coupon->fresh()->current_uses);
    }

    public function test_expired_pending_booking_is_expired_by_command_and_releases_coupon(): void
    {
        $coupon = Coupon::create([
            'code' => 'LEGACY', 'discount_type' => 'fixed', 'discount_value' => 50,
            'expires_at' => now()->addMonth()->toDateString(), 'max_uses' => 5, 'current_uses' => 1, 'is_active' => true,
        ]);

        $booking = $this->confirmedOwnerBooking([
            'status'         => 'pending_payment',
            'expires_at'     => now()->subMinutes(5),
            'coupon_id'      => $coupon->id,
            'coupon_counted' => true,
        ], 0);

        $this->artisan('app:expire-pending-bookings')->assertExitCode(0);

        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'expired']);
        $this->assertEquals(0, $coupon->fresh()->current_uses);
    }

    // ---------------------------------------------------------------
    // Operación: cargos, pagos, check-in / check-out
    // ---------------------------------------------------------------

    public function test_staff_payment_rejects_overpayment(): void
    {
        $booking = $this->confirmedOwnerBooking([], 500.00); // saldo 100
        Sanctum::actingAs($this->receptionist);

        $this->postJson("/api/staff/bookings/{$booking->id}/pay", ['amount' => 150, 'method' => 'Efectivo'])
            ->assertStatus(422);
        $this->postJson("/api/staff/bookings/{$booking->id}/pay", ['amount' => 0, 'method' => 'Efectivo'])
            ->assertStatus(422);
        $this->postJson("/api/staff/bookings/{$booking->id}/pay", ['amount' => 100, 'method' => 'Efectivo'])
            ->assertStatus(200)->assertJson(['balance' => 0]);
    }

    public function test_add_charge_decrements_stock_atomically_and_services_have_no_stock(): void
    {
        $booking = $this->confirmedOwnerBooking();
        $snack = Product::create(['name' => 'Sublime', 'category' => 'snacks', 'price' => 8, 'stock' => 2, 'is_active' => true, 'tracks_stock' => true]);
        $spa = Product::create(['name' => 'Masaje', 'category' => 'servicios_spa', 'price' => 120, 'stock' => 0, 'is_active' => true, 'tracks_stock' => false]);
        Sanctum::actingAs($this->receptionist);

        $this->postJson("/api/staff/bookings/{$booking->id}/charges", ['date' => now()->toDateString(), 'product_id' => $snack->id, 'quantity' => 3])
            ->assertStatus(422);
        $this->postJson("/api/staff/bookings/{$booking->id}/charges", ['date' => now()->toDateString(), 'product_id' => $snack->id, 'quantity' => 2])
            ->assertStatus(200);
        $this->assertSame(0, (int) $snack->fresh()->stock);

        $this->postJson("/api/staff/bookings/{$booking->id}/charges", ['date' => now()->toDateString(), 'product_id' => $spa->id, 'quantity' => 1])
            ->assertStatus(200);
    }

    public function test_check_in_only_from_check_in_date(): void
    {
        $future = $this->confirmedOwnerBooking();
        Sanctum::actingAs($this->receptionist);

        $this->postJson("/api/staff/bookings/{$future->booking_code}/check-in")->assertStatus(422);

        $future->update([
            'check_in'  => now()->toDateString(),
            'check_out' => now()->addDays(2)->toDateString(),
        ]);

        $this->postJson("/api/staff/bookings/{$future->booking_code}/check-in")->assertStatus(200);
        $this->assertDatabaseHas('rooms', ['id' => $this->room->id, 'status' => 'ocupada']);
    }

    public function test_check_out_is_blocked_with_balance_unless_admin_forces(): void
    {
        $booking = $this->confirmedOwnerBooking([
            'check_in'  => now()->subDays(2)->toDateString(),
            'check_out' => now()->toDateString(),
            'status'    => 'checked_in',
        ], 0);

        Sanctum::actingAs($this->receptionist);
        $this->postJson("/api/staff/bookings/{$booking->booking_code}/check-out")
            ->assertStatus(422)
            ->assertJson(['requires_payment' => true]);
        $this->postJson("/api/staff/bookings/{$booking->booking_code}/check-out", ['force' => true])
            ->assertStatus(403);
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'checked_in']);

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/staff/bookings/{$booking->booking_code}/check-out", ['force' => true])
            ->assertStatus(200);

        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'checked_out']);
        $this->assertDatabaseHas('rooms', ['id' => $this->room->id, 'status' => 'limpieza']);
    }
}
