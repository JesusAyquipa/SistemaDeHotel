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
            \Illuminate\Support\Facades\DB::unprepared(file_get_contents($path));
            $this->command->info('Datos actuales insertados desde hotel_data.sql');
        }
    }
}
