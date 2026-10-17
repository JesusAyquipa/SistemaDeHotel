<?php

namespace Tests\Unit;

use App\Services\BookingPricingService;
use Carbon\Carbon;
use PHPUnit\Framework\TestCase;

class BookingPricingServiceTest extends TestCase
{
    private BookingPricingService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new BookingPricingService();
    }

    public function test_applies_season_per_night_coupon_and_included_igv(): void
    {
        $checkIn = Carbon::today()->addDays(10);
        $checkOut = $checkIn->copy()->addDays(3); // 3 noches

        // Temporada alta +20% solo para la segunda noche
        $seasons = [[
            'name'            => 'Temporada Alta',
            'start_date'      => $checkIn->copy()->addDay()->toDateString(),
            'end_date'        => $checkIn->copy()->addDay()->toDateString(),
            'rate_adjustment' => 20,
            'is_active'       => true,
        ]];

        $quote = $this->service->calculate(100.00, $checkIn, $checkOut, $seasons, [
            'code' => 'DESC10', 'type' => 'percentage', 'value' => 10,
        ]);

        $this->assertSame(3, $quote['nights']);
        $this->assertEquals([100.0, 120.0, 100.0], array_column($quote['nightly'], 'price'));
        $this->assertSame('Temporada Alta', $quote['nightly'][1]['season']);
        $this->assertEquals(320.00, $quote['subtotal']);
        $this->assertEquals(20.00, $quote['season_adjustment']);
        $this->assertEquals(32.00, $quote['discount']);
        $this->assertEquals(288.00, $quote['total']);

        // IGV incluido: base = 288 / 1.18
        $this->assertTrue($quote['igv']['prices_include_igv']);
        $this->assertEquals(244.07, $quote['igv']['base']);
        $this->assertEquals(43.93, $quote['igv']['amount']);
        $this->assertEquals($quote['total'], round($quote['igv']['base'] + $quote['igv']['amount'], 2));
    }

    public function test_inactive_seasons_are_ignored_and_negative_adjustment_lowers_price(): void
    {
        $checkIn = Carbon::today()->addDays(5);
        $checkOut = $checkIn->copy()->addDays(2);

        $quote = $this->service->calculate(200.00, $checkIn, $checkOut, [
            ['name' => 'Inactiva', 'start_date' => $checkIn->toDateString(), 'end_date' => $checkOut->toDateString(), 'rate_adjustment' => 50, 'is_active' => false],
            ['name' => 'Baja', 'start_date' => $checkIn->toDateString(), 'end_date' => $checkOut->toDateString(), 'rate_adjustment' => -10, 'is_active' => true],
        ]);

        $this->assertEquals(360.00, $quote['total']);
        $this->assertEquals(-40.00, $quote['season_adjustment']);
        $this->assertEquals(0.0, $quote['discount']);
    }

    public function test_fixed_coupon_is_capped_and_percentage_cannot_exceed_100(): void
    {
        $this->assertEquals(100.00, BookingPricingService::couponDiscount(100.00, ['type' => 'fixed', 'value' => 500]));
        $this->assertEquals(100.00, BookingPricingService::couponDiscount(100.00, ['type' => 'percentage', 'value' => 150]));
        $this->assertEquals(0.0, BookingPricingService::couponDiscount(100.00, null));
    }

    public function test_igv_breakdown_of_total(): void
    {
        $igv = BookingPricingService::igvBreakdown(118.00);

        $this->assertEquals(100.00, $igv['base']);
        $this->assertEquals(18.00, $igv['amount']);
        $this->assertEquals(0.18, $igv['rate']);
    }
}
