<?php

namespace App\Services;

use App\Models\Booking;

/**
 * Totales del estado de cuenta (folio). Los importes incluyen IGV; el IGV se
 * informa como porción incluida (ver BookingPricingService::igvBreakdown).
 */
class FolioCalculator
{
    public function totals(Booking $booking): array
    {
        $lodging  = round((float) $booking->total_amount, 2);
        $charges  = $booking->chargesTotal();
        $total    = round($lodging + $charges, 2);
        $paid     = $booking->paidAmount();
        $refunded = $booking->refundedAmount();
        $igv      = BookingPricingService::igvBreakdown($total);

        return [
            'lodging'            => $lodging,
            'charges'            => $charges,
            'subtotal'           => $igv['base'],   // base imponible (sin IGV)
            'igv'                => $igv['amount'], // IGV incluido en el total
            'total'              => $total,
            'pagado'             => $paid,
            'refunds'            => $refunded,
            'saldo'              => max(0, round($total - $paid, 2)),
            'balance'            => round($total - $paid, 2),
            'prices_include_igv' => true,
            'igv_rate'           => BookingPricingService::IGV_RATE,
        ];
    }
}
