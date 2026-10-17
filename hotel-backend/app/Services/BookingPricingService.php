<?php

namespace App\Services;

use App\Models\Room;
use App\Models\Season;
use App\Services\Booking\BookingException;
use Carbon\Carbon;

/**
 * Cálculo de precios de reservas (única fuente de verdad).
 *
 * Política de IGV: los precios publicados YA INCLUYEN el IGV (18%). El total es lo que
 * paga el huésped; en comprobantes y folios el IGV se muestra como la porción incluida
 * (base = total / 1.18, igv = total - base).
 *
 * Temporadas: rate_adjustment es un porcentaje (20.00 = +20%, -10.00 = -10%) aplicado a
 * cada noche cuya fecha cae dentro de [start_date, end_date] (inclusive) de una temporada
 * activa. Si varias temporadas se cruzan, gana la específica del tipo de habitación
 * (SHE-034) y, dentro de cada grupo, la primera del iterable (quote() las ordena por
 * start_date más reciente). Las temporadas con room_type_id solo aplican a ese tipo.
 *
 * Cupones: se aplican sobre el subtotal (ya ajustado por temporada). Porcentaje <= 100,
 * monto fijo limitado al subtotal.
 */
class BookingPricingService
{
    public const IGV_RATE = 0.18;

    /**
     * Cotiza una estadía consultando las temporadas activas en BD.
     */
    public function quote(Room $room, $checkIn, $checkOut, ?array $couponTerms = null): array
    {
        $in  = Carbon::parse($checkIn)->startOfDay();
        $out = Carbon::parse($checkOut)->startOfDay();

        // SHE-034: temporadas generales + las del tipo de la habitación.
        $roomTypeId = $room->room_type_id ? (int) $room->room_type_id : null;
        $seasons = Season::activeBetween($in->toDateString(), $out->copy()->subDay()->toDateString())
            ->forRoomType($roomTypeId)
            ->orderByDesc('start_date')
            ->orderByDesc('id')
            ->get();

        // Precio efectivo (override de la habitación ?? tarifa base del tipo): Room::effective_price
        return $this->calculate($room->effective_price, $in, $out, $seasons, $couponTerms, $roomTypeId);
    }

    /**
     * Cálculo puro (sin BD). $seasons: iterable de modelos Season o arrays con
     * name, start_date, end_date, rate_adjustment[, is_active], en orden de prioridad.
     */
    public function calculate(float $pricePerNight, $checkIn, $checkOut, iterable $seasons = [], ?array $couponTerms = null, ?int $roomTypeId = null): array
    {
        $in  = Carbon::parse($checkIn)->startOfDay();
        $out = Carbon::parse($checkOut)->startOfDay();

        if ($out->lte($in)) {
            throw new BookingException('La fecha de check-out debe ser posterior a la de check-in.', 422);
        }

        $normalized = [];
        foreach ($seasons as $season) {
            $active = data_get($season, 'is_active', true);
            if ($active === false || $active === 0 || $active === '0') {
                continue;
            }
            // SHE-034: una temporada con tipo solo aplica a ese tipo (null = todos).
            $seasonType = data_get($season, 'room_type_id');
            if ($seasonType !== null && (int) $seasonType !== (int) $roomTypeId) {
                continue;
            }
            $normalized[] = [
                'typed'   => $seasonType !== null,
                'name'    => (string) data_get($season, 'name', ''),
                'start'   => Carbon::parse(data_get($season, 'start_date'))->toDateString(),
                'end'     => Carbon::parse(data_get($season, 'end_date'))->toDateString(),
                'percent' => (float) data_get($season, 'rate_adjustment', 0),
            ];
        }

        // Las temporadas específicas del tipo tienen prioridad sobre las generales
        // (orden estable: dentro de cada grupo se respeta el orden recibido).
        $normalized = array_merge(
            array_values(array_filter($normalized, fn ($s) => $s['typed'])),
            array_values(array_filter($normalized, fn ($s) => !$s['typed']))
        );

        $nightly = [];
        $subtotal = 0.0;
        $base = round($pricePerNight, 2);

        for ($date = $in->copy(); $date->lt($out); $date->addDay()) {
            $day = $date->toDateString();
            $applied = null;
            foreach ($normalized as $season) {
                if ($season['start'] <= $day && $day <= $season['end']) {
                    $applied = $season;
                    break;
                }
            }

            $percent = $applied['percent'] ?? 0.0;
            $price = max(0, round($base * (1 + $percent / 100), 2));
            $subtotal += $price;

            $nightly[] = [
                'date'               => $day,
                'base_price'         => $base,
                'season'             => $applied['name'] ?? null,
                'adjustment_percent' => $percent,
                'price'              => $price,
            ];
        }

        $nights = count($nightly);
        $subtotal = round($subtotal, 2);
        $baseSubtotal = round($base * $nights, 2);
        $discount = self::couponDiscount($subtotal, $couponTerms);
        $total = max(0, round($subtotal - $discount, 2));

        return [
            'nights'            => $nights,
            'price_per_night'   => $base,
            'nightly'           => $nightly,
            'base_subtotal'     => $baseSubtotal,
            'season_adjustment' => round($subtotal - $baseSubtotal, 2),
            'subtotal'          => $subtotal,
            'discount'          => $discount,
            'coupon'            => $couponTerms,
            'total'             => $total,
            'igv'               => self::igvBreakdown($total),
            'currency'          => 'PEN',
        ];
    }

    /**
     * Descuento de un cupón (snapshot de términos) sobre un subtotal.
     */
    public static function couponDiscount(float $subtotal, ?array $terms): float
    {
        if (!$terms || $subtotal <= 0) {
            return 0.0;
        }

        $value = (float) ($terms['value'] ?? 0);
        if ($value <= 0) {
            return 0.0;
        }

        if (($terms['type'] ?? null) === 'percentage') {
            return round($subtotal * min($value, 100) / 100, 2);
        }

        if (($terms['type'] ?? null) === 'fixed') {
            return round(min($value, $subtotal), 2);
        }

        return 0.0;
    }

    /**
     * Desglosa el IGV incluido en un total.
     */
    public static function igvBreakdown(float $total): array
    {
        $total = round($total, 2);
        $base = round($total / (1 + self::IGV_RATE), 2);

        return [
            'rate'               => self::IGV_RATE,
            'prices_include_igv' => true,
            'total'              => $total,
            'base'               => $base,
            'amount'             => round($total - $base, 2),
        ];
    }
}
