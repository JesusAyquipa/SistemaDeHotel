<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Models\Payment;
use App\Services\CouponService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Marca como `expired` las reservas pending_payment cuyo plazo de pago venció,
 * cancela sus pagos pendientes y libera el uso de cupón si estaba contabilizado.
 */
class ExpirePendingBookings extends Command
{
    protected $signature = 'app:expire-pending-bookings';

    protected $description = 'Expira las reservas pendientes de pago cuyo plazo (expires_at) ya venció.';

    public function handle(CouponService $coupons): int
    {
        $count = 0;

        $ids = Booking::expiredPending()->pluck('id');

        foreach ($ids as $id) {
            $expired = DB::transaction(function () use ($id, $coupons) {
                $booking = Booking::whereKey($id)->lockForUpdate()->first();

                // Revalidar bajo bloqueo: pudo pagarse entretanto.
                if (!$booking || !$booking->isPendingExpired()) {
                    return false;
                }

                $coupons->releaseForBooking($booking);

                Payment::where('booking_id', $booking->id)
                    ->where('status', Payment::STATUS_PENDING)
                    ->update(['status' => Payment::STATUS_CANCELLED]);

                $booking->update(['status' => Booking::STATUS_EXPIRED]);

                return true;
            });

            if ($expired) {
                $count++;
            }
        }

        $this->info("Reservas expiradas: {$count}");

        return self::SUCCESS;
    }
}
