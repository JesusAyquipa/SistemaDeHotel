<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class CurrentStateSeeder extends Seeder
{
    public function run(): void
    {
        // ── Roles ────────────────────────────────────────────
        DB::table('roles')->upsert([
            ['id' => 1, 'name' => 'admin',         'guard_name' => 'web', 'created_at' => '2026-09-22 08:12:55', 'updated_at' => '2026-09-22 08:12:55'],
            ['id' => 2, 'name' => 'recepcionista',  'guard_name' => 'web', 'created_at' => '2026-09-22 08:12:55', 'updated_at' => '2026-09-22 08:12:55'],
            ['id' => 3, 'name' => 'cliente',        'guard_name' => 'web', 'created_at' => '2026-09-22 08:12:55', 'updated_at' => '2026-09-22 08:12:55'],
        ], ['id'], ['name', 'guard_name']);
        $this->command->info('Roles insertados.');

        // ── Users ────────────────────────────────────────────
        DB::table('users')->upsert([
            ['id' => 1, 'name' => 'Administrador Principal',      'email' => 'admin@hotel.com',          'image_url' => null, 'password' => '$2y$12$0TQ3FGwEt/wAdvTY3eg3Qu5IEHnQtAQ5V9DoGuiKE3eRbgBuuAmcq', 'is_active' => 1, 'remember_token' => null, 'created_at' => '2026-09-22 08:12:56', 'updated_at' => '2026-09-22 08:12:56'],
            ['id' => 2, 'name' => 'María García (Recepción)',     'email' => 'recepcion@hotel.com',      'image_url' => null, 'password' => '$2y$12$AREFSy9qh3AKWbgBAKcQ0e8d8e7xrYIBtSOddIrbodF4O0jlEWo6q', 'is_active' => 1, 'remember_token' => null, 'created_at' => '2026-09-22 08:12:56', 'updated_at' => '2026-09-22 08:12:56'],
            ['id' => 3, 'name' => 'Carlos López (Inactivo)',      'email' => 'inactivo@hotel.com',       'image_url' => null, 'password' => '$2y$12$sCr4qJnnS0DlwrGn3vwU2euCMIColX2LuZv8l1.zEfBj.NbXPx7iW', 'is_active' => 0, 'remember_token' => null, 'created_at' => '2026-09-22 08:12:56', 'updated_at' => '2026-09-22 08:12:56'],
            ['id' => 4, 'name' => 'jesus ayquipa ayquipa',        'email' => 'jesusayquipa789@gmail.com','image_url' => null, 'password' => '$2y$12$oLIMKWwD5DZUl0PGqlinHeDKvJo1S.riHp47KUzuibdulRuKO0UP6', 'is_active' => 1, 'remember_token' => null, 'created_at' => '2026-09-22 08:47:24', 'updated_at' => '2026-10-05 05:20:33'],
        ], ['id'], ['name', 'email']);
        $this->command->info('Usuarios insertados.');

        // ── model_has_roles ──────────────────────────────────
        DB::table('model_has_roles')->insertOrIgnore([
            ['role_id' => 1, 'model_type' => 'App\Models\User', 'model_id' => 1],
            ['role_id' => 2, 'model_type' => 'App\Models\User', 'model_id' => 2],
            ['role_id' => 2, 'model_type' => 'App\Models\User', 'model_id' => 3],
            ['role_id' => 3, 'model_type' => 'App\Models\User', 'model_id' => 4],
        ]);
        $this->command->info('Roles de usuario asignados.');

        // ── Rooms ────────────────────────────────────────────
        DB::table('rooms')->upsert([
            ['id' => 1, 'room_number' => '101', 'name' => 'Habitación Individual Clásica',  'description' => 'Acogedora habitación individual con vista al jardín interior. Decoración clásica con detalles en madera de caoba, cama individual con ropa de cama de lino y escritorio de correspondencia.', 'bed_type' => 'individual', 'capacity' => 1, 'size_m2' => 22, 'price_per_night' => 180.00, 'image_url' => null, 'status' => 'disponible', 'created_at' => '2026-09-22 08:12:56', 'updated_at' => '2026-09-22 08:12:56'],
            ['id' => 2, 'room_number' => '202', 'name' => 'Suite Doble Patrimonio',         'description' => 'Nuestra habitación doble estándar ofrece una experiencia excepcional. Presenta cortinas de lino grueso, accesorios de latón y una mesa de escritura artesanal para correspondencia.', 'bed_type' => 'doble', 'capacity' => 2, 'size_m2' => 38, 'price_per_night' => 280.00, 'image_url' => null, 'status' => 'disponible', 'created_at' => '2026-09-22 08:12:56', 'updated_at' => '2026-09-22 08:12:56'],
            ['id' => 3, 'room_number' => '303', 'name' => 'Suite Embajador',                'description' => 'Amplia suite de esquina con vistas panorámicas. Incluye sala de estar separada con escritorio, molduras originales de 1894 y baño de mármol con bañera de patas.', 'bed_type' => 'king', 'capacity' => 2, 'size_m2' => 79, 'price_per_night' => 450.00, 'image_url' => null, 'status' => 'disponible', 'created_at' => '2026-09-22 08:12:56', 'updated_at' => '2026-09-22 08:12:56'],
            ['id' => 4, 'room_number' => '214', 'name' => 'Habitación Doble Deluxe',        'description' => 'Habitación doble de lujo con vista a la plaza central. Cama king size, minibar y acceso al salón privado de huéspedes en el tercer piso.', 'bed_type' => 'king', 'capacity' => 2, 'size_m2' => 45, 'price_per_night' => 320.00, 'image_url' => null, 'status' => 'disponible', 'created_at' => '2026-09-22 08:12:56', 'updated_at' => '2026-09-22 08:12:56'],
            ['id' => 5, 'room_number' => '115', 'name' => 'Habitación Familiar Doble',      'description' => 'Espaciosa habitación familiar con dos camas dobles, ideal para familias o grupos pequeños. Amplio baño y zona de estar independiente.', 'bed_type' => 'doble', 'capacity' => 4, 'size_m2' => 55, 'price_per_night' => 360.00, 'image_url' => null, 'status' => 'disponible', 'created_at' => '2026-09-22 08:12:56', 'updated_at' => '2026-09-22 08:12:56'],
            ['id' => 6, 'room_number' => '418', 'name' => 'Junior Suite Ejecutiva',         'description' => 'Suite junior con zona de trabajo profesional, cama king y vistas al jardín. Incluye servicio de mayordomo y acceso prioritario al business center.', 'bed_type' => 'king', 'capacity' => 2, 'size_m2' => 62, 'price_per_night' => 520.00, 'image_url' => null, 'status' => 'disponible', 'created_at' => '2026-09-22 08:12:56', 'updated_at' => '2026-09-22 08:12:56'],
            ['id' => 7, 'room_number' => '500', 'name' => 'El Penthouse del Fundador',      'description' => 'La cima de nuestra oferta. Ocupa todo el piso superior con biblioteca privada, comedor formal y terraza perimetral con vistas a la plaza de la ciudad.', 'bed_type' => 'king', 'capacity' => 4, 'size_m2' => 195, 'price_per_night' => 1200.00, 'image_url' => null, 'status' => 'disponible', 'created_at' => '2026-09-22 08:12:56', 'updated_at' => '2026-09-22 08:12:56'],
            ['id' => 8, 'room_number' => '108', 'name' => 'Habitación Individual Ejecutiva','description' => 'Habitación individual con todos los servicios ejecutivos. Escritorio amplio, Wi-Fi de alta velocidad, minibar y vistas al jardín interior. Ideal para viajeros de negocios.', 'bed_type' => 'individual', 'capacity' => 1, 'size_m2' => 28, 'price_per_night' => 220.00, 'image_url' => null, 'status' => 'disponible', 'created_at' => '2026-09-22 08:12:56', 'updated_at' => '2026-09-22 08:12:56'],
        ], ['id'], ['name', 'status', 'price_per_night']);
        $this->command->info('Habitaciones insertadas.');

        // ── Coupons ──────────────────────────────────────────
        DB::table('coupons')->upsert([
            ['id' => 1, 'code' => 'BIENVENIDA20', 'discount_type' => 'percentage', 'discount_value' => 20.00, 'expires_at' => '2027-12-31', 'max_uses' => 100, 'current_uses' => 1, 'is_active' => 1, 'created_at' => '2026-10-05 04:35:02', 'updated_at' => '2026-10-05 04:56:55'],
            ['id' => 2, 'code' => 'DESC50FIJO',   'discount_type' => 'fixed',      'discount_value' => 50.00, 'expires_at' => '2027-12-31', 'max_uses' => 50,  'current_uses' => 0, 'is_active' => 1, 'created_at' => '2026-10-05 04:35:02', 'updated_at' => '2026-10-05 04:35:02'],
            ['id' => 3, 'code' => 'VERANOVIP',    'discount_type' => 'percentage', 'discount_value' => 15.00, 'expires_at' => '2027-03-31', 'max_uses' => 200, 'current_uses' => 0, 'is_active' => 1, 'created_at' => '2026-10-05 04:35:02', 'updated_at' => '2026-10-05 04:35:02'],
        ], ['id'], ['code', 'discount_value']);
        $this->command->info('Cupones insertados.');

        // ── Seasons ──────────────────────────────────────────
        DB::table('seasons')->upsert([
            ['id' => 1, 'name' => 'Verano 2027',       'start_date' => '2027-01-01', 'end_date' => '2027-03-31', 'rate_adjustment' => 20.00, 'is_active' => 1, 'created_at' => '2026-10-05 04:35:02', 'updated_at' => '2026-10-05 04:35:02'],
            ['id' => 2, 'name' => 'Semana Santa 2027', 'start_date' => '2027-04-10', 'end_date' => '2027-04-17', 'rate_adjustment' => 50.00, 'is_active' => 1, 'created_at' => '2026-10-05 04:35:02', 'updated_at' => '2026-10-05 04:35:02'],
            ['id' => 3, 'name' => 'Fiestas Patrias 2027','start_date' => '2027-07-25', 'end_date' => '2027-07-31', 'rate_adjustment' => 35.00, 'is_active' => 1, 'created_at' => '2026-10-05 04:35:02', 'updated_at' => '2026-10-05 04:35:02'],
        ], ['id'], ['name']);
        $this->command->info('Temporadas insertadas.');

        $this->command->info('✅ Seed completado exitosamente.');
    }
}
