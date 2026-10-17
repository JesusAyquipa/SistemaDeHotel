<?php

namespace Tests\Unit;

use App\Services\BookingPricingService;
use Carbon\Carbon;
use PHPUnit\Framework\TestCase;

/**
 * SHE-034: temporadas por tipo de habitación en el cálculo puro.
 */
class RoomTypePricingTest extends TestCase
{
    public function test_type_specific_season_applies_only_to_its_type_and_wins_over_general(): void
    {
        $service = new BookingPricingService();
        $in = Carbon::parse('2027-02-01');
        $out = $in->copy()->addDays(2);

        $seasons = [
            ['name' => 'General', 'start_date' => '2027-02-01', 'end_date' => '2027-02-02', 'rate_adjustment' => 10],
            ['name' => 'Suite', 'start_date' => '2027-02-02', 'end_date' => '2027-02-02', 'rate_adjustment' => 50, 'room_type_id' => 7],
        ];

        $suite = $service->calculate(400, $in, $out, $seasons, null, 7);
        $this->assertEquals([440.0, 600.0], array_column($suite['nightly'], 'price'));
        $this->assertSame('Suite', $suite['nightly'][1]['season']);

        $other = $service->calculate(200, $in, $out, $seasons, null, 3);
        $this->assertEquals([220.0, 220.0], array_column($other['nightly'], 'price'));

        $untyped = $service->calculate(200, $in, $out, $seasons);
        $this->assertEquals([220.0, 220.0], array_column($untyped['nightly'], 'price'));
    }
}
