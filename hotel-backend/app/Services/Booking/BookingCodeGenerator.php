<?php

namespace App\Services\Booking;

use App\Models\Booking;
use Illuminate\Support\Str;

/**
 * Generador centralizado de códigos únicos de reserva (RES-XXXXXXXX).
 */
class BookingCodeGenerator
{
    public static function generate(): string
    {
        do {
            $code = 'RES-' . strtoupper(Str::random(8));
        } while (Booking::where('booking_code', $code)->exists());

        return $code;
    }
}
