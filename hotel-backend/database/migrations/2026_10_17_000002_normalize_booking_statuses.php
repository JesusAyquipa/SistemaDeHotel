<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Normaliza los estados de reserva a los canónicos:
 *   pending_payment, confirmed, checked_in, checked_out, cancelled, expired
 *
 * Valores legados encontrados en código/seeders/frontend: pending, pendiente, confirmada,
 * reservada, completed, completada, cancelada, etc. Las reservas pending_payment creadas
 * por recepción con "pago en recepción" (cash_later) pasan a confirmed; el resto de
 * pending_payment recibe expires_at = created_at + 30 min (luego las expira el comando).
 */
return new class extends Migration
{
    private const MAP = [
        'pending'         => 'pending_payment',
        'pendiente'       => 'pending_payment',
        'pendiente_pago'  => 'pending_payment',
        'pending-payment' => 'pending_payment',
        'confirmada'      => 'confirmed',
        'confirmado'      => 'confirmed',
        'reservada'       => 'confirmed',
        'reservado'       => 'confirmed',
        'reserved'        => 'confirmed',
        'check_in'        => 'checked_in',
        'check-in'        => 'checked_in',
        'checked-in'      => 'checked_in',
        'checkin'         => 'checked_in',
        'en_curso'        => 'checked_in',
        'hospedado'       => 'checked_in',
        'completed'       => 'checked_out',
        'completada'      => 'checked_out',
        'completado'      => 'checked_out',
        'finalizada'      => 'checked_out',
        'check_out'       => 'checked_out',
        'check-out'       => 'checked_out',
        'checked-out'     => 'checked_out',
        'checkout'        => 'checked_out',
        'cancelada'       => 'cancelled',
        'cancelado'       => 'cancelled',
        'canceled'        => 'cancelled',
        'anulada'         => 'cancelled',
        'expirada'        => 'expired',
        'expirado'        => 'expired',
    ];

    public function up(): void
    {
        foreach (self::MAP as $legacy => $canonical) {
            DB::table('bookings')->where('status', $legacy)->update(['status' => $canonical]);
        }

        // Variantes con mayúsculas / espacios
        foreach (self::MAP as $legacy => $canonical) {
            DB::table('bookings')
                ->whereRaw('LOWER(TRIM(status)) = ?', [$legacy])
                ->update(['status' => $canonical]);
        }

        // Reservas de recepción con pago en el hotel (cash_later): son reservas confirmadas.
        $cashLaterIds = DB::table('payments')
            ->where('payment_method', 'cash_later')
            ->where('status', 'pending')
            ->pluck('booking_id');

        if ($cashLaterIds->isNotEmpty()) {
            DB::table('bookings')
                ->whereIn('id', $cashLaterIds)
                ->where('status', 'pending_payment')
                ->update(['status' => 'confirmed', 'expires_at' => null]);
        }

        // Resto de pendientes: plazo de 30 minutos desde su creación.
        DB::table('bookings')
            ->where('status', 'pending_payment')
            ->whereNull('expires_at')
            ->orderBy('id')
            ->get()
            ->each(function ($booking) {
                $created = $booking->created_at ? \Carbon\Carbon::parse($booking->created_at) : now();
                $update = ['expires_at' => $created->copy()->addMinutes(30)];

                // El código anterior incrementaba el cupón al crear el intent: marcarlo como
                // contabilizado para que la expiración libere ese uso.
                $payment = DB::table('payments')->where('booking_id', $booking->id)->orderBy('id')->first();
                $details = $payment && $payment->payment_details ? json_decode($payment->payment_details, true) : null;
                if (!empty($details['coupon_code'])) {
                    $couponId = DB::table('coupons')->where('code', $details['coupon_code'])->value('id');
                    if ($couponId) {
                        $update['coupon_id'] = $couponId;
                        $update['coupon_counted'] = true;
                        $update['discount_amount'] = (float) ($details['discount_amount'] ?? 0);
                    }
                }

                DB::table('bookings')->where('id', $booking->id)->update($update);
            });

        Schema::table('bookings', function (Blueprint $table) {
            $table->string('status')->default('pending_payment')->change();
        });
    }

    public function down(): void
    {
        // Migración de datos irreversible (los valores legados eran inconsistentes).
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('status')->default('pending')->change();
        });
    }
};
