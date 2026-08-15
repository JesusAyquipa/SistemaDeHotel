<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class RoleAndPermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Limpiar caché de permisos
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Roles solicitados para la arquitectura inicial
        $adminRole = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $recepRole = Role::firstOrCreate(['name' => 'recepcionista', 'guard_name' => 'web']);
        $clientRole = Role::firstOrCreate(['name' => 'cliente', 'guard_name' => 'web']);

        // Crear usuario Administrador inicial
        $admin = User::firstOrCreate(
            ['email' => 'admin@hotel.com'],
            [
                'name' => 'Administrador Principal',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );
        $admin->syncRoles([$adminRole]);

        // Crear usuario Recepcionista Activo inicial
        $recep = User::firstOrCreate(
            ['email' => 'recepcion@hotel.com'],
            [
                'name' => 'María García (Recepción)',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );
        $recep->syncRoles([$recepRole]);

        // Crear usuario Recepcionista Inactivo inicial
        $recepInactivo = User::firstOrCreate(
            ['email' => 'inactivo@hotel.com'],
            [
                'name' => 'Carlos López (Inactivo)',
                'password' => Hash::make('password'),
                'is_active' => false,
            ]
        );
        $recepInactivo->syncRoles([$recepRole]);

        $this->command->info('Roles y Cuentas de Personal iniciales creadas exitosamente.');
    }
}
