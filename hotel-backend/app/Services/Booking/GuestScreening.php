<?php

namespace App\Services\Booking;

use App\Models\Guest;

/**
 * Control de huéspedes en lista negra (SHE-033).
 * El mensaje es deliberadamente genérico: nunca revela que el huésped está vetado.
 */
class GuestScreening
{
    public const BLOCKED_MESSAGE = 'No es posible procesar la reserva';

    public static function isAllowed(?Guest $guest): bool
    {
        return !$guest || !$guest->is_blacklisted;
    }

    /**
     * @throws BookingException 422 si el huésped está en lista negra
     */
    public static function assertAllowed(?Guest $guest): void
    {
        if (!self::isAllowed($guest)) {
            throw new BookingException(self::BLOCKED_MESSAGE, 422);
        }
    }
}
