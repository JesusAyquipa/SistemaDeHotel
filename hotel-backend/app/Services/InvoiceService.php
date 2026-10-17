<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Invoice;
use App\Models\User;
use App\Services\Booking\BookingException;
use Illuminate\Support\Facades\DB;

/**
 * Emisión y anulación de comprobantes internos (SHE-027).
 *
 * - Correlativo por serie: la fila de invoice_series se bloquea (lockForUpdate)
 *   dentro de la transacción, por lo que dos emisiones simultáneas nunca obtienen
 *   el mismo número.
 * - Importes: los precios YA incluyen IGV (18%); el desglose base/IGV es el mismo
 *   que el del folio (BookingPricingService::igvBreakdown sobre el total).
 * - Una sola boleta/factura vigente (issued) por reserva.
 */
class InvoiceService
{
    /** Estados de reserva para los que se puede emitir un comprobante. */
    public const INVOICEABLE_STATUSES = [
        Booking::STATUS_CONFIRMED,
        Booking::STATUS_CHECKED_IN,
        Booking::STATUS_CHECKED_OUT,
        Booking::STATUS_NO_SHOW,
    ];

    /**
     * @param array{type:string, customer_doc_type:string, customer_doc_number:string, customer_name:string, customer_address?:?string} $data
     */
    public function issue(Booking $booking, array $data, ?User $user = null): Invoice
    {
        $invoice = DB::transaction(function () use ($booking, $data, $user) {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();

            if (!in_array($locked->status, self::INVOICEABLE_STATUSES, true)) {
                throw new BookingException('Solo se pueden emitir comprobantes de reservas confirmadas, en curso o finalizadas.', 422);
            }

            if (Invoice::where('booking_id', $locked->id)->active()->lockForUpdate()->exists()) {
                throw new BookingException('La reserva ya tiene un comprobante vigente. Anúlelo antes de emitir otro.', 409);
            }

            $items = $this->items($locked);
            $total = round(array_sum(array_column($items, 'total')), 2);
            if ($total <= 0) {
                throw new BookingException('La reserva no tiene importes facturables.', 422);
            }
            $igv = BookingPricingService::igvBreakdown($total);

            $series = Invoice::SERIES[$data['type']];
            $number = $this->nextNumber($series);

            return Invoice::create([
                'booking_id'          => $locked->id,
                'type'                => $data['type'],
                'series'              => $series,
                'number'              => $number,
                'customer_doc_type'   => strtoupper($data['customer_doc_type']),
                'customer_doc_number' => strtoupper(trim($data['customer_doc_number'])),
                'customer_name'       => trim($data['customer_name']),
                'customer_address'    => isset($data['customer_address']) ? (trim((string) $data['customer_address']) ?: null) : null,
                'subtotal'            => $igv['base'],
                'igv'                 => $igv['amount'],
                'total'               => $total,
                'items'               => $items,
                'issued_at'           => now(),
                'status'              => Invoice::STATUS_ISSUED,
                'issued_by'           => $user?->id,
            ]);
        });

        ActivityLogger::log(
            'invoice_issued',
            "Comprobante {$invoice->full_number} emitido para la reserva {$booking->booking_code} (S/ " . number_format((float) $invoice->total, 2) . ')',
            $invoice,
            ['type' => $invoice->type, 'total' => (float) $invoice->total],
            $user
        );

        return $invoice;
    }

    public function void(Invoice $invoice, string $reason, ?User $user = null): Invoice
    {
        $invoice = DB::transaction(function () use ($invoice, $reason, $user) {
            $locked = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === Invoice::STATUS_VOIDED) {
                throw new BookingException('El comprobante ya se encuentra anulado.', 422);
            }

            $locked->update([
                'status'        => Invoice::STATUS_VOIDED,
                'voided_reason' => $reason,
                'voided_at'     => now(),
                'voided_by'     => $user?->id,
            ]);

            return $locked;
        });

        ActivityLogger::log(
            'invoice_voided',
            "Comprobante {$invoice->full_number} anulado",
            $invoice,
            ['reason' => $reason],
            $user
        );

        return $invoice;
    }

    /**
     * Ítems del comprobante: alojamiento + consumos (precios con IGV incluido).
     */
    public function items(Booking $booking): array
    {
        $booking->loadMissing('room');
        $items = [];

        $lodging = round((float) $booking->total_amount, 2);
        if ($lodging > 0) {
            $nights = RefundPolicy::nights($booking);
            $roomLabel = $booking->room
                ? trim('Hab. ' . $booking->room->room_number . ' ' . ($booking->room->name ?? ''))
                : 'Habitación';
            $items[] = $this->line(
                "Hospedaje {$roomLabel} ({$nights} " . ($nights === 1 ? 'noche' : 'noches') . ") {$booking->check_in} al {$booking->check_out}",
                $nights,
                round($lodging / $nights, 2),
                $lodging
            );
        }

        foreach ($booking->charges()->orderBy('id')->get() as $charge) {
            $quantity = max(1, (int) $charge->quantity);
            $items[] = $this->line(
                (string) $charge->concept,
                $quantity,
                round((float) $charge->unit_price, 2),
                round((float) $charge->total, 2)
            );
        }

        return $items;
    }

    private function line(string $description, int $quantity, float $unitPrice, float $total): array
    {
        $igv = BookingPricingService::igvBreakdown($total);

        return [
            'description' => $description,
            'quantity'    => $quantity,
            'unit_price'  => $unitPrice,
            'base'        => $igv['base'],
            'igv'         => $igv['amount'],
            'total'       => $total,
        ];
    }

    /** Siguiente correlativo de la serie (bloquea la fila de la serie). */
    private function nextNumber(string $series): int
    {
        DB::table('invoice_series')->insertOrIgnore([
            'series'      => $series,
            'last_number' => 0,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        $row = DB::table('invoice_series')->where('series', $series)->lockForUpdate()->first();
        $next = (int) $row->last_number + 1;

        DB::table('invoice_series')->where('series', $series)->update([
            'last_number' => $next,
            'updated_at'  => now(),
        ]);

        return $next;
    }
}
