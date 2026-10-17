<?php

namespace App\Events;

use App\Models\Booking;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Se dispara cuando una reserva realiza el check-out (BookingController::checkOut).
 */
class BookingCheckedOut
{
    use Dispatchable, SerializesModels;

    public function __construct(public Booking $booking)
    {
    }
}
