<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class CurrentStateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $path = database_path('seeders/hotel_data.sql');
        if (file_exists($path)) {
            $host = config('database.connections.mysql.host');
            $user = config('database.connections.mysql.username');
            $pass = config('database.connections.mysql.password');
            $db = config('database.connections.mysql.database');
            
            $command = sprintf(
                'mysql -h %s -u %s -p%s --skip-ssl %s < %s',
                escapeshellarg($host),
                escapeshellarg($user),
                escapeshellarg($pass),
                escapeshellarg($db),
                escapeshellarg($path)
            );
            
            exec($command, $output, $returnVar);
            
            if ($returnVar === 0) {
                $this->command->info('Datos actuales insertados desde hotel_data.sql (usando mysql-client)');
            } else {
                $this->command->error('Error insertando datos desde hotel_data.sql');
            }
        }
    }
}
