<?php

namespace App\Services;

use App\Models\CashRegisterSession;
use App\Models\Payment;
use App\Services\Booking\BookingException;
use Illuminate\Database\Eloquent\Builder;

/**
 * Cálculos de las sesiones de caja (SHE-014).
 *
 * Pagos de una sesión: completados, de importe positivo, aún no conciliados y atribuidos
 * explícitamente a la sesión (payments.cash_register_session_id). Los pagos en línea
 * (sin sesión) no son dinero de caja y se informan aparte.
 * Clasificación por método: efectivo => cash; tarjeta / voucher / mock => card; resto => other.
 */
class CashSessionService
{
    /** Métodos que se agrupan como "tarjeta" en el resumen de caja. */
    public const CARD_METHODS = ['Tarjeta', 'card', 'voucher', 'Voucher', 'mock'];

    public static function sessionPaymentsQuery(CashRegisterSession $session): Builder
    {
        return Payment::query()
            ->where('cash_register_session_id', $session->id)
            ->where('status', Payment::STATUS_COMPLETED)
            ->where('amount', '>', 0)
            ->where('is_reconciled', false);
    }

    /**
     * Sesión abierta del usuario, bloqueada (lockForUpdate) para serializar con el cierre.
     * Debe llamarse dentro de una transacción. Lanza 422 si no hay caja abierta.
     */
    public static function requireOpenSessionLocked(int $userId): CashRegisterSession
    {
        $session = CashRegisterSession::where('user_id', $userId)->open()->latest('id')->lockForUpdate()->first();
        if (!$session) {
            throw new BookingException('Debes abrir caja antes de registrar cobros', 422);
        }

        return $session;
    }

    /** Suma informativa de pagos en línea (sin sesión) completados desde la apertura. */
    public static function onlinePaymentsTotal(CashRegisterSession $session): float
    {
        return round((float) Payment::query()
            ->whereNull('cash_register_session_id')
            ->where('status', Payment::STATUS_COMPLETED)
            ->where('amount', '>', 0)
            ->where('created_at', '>=', $session->opened_at)
            ->sum('amount'), 2);
    }

    /**
     * Resume los importes por tipo de método.
     *
     * @param iterable<Payment> $payments
     * @return array{cash: float, card: float, other: float}
     */
    public static function classify(iterable $payments): array
    {
        $cash = $card = $other = 0.0;

        foreach ($payments as $p) {
            $amount = (float) $p->amount;
            if (in_array($p->payment_method, Payment::CASH_METHODS, true)) {
                $cash += $amount;
            } elseif (in_array($p->payment_method, self::CARD_METHODS, true)) {
                $card += $amount;
            } else {
                $other += $amount;
            }
        }

        return ['cash' => round($cash, 2), 'card' => round($card, 2), 'other' => round($other, 2)];
    }

    /**
     * Resumen de una sesión abierta (o cerrada: usa sus pagos conciliados).
     */
    public function summary(CashRegisterSession $session): array
    {
        $payments = self::sessionPaymentsQuery($session)->get(['id', 'amount', 'payment_method']);
        $totals = self::classify($payments);
        $opening = round((float) $session->opening_amount, 2);

        return [
            'opening_amount' => $opening,
            'cash_payments'  => $totals['cash'],
            'card_payments'  => $totals['card'],
            'other_payments' => $totals['other'],
            'expected_cash'  => round($opening + $totals['cash'], 2),
            'online_payments' => self::onlinePaymentsTotal($session),
        ];
    }
}
