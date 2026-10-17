<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Crea los roles base del sistema (admin, recepcionista, cliente).
 * No crea usuarios: las cuentas demo se generan en DatabaseSeeder a partir de
 * variables de entorno (SEED_ADMIN_*, SEED_RECEPCION_*).
 */
class RoleAndPermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (['admin', 'recepcionista', 'cliente'] as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }

        $this->command?->info('Roles base creados (admin, recepcionista, cliente).');
    }
}
