<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\Room;
use App\Models\User;
use App\Services\Booking\BookingException;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * No-show (SHE-028): el huésped con reserva confirmada no se presentó.
 * Se retiene la penalidad configurada (no_show_penalty_nights), se registra el
 * reembolso del resto (refund_pending), se libera el uso del cupón (igual que en
 * la expiración: CouponService::releaseForBooking) y la habitación deja de estar
 * bloqueada (no_show no es un estado bloqueante).
 */
class NoShowService
{
    public function __construct(private CouponService $coupons)
    {
    }

    /**
     * @return array{booking:Booking, refund:?Payment, penalty_amount:float, refund_amount:float}
     */
    public function mark(Booking $booking, ?User $user = null, bool $automatic = false): array
    {
        $outcome = DB::transaction(function () use ($booking) {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== Booking::STATUS_CONFIRMED) {
                throw new BookingException('Solo las reservas confirmadas pueden marcarse como no-show.', 422);
            }
            if (Carbon::parse($locked->check_in)->startOfDay()->gt(now()->startOfDay())) {
                throw new BookingException('No se puede marcar no-show antes de la fecha de check-in.', 422);
            }

            $calc = RefundPolicy::cancellationRefund($locked, RefundPolicy::WINDOW_NO_SHOW);

            Payment::where('booking_id', $locked->id)
                ->where('status', Payment::STATUS_PENDING)
                ->update(['status' => Payment::STATUS_CANCELLED]);

            $this->coupons->releaseForBooking($locked);

            $locked->update(['status' => Booking::STATUS_NO_SHOW, 'expires_at' => null]);

            // Si la habitación quedó marcada como reservada, se libera.
            Room::whereKey($locked->room_id)
                ->where('status', Room::STATUS_RESERVED)
                ->update(['status' => Room::STATUS_AVAILABLE]);

            $refund = RefundPolicy::recordRefund($locked, $calc['refund_amount'], 'No-show: devolución del saldo no penalizado');

            return [
                'booking'        => $locked,
                'refund'         => $refund,
                'penalty_amount' => $calc['penalty_amount'],
                'refund_amount'  => $refund ? abs((float) $refund->amount) : 0.0,
            ];
        });

        ActivityLogger::log(
            'no_show',
            "Reserva {$outcome['booking']->booking_code} marcada como no-show" . ($automatic ? ' (automático)' : '')
                . ' — penalidad S/ ' . number_format($outcome['penalty_amount'], 2)
                . ', reembolso S/ ' . number_format($outcome['refund_amount'], 2),
            $outcome['booking'],
            ['penalty_amount' => $outcome['penalty_amount'], 'refund_amount' => $outcome['refund_amount'], 'automatic' => $automatic],
            $user
        );

        return $outcome;
    }

    /**
     * Reservas confirmadas que ya superaron el plazo de llegada: el huésped tenía
     * hasta las 12:00 del día siguiente al check-in + no_show_grace_hours.
     */
    public function overdueQuery(?array $policy = null): Builder
    {
        $policy ??= CancellationPolicy::current();
        // check_in + 1 día 12:00 + gracia <= now  ⇔  check_in <= now - gracia - 12h - 1 día (fecha)
        $latestCheckIn = now()->subHours((int) $policy['no_show_grace_hours'])->subHours(12)->subDay()->toDateString();

        return Booking::where('status', Booking::STATUS_CONFIRMED)
            ->whereDate('check_in', '<=', $latestCheckIn);
    }
}
