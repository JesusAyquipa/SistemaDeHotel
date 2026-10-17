<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Guest;
use App\Models\Room;
use App\Models\Booking;
use App\Models\Season;
use App\Models\Coupon;
use App\Models\Product;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Carbon\Carbon;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Seeder base: roles, habitaciones, cupones y temporadas (sin datos personales).
        $this->call([
            CurrentStateSeeder::class,
            RoomTypeSeeder::class, // SHE-034: tipos de habitación y asignación
        ]);

        // 2. ROLES Y CUENTAS DEMO DEL PERSONAL
        // Credenciales desde variables de entorno. Si no se define la contraseña,
        // se genera una aleatoria y se muestra en consola (solo al crear la cuenta).
        $this->call([RoleAndPermissionSeeder::class]);

        $this->seedStaffAccount('ADMIN', 'admin@hotel.com', 'Administrador Principal', 'admin');
        $this->seedStaffAccount('RECEPCION', 'recepcion@hotel.com', 'Recepción Principal', 'recepcionista');

        // 3. CREACIÓN DE RESERVAS DE PRUEBA (huéspedes ficticios, sin cuenta)
        $room1 = Room::where('room_number', '202')->first();
        $room2 = Room::where('room_number', '303')->first();

        if ($room1 && $room2) {
            $demoGuest1 = Guest::updateOrCreate(
                ['email' => 'huesped.demo1@example.com'],
                [
                    'name' => 'Lucía', 'surname' => 'Demo Uno', 'document_type' => 'DNI',
                    'document_number' => '00000001', 'phone' => '900000001',
                ]
            );

            Booking::firstOrCreate(
                ['guest_id' => $demoGuest1->id, 'room_id' => $room1->id],
                [
                    'check_in' => Carbon::now()->addDays(2)->format('Y-m-d'), // Llega en 2 días
                    'check_out' => Carbon::now()->addDays(5)->format('Y-m-d'),
                    'total_amount' => $room1->effective_price * 3,
                    'status' => 'confirmed',
                ]
            );

            $demoGuest2 = Guest::updateOrCreate(
                ['email' => 'huesped.demo2@example.com'],
                [
                    'name' => 'Mateo', 'surname' => 'Demo Dos', 'document_type' => 'CE',
                    'document_number' => 'CE000002', 'phone' => '900000002',
                ]
            );

            Booking::firstOrCreate(
                ['guest_id' => $demoGuest2->id, 'room_id' => $room2->id],
                [
                    'check_in' => Carbon::now()->format('Y-m-d'), // Llega hoy
                    'check_out' => Carbon::now()->addDays(2)->format('Y-m-d'),
                    'total_amount' => $room2->effective_price * 2,
                    'status' => 'confirmed',
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

        // 6. CATÁLOGO DE PRODUCTOS / SERVICIOS EXTRA
        // Se usa updateOrCreate (por nombre) para que el seeder sea idempotente.
        $catalog = [
            // Snacks (Frigobar)
            ['name' => 'Agua Mineral',            'category' => 'bebidas',       'price' => 5.00,   'stock' => 50,  'is_active' => true],
            ['name' => 'Coca Cola 500ml',          'category' => 'bebidas',       'price' => 6.00,   'stock' => 50,  'is_active' => true],
            ['name' => 'Inka Kola 500ml',          'category' => 'bebidas',       'price' => 6.00,   'stock' => 40,  'is_active' => true],
            ['name' => 'Cerveza Local',            'category' => 'bebidas',       'price' => 12.00,  'stock' => 30,  'is_active' => true],
            ['name' => 'Botella de Vino',          'category' => 'bebidas',       'price' => 85.00,  'stock' => 20,  'is_active' => true],
            ['name' => 'Café / Té',               'category' => 'bebidas',       'price' => 10.00,  'stock' => 999, 'is_active' => true],
            ['name' => 'Papas Lays',               'category' => 'snacks',        'price' => 5.50,   'stock' => 30,  'is_active' => true],
            ['name' => 'Sublime',                  'category' => 'snacks',        'price' => 7.00,   'stock' => 10,  'is_active' => true],
            ['name' => 'Chocolate',                'category' => 'snacks',        'price' => 7.00,   'stock' => 25,  'is_active' => true],
            // Restaurante
            ['name' => 'Desayuno Buffet',          'category' => 'otros',         'price' => 45.00,  'stock' => 999, 'is_active' => true],
            ['name' => 'Almuerzo Menú',            'category' => 'otros',         'price' => 35.00,  'stock' => 999, 'is_active' => true],
            ['name' => 'Cena a la Carta',          'category' => 'otros',         'price' => 60.00,  'stock' => 999, 'is_active' => true],
            // Lavandería
            ['name' => 'Lavado por Pieza',         'category' => 'lavanderia',    'price' => 15.00,  'stock' => 999, 'is_active' => true],
            ['name' => 'Planchado de Camisa',      'category' => 'lavanderia',    'price' => 10.00,  'stock' => 999, 'is_active' => true],
            ['name' => 'Planchado de Traje',       'category' => 'lavanderia',    'price' => 25.00,  'stock' => 999, 'is_active' => true],
            // Servicios Spa
            ['name' => 'Masaje Relajante (60m)',   'category' => 'servicios_spa', 'price' => 120.00, 'stock' => 999, 'is_active' => true],
            ['name' => 'Sesión Sauna',             'category' => 'servicios_spa', 'price' => 50.00,  'stock' => 999, 'is_active' => true],
            ['name' => 'Facial Hidratante',        'category' => 'servicios_spa', 'price' => 90.00,  'stock' => 999, 'is_active' => true],
            // Otros servicios
            ['name' => 'Transporte al Aeropuerto', 'category' => 'otros',         'price' => 75.00,  'stock' => 999, 'is_active' => true],
            ['name' => 'Cama Adicional',           'category' => 'otros',         'price' => 100.00, 'stock' => 50,  'is_active' => true],
            ['name' => 'Late Check-out',           'category' => 'otros',         'price' => 150.00, 'stock' => 999, 'is_active' => true],
        ];

        foreach ($catalog as $item) {
            // Los servicios (stock 999 = ilimitado) no controlan inventario.
            $item['tracks_stock'] = $item['stock'] !== 999;
            Product::updateOrCreate(
                ['name' => $item['name']],
                $item
            );
        }
    }

    /**
     * Crea (o actualiza) una cuenta de personal a partir de variables de entorno:
     * SEED_{PREFIX}_EMAIL y SEED_{PREFIX}_PASSWORD.
     */
    private function seedStaffAccount(string $prefix, string $defaultEmail, string $name, string $role): User
    {
        $email = env("SEED_{$prefix}_EMAIL") ?: $defaultEmail;
        $password = env("SEED_{$prefix}_PASSWORD");

        $user = User::where('email', $email)->first();

        if (!$password && $user) {
            // Cuenta existente y sin contraseña explícita: no se rota la contraseña.
            $user->syncRoles([$role]);
            return $user;
        }

        if (!$password) {
            $password = Str::password(16, symbols: false);
            $this->command?->warn("Cuenta {$role} creada: {$email} / contraseña generada: {$password}");
            $this->command?->warn("Defina SEED_{$prefix}_PASSWORD para usar una contraseña fija.");
        }

        $user = User::updateOrCreate(
            ['email' => $email],
            ['name' => $name, 'password' => Hash::make($password), 'is_active' => true]
        );
        $user->syncRoles([$role]);

        return $user;
    }
}
