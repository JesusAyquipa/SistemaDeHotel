<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Coupon;
use Illuminate\Support\Facades\DB;

/**
 * Validación y contabilización atómica de usos de cupones.
 * Los usos se incrementan SOLO cuando el pago se completa (o el personal confirma la reserva).
 */
class CouponService
{
    /**
     * Devuelve el cupón si es válido ahora (activo, vigente hasta el fin del día de expiración,
     * con usos disponibles y porcentaje <= 100). Null en caso contrario.
     */
    public function findValid(?string $code): ?Coupon
    {
        if ($code === null || trim($code) === '') {
            return null;
        }

        $coupon = Coupon::where('code', trim($code))->first();

        return ($coupon && $coupon->isCurrentlyValid()) ? $coupon : null;
    }

    /**
     * Incrementa current_uses de forma atómica (lockForUpdate + update condicional
     * "current_uses < max_uses"). Devuelve false si el cupón se agotó/expiró entretanto.
     */
    public function consume(int $couponId): bool
    {
        return DB::transaction(function () use ($couponId) {
            $coupon = Coupon::whereKey($couponId)->lockForUpdate()->first();
            if (!$coupon || !$coupon->isCurrentlyValid()) {
                return false;
            }

            $affected = Coupon::whereKey($couponId)
                ->where(function ($q) {
                    $q->whereNull('max_uses')->orWhereColumn('current_uses', '<', 'max_uses');
                })
                ->increment('current_uses');

            return $affected > 0;
        });
    }

    /**
     * Libera un uso previamente contabilizado (expiración / fallo de pago).
     */
    public function release(int $couponId): void
    {
        Coupon::whereKey($couponId)->where('current_uses', '>', 0)->decrement('current_uses');
    }

    /**
     * Contabiliza el uso del cupón de una reserva si aún no se contabilizó.
     * Llamar dentro de una transacción con la reserva bloqueada.
     */
    public function consumeForBooking(Booking $booking): bool
    {
        if (!$booking->coupon_id || $booking->coupon_counted) {
            return true;
        }

        if (!$this->consume((int) $booking->coupon_id)) {
            return false;
        }

        $booking->forceFill(['coupon_counted' => true])->save();

        return true;
    }

    /**
     * Libera el uso del cupón de una reserva si estaba contabilizado.
     */
    public function releaseForBooking(Booking $booking): void
    {
        if ($booking->coupon_id && $booking->coupon_counted) {
            $this->release((int) $booking->coupon_id);
            $booking->forceFill(['coupon_counted' => false])->save();
        }
    }
}
