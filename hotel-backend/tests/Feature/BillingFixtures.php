<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Guest;
use App\Models\Payment;
use App\Models\Room;
use App\Models\User;
use Spatie\Permission\Models\Role;

/**
 * Datos comunes para las pruebas de facturación (G1).
 */
trait BillingFixtures
{
    protected User $admin;
    protected User $receptionist;
    protected User $client;
    protected User $otherClient;
    protected Room $room;
    protected Guest $guest;

    protected function setUpBilling(): void
    {
        foreach (['admin', 'recepcionista', 'cliente'] as $role) {
            Role::findOrCreate($role, 'web');
        }

        $this->admin = User::factory()->create(['is_active' => true]);
        $this->admin->assignRole('admin');
        $this->receptionist = User::factory()->create(['is_active' => true]);
        $this->receptionist->assignRole('recepcionista');
        $this->client = User::factory()->create(['email' => 'cliente@example.com', 'is_active' => true]);
        $this->client->assignRole('cliente');
        $this->otherClient = User::factory()->create(['email' => 'otro@example.com', 'is_active' => true]);
        $this->otherClient->assignRole('cliente');

        $this->room = Room::create([
            'room_number'     => '201',
            'name'            => 'Suite Facturación',
            'bed_type'        => 'doble',
            'capacity'        => 2,
            'price_per_night' => 200.00,
            'status'          => 'disponible',
        ]);

        $this->guest = Guest::create([
            'name'            => 'Carla',
            'surname'         => 'Cliente',
            'document_type'   => 'DNI',
            'document_number' => '45678912',
            'email'           => 'cliente@example.com',
            'user_id'         => $this->client->id,
        ]);
    }

    /**
     * Reserva de 2 noches a S/ 200 (total 400) con pago completado por $paid.
     */
    protected function makeBooking(array $overrides = [], float $paid = 400.00, string $method = 'card'): Booking
    {
        $booking = Booking::create(array_merge([
            'guest_id'     => $this->guest->id,
            'room_id'      => $this->room->id,
            'check_in'     => now()->addDays(10)->toDateString(),
            'check_out'    => now()->addDays(12)->toDateString(),
            'total_amount' => 400.00,
            'status'       => Booking::STATUS_CONFIRMED,
        ], $overrides));

        if ($paid > 0) {
            Payment::create([
                'booking_id'       => $booking->id,
                'amount'           => $paid,
                'payment_method'   => $method,
                'status'           => Payment::STATUS_COMPLETED,
                'transaction_id'   => 'TX-' . $booking->id,
                'gateway_provider' => 'simulation',
                'currency'         => 'PEN',
                'paid_at'          => now(),
            ]);
        }

        return $booking;
    }
}
