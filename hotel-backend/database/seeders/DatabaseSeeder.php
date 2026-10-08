<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Guest;
use App\Models\Room;
use App\Models\Booking;
use App\Models\Season;
use App\Models\Coupon;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. PRIMERO llamamos al seeder base. Esto es importante porque ejecuta
        // el archivo SQL que crea las habitaciones, roles y configuraciones iniciales.
        $this->call([
            CurrentStateSeeder::class,
        ]);

        // 2. CREACIÓN DE ROLES Y CUENTAS ESPECÍFICAS
        \Spatie\Permission\Models\Role::firstOrCreate(['name' => 'admin']);
        \Spatie\Permission\Models\Role::firstOrCreate(['name' => 'recepcionista']);
        \Spatie\Permission\Models\Role::firstOrCreate(['name' => 'cliente']);

        $password = Hash::make('password123'); // Contraseña por defecto: password123

        // Cuenta Admin
        $admin = User::updateOrCreate(
            ['email' => 'admin@hotel.com'],
            ['name' => 'Administrador Principal', 'password' => $password, 'is_active' => true]
        );
        $admin->assignRole('admin');

        // Cuenta Recepción
        $recepcion = User::updateOrCreate(
            ['email' => 'recepcion@hotel.com'],
            ['name' => 'Recepción Principal', 'password' => $password, 'is_active' => true]
        );
        $recepcion->assignRole('recepcionista');

        // Cuenta de Jesús
        $jesus = User::updateOrCreate(
            ['email' => 'jesusayquipa789@gmail.com'], 
            ['name' => 'Jesus Ayquipa', 'password' => Hash::make('Jesusayquipa1+2'), 'is_active' => true]
        );
        $jesus->assignRole('cliente');

        // Cuenta de Arnie (Admin)
        $arnie = User::updateOrCreate(
            ['email' => 'arnie.7u7@gmail.com'],
            ['name' => 'Arnie', 'password' => Hash::make('Jesusayquipa1+2'), 'is_active' => true]
        );
        $arnie->assignRole('admin');

        // 2.1 CREACIÓN DE PRODUCTOS INICIALES DEL CATÁLOGO
        $defaultProducts = [
            // Frigobar / Snacks / Bebidas
            ['name' => 'Agua Mineral 500ml', 'category' => 'bebidas', 'price' => 5.00, 'stock' => 100],
            ['name' => 'Coca Cola 500ml', 'category' => 'bebidas', 'price' => 6.00, 'stock' => 50],
            ['name' => 'Inka Kola 500ml', 'category' => 'bebidas', 'price' => 6.00, 'stock' => 40],
            ['name' => 'Cerveza Local', 'category' => 'bebidas', 'price' => 12.00, 'stock' => 30],
            ['name' => 'Papas Lays Clásicas', 'category' => 'snacks', 'price' => 5.50, 'stock' => 30],
            ['name' => 'Chocolate', 'category' => 'snacks', 'price' => 7.00, 'stock' => 25],
            ['name' => 'Sublime', 'category' => 'snacks', 'price' => 8.00, 'stock' => 20],

            // Restaurante
            ['name' => 'Desayuno Buffet', 'category' => 'bebidas', 'price' => 45.00, 'stock' => 999],
            ['name' => 'Almuerzo Menú', 'category' => 'otros', 'price' => 35.00, 'stock' => 999],
            ['name' => 'Cena a la Carta', 'category' => 'otros', 'price' => 60.00, 'stock' => 999],
            ['name' => 'Botella de Vino', 'category' => 'bebidas', 'price' => 85.00, 'stock' => 15],
            ['name' => 'Café / Té', 'category' => 'bebidas', 'price' => 10.00, 'stock' => 100],

            // Lavandería
            ['name' => 'Lavado por Pieza', 'category' => 'lavanderia', 'price' => 15.00, 'stock' => 999],
            ['name' => 'Lavado y Planchado (Traje)', 'category' => 'lavanderia', 'price' => 45.00, 'stock' => 999],
            ['name' => 'Planchado de Camisa', 'category' => 'lavanderia', 'price' => 10.00, 'stock' => 999],

            // Spa
            ['name' => 'Masaje Relajante (60m)', 'category' => 'servicios_spa', 'price' => 120.00, 'stock' => 999],
            ['name' => 'Sesión Sauna', 'category' => 'servicios_spa', 'price' => 50.00, 'stock' => 999],
            ['name' => 'Facial Hidratante', 'category' => 'servicios_spa', 'price' => 90.00, 'stock' => 999],

            // Otros
            ['name' => 'Transporte al Aeropuerto', 'category' => 'otros', 'price' => 75.00, 'stock' => 999],
            ['name' => 'Cama Adicional', 'category' => 'otros', 'price' => 100.00, 'stock' => 10],
            ['name' => 'Late Check-out', 'category' => 'otros', 'price' => 150.00, 'stock' => 999],
        ];

        foreach ($defaultProducts as $prod) {
            \App\Models\Product::updateOrCreate(['name' => $prod['name']], array_merge($prod, ['is_active' => true]));
        }

        // 3. CREACIÓN DE RESERVAS DE PRUEBA
        // Buscamos un par de habitaciones que el CurrentStateSeeder acaba de crear
        $room1 = Room::where('room_number', '202')->first();
        $room2 = Room::where('room_number', '303')->first();

        if ($room1 && $room2) {
            // -- Reserva para Jesús --
            $guestJesus = Guest::updateOrCreate(
                ['email' => $jesus->email],
                [
                    'name' => 'Jesus', 'surname' => 'Ayquipa', 'document_type' => 'DNI',
                    'document_number' => '12345678', 'phone' => '999888777', 'user_id' => $jesus->id
                ]
            );

            Booking::firstOrCreate(
                ['guest_id' => $guestJesus->id, 'room_id' => $room1->id],
                [
                    'check_in' => Carbon::now()->addDays(2)->format('Y-m-d'), // Llega en 2 días
                    'check_out' => Carbon::now()->addDays(5)->format('Y-m-d'),
                    'total_amount' => $room1->price_per_night * 3,
                    'status' => 'confirmed'
                ]
            );

            // -- Reserva para Arnie --
            $guestArnie = Guest::updateOrCreate(
                ['email' => $arnie->email],
                [
                    'name' => 'Arnie', 'surname' => 'Doe', 'document_type' => 'CE',
                    'document_number' => '87654321', 'phone' => '999777666', 'user_id' => $arnie->id
                ]
            );

            Booking::firstOrCreate(
                ['guest_id' => $guestArnie->id, 'room_id' => $room2->id],
                [
                    'check_in' => Carbon::now()->format('Y-m-d'), // Llegó hoy
                    'check_out' => Carbon::now()->addDays(2)->format('Y-m-d'),
                    'total_amount' => $room2->price_per_night * 2,
                    'status' => 'confirmed'
                ]
            );
        }

        // 4. CREACIÓN DE TEMPORADAS DE PRUEBA
        Season::updateOrCreate(
            ['name' => 'Verano 2027'],
            ['start_date' => '2027-01-01', 'end_date' => '2027-03-31', 'rate_adjustment' => 20.00, 'is_active' => true]
        );
        Season::updateOrCreate(
            ['name' => 'Invierno 2027'],
            ['start_date' => '2027-06-01', 'end_date' => '2027-08-31', 'rate_adjustment' => 15.00, 'is_active' => true]
        );
        Season::updateOrCreate(
            ['name' => 'Navidad 2027'],
            ['start_date' => '2027-12-15', 'end_date' => '2027-12-31', 'rate_adjustment' => 30.00, 'is_active' => true]
        );

        // 5. CREACIÓN DE CUPONES DE PRUEBA
        Coupon::updateOrCreate(
            ['code' => 'BIENVENIDA20'],
            ['discount_type' => 'percentage', 'discount_value' => 20.00, 'expires_at' => '2027-12-31', 'max_uses' => 100, 'current_uses' => 0, 'is_active' => true]
        );
        Coupon::updateOrCreate(
            ['code' => 'FIEL50'],
            ['discount_type' => 'fixed', 'discount_value' => 50.00, 'expires_at' => '2027-12-31', 'max_uses' => 50, 'current_uses' => 0, 'is_active' => true]
        );
        Coupon::updateOrCreate(
            ['code' => 'VERANO15'],
            ['discount_type' => 'percentage', 'discount_value' => 15.00, 'expires_at' => '2027-03-31', 'max_uses' => 200, 'current_uses' => 0, 'is_active' => true]
        );
    }
}
