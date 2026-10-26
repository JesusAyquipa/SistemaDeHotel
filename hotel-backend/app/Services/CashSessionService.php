<?php

namespace App\Services;

use App\Models\CashRegisterSession;
use App\Models\Payment;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * Cálculos de las sesiones de caja (SHE-014).
 *
 * Pagos de una sesión: completados, de importe positivo, aún no conciliados y creados
 * desde la apertura (opened_at) hasta el momento indicado.
 * Clasificación por método: efectivo => cash; tarjeta / voucher / mock => card; resto => other.
 */
class CashSessionService
{
    /** Métodos que se agrupan como "tarjeta" en el resumen de caja. */
    public const CARD_METHODS = ['Tarjeta', 'card', 'voucher', 'Voucher', 'mock'];

    public static function sessionPaymentsQuery(CashRegisterSession $session, ?CarbonInterface $until = null): Builder
    {
        $query = Payment::query()
            ->where('status', Payment::STATUS_COMPLETED)
            ->where('amount', '>', 0)
            ->where('is_reconciled', false)
            ->where('created_at', '>=', $session->opened_at);

        if ($until) {
            $query->where('created_at', '<=', $until);
        }

        return $query;
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
        ];
    }
}
