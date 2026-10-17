<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Payment;
use Carbon\Carbon;

/**
 * Política de reembolsos del hotel (configurable, ver CancellationPolicy / SHE-028):
 *  - Con al menos `free_cancellation_hours` de anticipación al check-in: reembolso total.
 *  - Menos anticipación (pero antes del día de check-in): se retiene una penalidad de
 *    `late_cancellation_penalty_nights` noches.
 *  - Desde el día de check-in (o no-show): se retienen `no_show_penalty_nights` noches.
 * La penalidad nunca supera el total de alojamiento. Solo se reembolsa dinero
 * efectivamente cobrado (pagos completados menos reembolsos ya registrados).
 */
class RefundPolicy
{
    public const WINDOW_FREE    = 'free';
    public const WINDOW_LATE    = 'late';
    public const WINDOW_NO_SHOW = 'no_show';

    /** Horas que faltan para el inicio del día de check-in (negativo si ya pasó). */
    public static function hoursUntilCheckIn(Booking $booking): float
    {
        $checkIn = Carbon::parse($booking->check_in)->startOfDay();

        return now()->diffInMinutes($checkIn, false) / 60;
    }

    public static function window(Booking $booking, ?array $policy = null): string
    {
        $policy ??= CancellationPolicy::current();
        $hours = self::hoursUntilCheckIn($booking);

        if ($hours >= $policy['free_cancellation_hours']) {
            return self::WINDOW_FREE;
        }

        return $hours > 0 ? self::WINDOW_LATE : self::WINDOW_NO_SHOW;
    }

    public static function nights(Booking $booking): int
    {
        $nights = Carbon::parse($booking->check_in)->startOfDay()
            ->diffInDays(Carbon::parse($booking->check_out)->startOfDay());

        return max(1, (int) $nights);
    }

    public static function nightlyRate(Booking $booking): float
    {
        return round((float) $booking->total_amount / self::nights($booking), 2);
    }

    /**
     * Penalidad (monto retenido) para una ventana dada.
     *
     * @return array{window:string, penalty_nights:int, penalty_amount:float}
     */
    public static function penalty(Booking $booking, ?string $window = null, ?array $policy = null): array
    {
        $policy ??= CancellationPolicy::current();
        $window ??= self::window($booking, $policy);

        $nights = match ($window) {
            self::WINDOW_FREE    => 0,
            self::WINDOW_LATE    => (int) $policy['late_cancellation_penalty_nights'],
            default              => (int) $policy['no_show_penalty_nights'],
        };
        $nights = min($nights, self::nights($booking));
        $amount = min(round($nights * self::nightlyRate($booking), 2), round((float) $booking->total_amount, 2));

        return ['window' => $window, 'penalty_nights' => $nights, 'penalty_amount' => $amount];
    }

    /**
     * Reembolso por cancelación (o no-show si $window = no_show).
     *
     * @return array{window:string, penalty_nights:int, penalty_amount:float, refundable:float, refund_amount:float, refund_percentage:int}
     */
    public static function cancellationRefund(Booking $booking, ?string $window = null): array
    {
        $penalty = self::penalty($booking, $window);
        $refundable = self::refundableBalance($booking);
        $refund = max(0, round($refundable - $penalty['penalty_amount'], 2));

        return $penalty + [
            'refundable'        => $refundable,
            'refund_amount'     => $refund,
            'refund_percentage' => self::percentOf($refund, $refundable, $penalty['window']),
        ];
    }

    /**
     * Reembolso por una reducción del importe al modificar una reserva confirmada:
     * se reembolsa la reducción menos la penalidad de la ventana actual.
     */
    public static function modificationRefund(Booking $booking, float $reduction): array
    {
        $penalty = self::penalty($booking);
        $reduction = round(abs($reduction), 2);
        $refund = max(0, round($reduction - $penalty['penalty_amount'], 2));

        return $penalty + [
            'refundable'        => $reduction,
            'refund_amount'     => $refund,
            'refund_percentage' => self::percentOf($refund, $reduction, $penalty['window']),
        ];
    }

    /** Porcentaje de reembolso de la cancelación en este momento (compatibilidad). */
    public static function percentage(Booking $booking): int
    {
        $penalty = self::penalty($booking);
        $base = round((float) $booking->total_amount, 2);
        $refund = max(0, $base - $penalty['penalty_amount']);

        return self::percentOf($refund, $base, $penalty['window']);
    }

    private static function percentOf(float $refund, float $base, string $window): int
    {
        if ($base <= 0) {
            return $window === self::WINDOW_FREE ? 100 : 0;
        }

        return (int) round($refund / $base * 100);
    }

    /** Monto cobrado aún no reembolsado. */
    public static function refundableBalance(Booking $booking): float
    {
        return max(0, round($booking->paidAmount() - $booking->refundedAmount(), 2));
    }

    /**
     * Registra un reembolso pendiente (monto negativo). Devuelve null si el monto es 0.
     */
    public static function recordRefund(Booking $booking, float $amount, string $reason, ?string $method = null): ?Payment
    {
        $amount = round(min($amount, self::refundableBalance($booking)), 2);
        if ($amount <= 0) {
            return null;
        }

        $original = $booking->payments()
            ->where('status', Payment::STATUS_COMPLETED)
            ->where('amount', '>', 0)
            ->latest()
            ->first();

        return Payment::create([
            'booking_id'       => $booking->id,
            'amount'           => -$amount,
            'payment_method'   => $method ?? ($original->payment_method ?? 'card'),
            'status'           => Payment::STATUS_REFUND_PENDING,
            'transaction_id'   => 'REFUND-' . strtoupper(\Illuminate\Support\Str::random(10)),
            'gateway_provider' => $original->gateway_provider ?? 'manual',
            'currency'         => 'PEN',
            'payment_details'  => [
                'reason'                  => $reason,
                'original_transaction_id' => $original->transaction_id ?? null,
            ],
        ]);
    }
}
