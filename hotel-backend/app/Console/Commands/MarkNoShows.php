<?php

namespace App\Console\Commands;

use App\Services\Booking\BookingException;
use App\Services\NoShowService;
use Illuminate\Console\Command;

/**
 * Marca como no_show las reservas confirmadas cuyo huésped no llegó: el plazo vence
 * a las 12:00 del día siguiente al check-in más las horas de gracia configuradas
 * (no_show_grace_hours). Aplica la penalidad y libera cupón y habitación.
 */
class MarkNoShows extends Command
{
    protected $signature = 'app:mark-no-shows';

    protected $description = 'Marca como no-show las reservas confirmadas cuyo huésped no se presentó.';

    public function handle(NoShowService $noShows): int
    {
        $count = 0;

        foreach ($noShows->overdueQuery()->pluck('id') as $id) {
            $booking = \App\Models\Booking::find($id);
            if (!$booking) {
                continue;
            }

            try {
                $noShows->mark($booking, null, true);
                $count++;
            } catch (BookingException $e) {
                // Cambió de estado entretanto (check-in, cancelación...): se omite.
            }
        }

        $this->info("Reservas marcadas como no-show: {$count}");

        return self::SUCCESS;
    }
}
