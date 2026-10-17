<?php

namespace App\Listeners;

use App\Events\BookingCheckedOut;
use App\Services\HousekeepingService;

/**
 * Tras el check-out, crea la tarea de limpieza de la habitación (SHE-032).
 */
class CreateCheckoutCleaningTask
{
    public function __construct(private HousekeepingService $housekeeping)
    {
    }

    public function handle(BookingCheckedOut $event): void
    {
        try {
            $this->housekeeping->createCheckoutCleaning($event->booking->room_id, $event->booking);
        } catch (\Throwable $e) {
            report($e); // el check-out ya se realizó; la tarea puede crearse manualmente
        }
    }
}
