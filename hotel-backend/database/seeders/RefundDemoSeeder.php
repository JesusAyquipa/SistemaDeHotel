<?php

namespace Database\Seeders;

use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\Guest;
use App\Models\Payment;
use App\Models\Room;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Reembolsos de demostración (SOLO entornos locales), coherentes con DemoDataSeeder
 * y con el flujo real (RefundPolicy / RefundController):
 *
 *  - Cada reembolso es un Payment con monto NEGATIVO junto al pago original completado.
 *  - Montos calculados con la política por defecto: cancelación con ≥48 h → 100 %,
 *    cancelación tardía o no-show → se retiene 1 noche.
 *  - Estados: pendientes, procesados (extorno a tarjeta, transferencia, efectivo) y rechazados.
 *  - Bitácora de auditoría con fechas coherentes (cancelación, no-show, aprobación, rechazo).
 *
 * Requiere los datos de DemoDataSeeder (reservas RES-DEMO0005 y RES-DEMO0010).
 * Uso: php artisan db:seed --class=RefundDemoSeeder  (idempotente).
 */
class RefundDemoSeeder extends Seeder
{
    private const REFUND_TX_PREFIX = 'REFUND-DEMO';

    private int $seq = 0;
    private ?User $admin = null;
    private ?User $reception = null;

    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->error('RefundDemoSeeder no se ejecuta en producción.');
            return;
        }

        if (Payment::where('transaction_id', 'like', self::REFUND_TX_PREFIX . '%')->exists()) {
            $this->command?->warn('Los reembolsos demo ya existen. Omitido.');
            return;
        }

        $this->admin = User::role('admin')->first();
        $this->reception = User::role('recepcionista')->first() ?? $this->admin;

        Model::unguard();
        try {
            Booking::withoutActivityLogging(fn () => Payment::withoutActivityLogging(fn () => DB::transaction(function () {
                $this->existingBookings();
                $this->newBookings();
            })));
        } finally {
            Model::reguard();
        }

        $this->command?->info('✅ Reembolsos demo generados.');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Reservas ya existentes en DemoDataSeeder

    private function existingBookings(): void
    {
        // RES-DEMO0005 (Raúl, cancelada con 4 días de anticipación → 100 %, extornado a tarjeta).
        $raul = Booking::where('booking_code', 'RES-DEMO0005')->first();
        if ($raul) {
            // Versiones previas del seeder dejaban el pago original como "refunded" (positivo).
            $raul->payments()->where('amount', '>', 0)->where('status', Payment::STATUS_REFUNDED)
                ->update(['status' => Payment::STATUS_COMPLETED]);

            $cancelledAt = Carbon::parse($raul->check_in)->subDays(4)->setTime(9, 45);
            $this->cancelBooking($raul, $cancelledAt, 100);
            $refund = $this->refund($raul, (float) $raul->total_amount, 'Cancelación de reserva', $cancelledAt);
            $this->approve($refund, 'card', 'EXT-' . $cancelledAt->format('ymd') . '-77421', $cancelledAt->copy()->addDay()->setTime(15, 20));
        }

        // RES-DEMO0010 (Camila, no-show automático → se retiene 1 noche, resto pendiente).
        $camila = Booking::where('booking_code', 'RES-DEMO0010')->first();
        if ($camila) {
            $markedAt = Carbon::parse($camila->check_in)->addDay()->setTime(12, 0);
            $nightly = $this->nightly($camila);
            $refund = $this->refund($camila, (float) $camila->total_amount - $nightly, 'No-show: devolución del saldo no penalizado', $markedAt);
            $this->stampBooking($camila, $markedAt);
            if ($refund) {
                $this->log('no_show',
                    "Reserva {$camila->booking_code} marcada como no-show (automático) — penalidad S/ " . number_format($nightly, 2)
                        . ', reembolso S/ ' . number_format(abs((float) $refund->amount), 2),
                    $camila, $markedAt, null,
                    ['penalty_amount' => $nightly, 'refund_amount' => abs((float) $refund->amount), 'automatic' => true]);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Reservas nuevas (habitaciones sin reservas demo, sin solapamientos)

    private function newBookings(): void
    {
        $g = fn (string $doc) => Guest::where('document_number', $doc)->first();
        $now = Carbon::now();

        $scenarios = [
            // [habitación, huésped (DNI/doc), in, out, creada (días), método pago original]
            // 1) Pierre cancela hoy un viaje en 12 días → 100 % — PENDIENTE
            ['401', 'FR9876543', +12, +15, -6, 'card', function (Booking $b) use ($now) {
                $at = $now->copy()->subHours(2);
                $this->cancelBooking($b, $at, 100);
                $this->refund($b, (float) $b->total_amount, 'Cancelación de reserva', $at);
            }],
            // 2) Ana cancela con menos de 48 h → se retiene 1 noche — PENDIENTE
            ['203', '72589631', +1, +3, -9, 'card', function (Booking $b) use ($now) {
                $at = $now->copy()->subMinutes(50);
                $amount = (float) $b->total_amount - $this->nightly($b);
                $this->cancelBooking($b, $at, (int) round($amount / (float) $b->total_amount * 100));
                $this->refund($b, $amount, 'Cancelación de reserva', $at);
            }],
            // 3) Lucas acorta su estancia de 3 a 2 noches → se devuelve 1 noche — PENDIENTE (reserva sigue confirmada)
            ['304', 'CE0045821', +15, +18, -12, 'card', function (Booking $b) use ($now) {
                $at = $now->copy()->subDay()->setTime(16, 10);
                $nightly = $this->nightly($b);
                $oldOut = $b->check_out;
                $newOut = Carbon::parse($b->check_out)->subDay()->format('Y-m-d');
                $newTotal = round((float) $b->total_amount - $nightly, 2);
                $pricing = $b->pricing_details ?? [];
                $pricing['nights'] = 2;
                $pricing['subtotal'] = $newTotal;
                $pricing['total'] = $newTotal;
                $b->forceFill(['check_out' => $newOut, 'total_amount' => $newTotal, 'pricing_details' => $pricing, 'updated_at' => $at])->saveQuietly();
                $this->refund($b, $nightly, 'Reducción por modificación de reserva', $at);
                $this->log('updated', "Reserva modificado(a): check_out, total_amount", $b, $at, $this->guestUser($b),
                    ['old' => ['check_out' => $oldOut, 'total_amount' => $newTotal + $nightly], 'new' => ['check_out' => $newOut, 'total_amount' => $newTotal]]);
            }, 'confirmed'],
            // 4) Sofía canceló con 4 días → 100 %, devuelto por transferencia — PROCESADO
            ['301', '41236587', -18, -16, -30, 'card', function (Booking $b) {
                $at = Carbon::parse($b->check_in)->subDays(4)->setTime(11, 5);
                $this->cancelBooking($b, $at, 100);
                $r = $this->refund($b, (float) $b->total_amount, 'Cancelación de reserva', $at);
                $this->approve($r, 'transfer', 'OP-00482915', $at->copy()->addDays(2)->setTime(10, 30));
            }],
            // 5) María (pagó en efectivo) cancela la víspera → se retiene 1 noche, devuelto en caja — PROCESADO
            ['105', '40125896', -6, -4, -15, 'cash', function (Booking $b) {
                $at = Carbon::parse($b->check_in)->subDay()->setTime(14, 0);
                $amount = (float) $b->total_amount - $this->nightly($b);
                $this->cancelBooking($b, $at, (int) round($amount / (float) $b->total_amount * 100));
                $r = $this->refund($b, $amount, 'Cancelación de reserva', $at);
                $this->approve($r, 'cash', null, $at->copy()->addDay()->setTime(10, 0));
            }],
            // 6) Diego cancela → 100 %, pero el banco ya aceptó un contracargo — RECHAZADO
            ['205', '70123456', -9, -7, -20, 'card', function (Booking $b) {
                $at = Carbon::parse($b->check_in)->subDays(3)->setTime(20, 15);
                $this->cancelBooking($b, $at, 100);
                $r = $this->refund($b, (float) $b->total_amount, 'Cancelación de reserva', $at);
                $this->reject($r, 'Contracargo aceptado por el banco emisor: el importe ya fue devuelto al titular de la tarjeta.', $at->copy()->addDays(2)->setTime(9, 40));
            }],
        ];

        $n = (int) Booking::where('booking_code', 'like', 'RES-DEMO%')
            ->get(['booking_code'])
            ->map(fn ($b) => (int) substr($b->booking_code, 8))
            ->max();

        foreach ($scenarios as $s) {
            [$roomNumber, $doc, $in, $out, $createdDays, $method, $apply] = $s;
            $status = $s[7] ?? Booking::STATUS_CANCELLED;
            $room = Room::where('room_number', $roomNumber)->first();
            $guest = $g($doc);
            if (!$room || !$guest) {
                continue;
            }
            $n++;
            $booking = $this->createBooking(sprintf('RES-DEMO%04d', $n), $room, $guest, $in, $out, $createdDays, $status);
            $this->originalPayment($booking, $method);
            $apply($booking);
        }
    }

    // ─────────────────────────────────────────────────────────────────────

    private function createBooking(string $code, Room $room, Guest $guest, int $in, int $out, int $createdDays, string $status): Booking
    {
        $nights = $out - $in;
        $nightly = (float) $room->effective_price;
        $total = round($nightly * $nights, 2);
        $createdAt = Carbon::today()->addDays($createdDays)->setTime(10, 30);

        return Booking::create([
            'booking_code' => $code,
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'check_in' => Carbon::today()->addDays($in)->format('Y-m-d'),
            'check_out' => Carbon::today()->addDays($out)->format('Y-m-d'),
            'total_amount' => $total,
            'status' => $status,
            'discount_amount' => 0,
            'pricing_details' => ['nights' => $nights, 'base_price' => $nightly, 'subtotal' => $total, 'discount_amount' => 0, 'total' => $total],
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);
    }

    private function originalPayment(Booking $booking, string $method): Payment
    {
        $this->seq++;
        $paidAt = Carbon::parse($booking->created_at)->addMinutes(3);
        $isCard = $method === 'card';

        return Payment::create([
            'booking_id' => $booking->id,
            'amount' => $booking->total_amount,
            'payment_method' => $method,
            'status' => Payment::STATUS_COMPLETED,
            'paid_at' => $paidAt,
            'transaction_id' => $isCard ? sprintf('sim_demo_r%05d', $this->seq) : null,
            'gateway_provider' => $isCard ? 'simulation' : 'manual',
            'currency' => 'PEN',
            'receipt_number' => sprintf('REC-%s-DEMOR%03d', $paidAt->format('Ym'), $this->seq),
            'payment_details' => $isCard
                ? ['brand' => ['visa', 'mastercard', 'amex'][$this->seq % 3], 'last4' => (string) (5100 + $this->seq * 7), 'demo' => true]
                : ['demo' => true],
            'is_reconciled' => true,
            'created_at' => $paidAt,
            'updated_at' => $paidAt,
        ]);
    }

    /** Igual que RefundPolicy::recordRefund, pero con fecha controlada. */
    private function refund(Booking $booking, float $amount, string $reason, Carbon $at): ?Payment
    {
        $amount = round(min($amount, max(0, $booking->paidAmount() - $booking->refundedAmount())), 2);
        if ($amount <= 0) {
            return null;
        }

        $original = $booking->payments()->where('status', Payment::STATUS_COMPLETED)->where('amount', '>', 0)->oldest()->first();
        $this->seq++;

        return Payment::create([
            'booking_id' => $booking->id,
            'amount' => -$amount,
            'payment_method' => $original->payment_method ?? 'card',
            'status' => Payment::STATUS_REFUND_PENDING,
            'transaction_id' => sprintf('%s%05d', self::REFUND_TX_PREFIX, $this->seq),
            'gateway_provider' => $original->gateway_provider ?? 'manual',
            'currency' => 'PEN',
            'payment_details' => [
                'reason' => $reason,
                'original_transaction_id' => $original->transaction_id ?? null,
                'demo' => true,
            ],
            'created_at' => $at,
            'updated_at' => $at,
        ]);
    }

    private function approve(?Payment $refund, string $method, ?string $reference, Carbon $at): void
    {
        if (!$refund) {
            return;
        }
        $labels = ['transfer' => 'Transferencia bancaria', 'card' => 'Extorno a tarjeta', 'cash' => 'Efectivo'];
        $details = $refund->payment_details ?? [];
        $details += ['refund_method' => $method, 'refund_reference' => $reference, 'processed_by' => $this->admin?->id, 'processed_at' => $at->toIso8601String()];

        $refund->forceFill(['status' => Payment::STATUS_REFUNDED, 'paid_at' => $at, 'payment_details' => $details, 'updated_at' => $at])->saveQuietly();

        $amount = abs((float) $refund->amount);
        $this->log('refund_approved',
            'Reembolso de S/ ' . number_format($amount, 2) . " aprobado para la reserva {$refund->booking->booking_code} ({$labels[$method]})",
            $refund, $at, $this->admin, ['method' => $method, 'reference' => $reference, 'amount' => $amount]);
    }

    private function reject(?Payment $refund, string $reason, Carbon $at): void
    {
        if (!$refund) {
            return;
        }
        $details = $refund->payment_details ?? [];
        $details += ['rejection_reason' => $reason, 'processed_by' => $this->admin?->id, 'processed_at' => $at->toIso8601String()];

        $refund->forceFill(['status' => Payment::STATUS_REFUND_REJECTED, 'payment_details' => $details, 'updated_at' => $at])->saveQuietly();

        $this->log('refund_rejected',
            'Reembolso de S/ ' . number_format(abs((float) $refund->amount), 2) . " rechazado para la reserva {$refund->booking->booking_code}",
            $refund, $at, $this->admin, ['reason' => $reason]);
    }

    private function cancelBooking(Booking $booking, Carbon $at, int $percentage): void
    {
        $this->stampBooking($booking, $at, Booking::STATUS_CANCELLED);
        $refundAmount = round((float) $booking->total_amount * $percentage / 100, 2);
        $this->log('cancel',
            "Reserva {$booking->booking_code} cancelada (reembolso {$percentage}%: S/ " . number_format($refundAmount, 2) . ')',
            $booking, $at, $this->guestUser($booking) ?? $this->reception);
    }

    private function stampBooking(Booking $booking, Carbon $at, ?string $status = null): void
    {
        $attrs = ['updated_at' => $at, 'expires_at' => null];
        if ($status) {
            $attrs['status'] = $status;
        }
        $booking->forceFill($attrs)->saveQuietly();
    }

    private function nightly(Booking $booking): float
    {
        $nights = max(1, Carbon::parse($booking->check_in)->diffInDays(Carbon::parse($booking->check_out)));

        return round((float) $booking->total_amount / $nights, 2);
    }

    private function guestUser(Booking $booking): ?User
    {
        $userId = $booking->guest?->user_id;

        return $userId ? User::find($userId) : null;
    }

    private function log(string $action, string $description, $subject, Carbon $at, ?User $user, ?array $changes = null): void
    {
        (new ActivityLog())->forceFill([
            'user_id' => $user?->id,
            'action' => $action,
            'subject_type' => class_basename($subject),
            'subject_id' => $subject->getKey(),
            'description' => $description,
            'changes' => $changes,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'DemoSeeder',
            'created_at' => $at,
        ])->save();
    }
}
