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
            $sql = file_get_contents($path);
            try {
                \Illuminate\Support\Facades\DB::unprepared($sql);
                $this->command->info('Datos actuales insertados desde hotel_data.sql (usando PDO)');
            } catch (\Exception $e) {
                $this->command->error('Error insertando datos desde hotel_data.sql: ' . $e->getMessage());
            }
        }
    }
}
