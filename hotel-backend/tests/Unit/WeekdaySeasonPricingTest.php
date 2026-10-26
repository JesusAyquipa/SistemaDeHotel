<?php

namespace Tests\Unit;

use App\Services\BookingPricingService;
use Carbon\Carbon;
use PHPUnit\Framework\TestCase;

/**
 * SHE-018: temporadas por día de la semana (0 = domingo .. 6 = sábado).
 */
class WeekdaySeasonPricingTest extends TestCase
{
    private BookingPricingService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new BookingPricingService();
    }

    /** 2030-03-01 es viernes. */
    private function friday(): Carbon
    {
        return Carbon::parse('2030-03-01');
    }

    private function season(?array $days, float $percent = 50, array $extra = []): array
    {
        return array_merge([
            'name'            => 'Fin de semana',
            'start_date'      => '2030-02-01',
            'end_date'        => '2030-03-31',
            'rate_adjustment' => $percent,
            'is_active'       => true,
            'days_of_week'    => $days,
        ], $extra);
    }

    private function prices(array $quote): array
    {
        return array_map('floatval', array_column($quote['nightly'], 'price'));
    }

    public function test_fixture_date_is_a_friday(): void
    {
        $this->assertSame(5, $this->friday()->dayOfWeek);
    }

    public function test_weekend_season_applies_only_to_saturday_and_sunday_nights(): void
    {
        $in = $this->friday();
        // Vie, Sáb, Dom, Lun
        $quote = $this->service->calculate(100.0, $in, $in->copy()->addDays(4), [$this->season([6, 0])]);

        $this->assertSame([100.0, 150.0, 150.0, 100.0], $this->prices($quote));
        $this->assertNull($quote['nightly'][0]['season']);
        $this->assertSame('Fin de semana', $quote['nightly'][1]['season']);
        $this->assertSame(50.0, (float) $quote['nightly'][2]['adjustment_percent']);
        $this->assertEquals(500.0, $quote['subtotal']);
        $this->assertEquals(100.0, $quote['season_adjustment']);
    }

    public function test_null_and_empty_days_apply_every_night(): void
    {
        $in = $this->friday();

        foreach ([null, []] as $days) {
            $quote = $this->service->calculate(100.0, $in, $in->copy()->addDays(3), [$this->season($days)]);
            $this->assertSame([150.0, 150.0, 150.0], $this->prices($quote));
        }

        // Sin la clave days_of_week (compatibilidad con temporadas existentes)
        $legacy = $this->season(null);
        unset($legacy['days_of_week']);
        $quote = $this->service->calculate(100.0, $in, $in->copy()->addDays(2), [$legacy]);
        $this->assertSame([150.0, 150.0], $this->prices($quote));
    }

    public function test_weekday_filter_respects_the_date_range_too(): void
    {
        $in = $this->friday();
        // La temporada termina el sábado: el domingo ya no aplica aunque sea fin de semana
        $quote = $this->service->calculate(100.0, $in, $in->copy()->addDays(3), [
            $this->season([6, 0], 50, ['end_date' => '2030-03-02']),
        ]);

        $this->assertSame([100.0, 150.0, 100.0], $this->prices($quote));
    }

    public function test_non_matching_weekday_season_falls_through_to_the_next_season(): void
    {
        $in = $this->friday();
        $seasons = [
            $this->season([6], -20, ['name' => 'Sábados baratos']),   // prioridad mayor, solo sábado
            $this->season(null, 10, ['name' => 'Temporada media']),   // todos los días
        ];

        $quote = $this->service->calculate(100.0, $in, $in->copy()->addDays(3), $seasons);

        $this->assertSame([110.0, 80.0, 110.0], $this->prices($quote));
        $this->assertSame(['Temporada media', 'Sábados baratos', 'Temporada media'], array_column($quote['nightly'], 'season'));
    }

    public function test_invalid_day_values_are_ignored_and_json_strings_are_accepted(): void
    {
        $in = $this->friday();

        // Solo valores inválidos => se comporta como "todos los días"
        $quote = $this->service->calculate(100.0, $in, $in->copy()->addDays(2), [$this->season([9, -1, 'x'])]);
        $this->assertSame([150.0, 150.0], $this->prices($quote));

        // days_of_week como JSON (valor crudo de BD)
        $quote = $this->service->calculate(100.0, $in, $in->copy()->addDays(2), [$this->season(null, 50, ['days_of_week' => '[5]'])]);
        $this->assertSame([150.0, 100.0], $this->prices($quote));
    }

    public function test_sunday_is_zero(): void
    {
        $sunday = Carbon::parse('2030-03-03');
        $this->assertSame(0, $sunday->dayOfWeek);

        $quote = $this->service->calculate(100.0, $sunday, $sunday->copy()->addDay(), [$this->season([0])]);
        $this->assertSame([150.0], $this->prices($quote));
    }
}
