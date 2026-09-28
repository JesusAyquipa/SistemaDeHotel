<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Season;
use App\Models\Coupon;
use Carbon\Carbon;

class SettingsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Seasons
        $currentYear = date('Y');
        
        Season::create([
            'name' => 'Temporada Alta (Fiestas)',
            'start_date' => Carbon::create($currentYear, 12, 15)->toDateString(),
            'end_date' => Carbon::create($currentYear + 1, 1, 15)->toDateString(),
            'rate_adjustment' => 20.00,
            'is_active' => true,
        ]);

        Season::create([
            'name' => 'Verano',
            'start_date' => Carbon::create($currentYear, 6, 1)->toDateString(),
            'end_date' => Carbon::create($currentYear, 8, 31)->toDateString(),
            'rate_adjustment' => 15.00,
            'is_active' => true,
        ]);

        Season::create([
            'name' => 'Temporada Baja',
            'start_date' => Carbon::create($currentYear, 2, 1)->toDateString(),
            'end_date' => Carbon::create($currentYear, 3, 31)->toDateString(),
            'rate_adjustment' => -10.00,
            'is_active' => false,
        ]);

        // Coupons
        Coupon::create([
            'code' => 'WELCOME20',
            'discount_type' => 'percentage',
            'discount_value' => 20.00,
            'expires_at' => Carbon::create($currentYear + 1, 12, 31)->toDateString(),
            'max_uses' => 100,
            'current_uses' => 12,
            'is_active' => true,
        ]);

        Coupon::create([
            'code' => 'VIP50',
            'discount_type' => 'fixed',
            'discount_value' => 50.00,
            'expires_at' => Carbon::create($currentYear + 1, 6, 30)->toDateString(),
            'max_uses' => 50,
            'current_uses' => 45,
            'is_active' => true,
        ]);

        Coupon::create([
            'code' => 'WINTER23',
            'discount_type' => 'percentage',
            'discount_value' => 15.00,
            'expires_at' => Carbon::create($currentYear - 1, 2, 28)->toDateString(), // Expired
            'max_uses' => 150,
            'current_uses' => 150, // Exhausted
            'is_active' => true,
        ]);
    }
}
