<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\RefundApprovedMail;
use App\Models\Payment;
use App\Services\ActivityLogger;
use App\Services\Booking\BookingException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

/**
 * Gestión de reembolsos (SHE-029). Solo administradores.
 * Los reembolsos son filas de payments con monto negativo y estado refund_pending.
 */
class RefundController extends Controller
{
    private const PER_PAGE = 20;

    public const METHODS = ['transfer', 'card', 'cash'];

    private const METHOD_LABELS = [
        'transfer' => 'Transferencia bancaria',
        'card'     => 'Extorno a tarjeta',
        'cash'     => 'Efectivo',
    ];

    /** GET /api/staff/refunds?status=refund_pending|refunded|refund_rejected */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in([Payment::STATUS_REFUND_PENDING, Payment::STATUS_REFUNDED, Payment::STATUS_REFUND_REJECTED])],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $status = $validated['status'] ?? Payment::STATUS_REFUND_PENDING;

        $query = Payment::with(['booking:id,booking_code,guest_id,room_id,check_in,check_out,status,total_amount', 'booking.guest:id,name,surname,email,document_number', 'booking.room:id,room_number,name'])
            ->where('status', $status)
            ->where('amount', '<', 0);

        if (!empty($validated['search'])) {
            $like = '%' . str_replace(['%', '_'], ['\%', '\_'], trim($validated['search'])) . '%';
            $query->whereHas('booking', function ($b) use ($like) {
                $b->where('booking_code', 'like', $like)
                  ->orWhereHas('guest', fn ($g) => $g->where('name', 'like', $like)->orWhere('surname', 'like', $like)->orWhere('email', 'like', $like));
            });
        }

        $page = $query->orderByDesc($status === Payment::STATUS_REFUND_PENDING ? 'created_at' : 'updated_at')
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        $page->getCollection()->transform(fn (Payment $p) => $this->present($p));

        return response()->json($page);
    }

    /** POST /api/staff/refunds/{paymentId}/approve {method, reference?} */
    public function approve(Request $request, $paymentId): JsonResponse
    {
        $validated = $request->validate([
            'method'    => ['required', Rule::in(self::METHODS)],
            'reference' => ['nullable', 'string', 'max:100'],
        ], [], ['method' => 'método de reembolso', 'reference' => 'referencia']);

        $payment = $this->transition($paymentId, function (Payment $payment) use ($validated, $request) {
            $details = $payment->payment_details ?? [];
            $details['refund_method'] = $validated['method'];
            $details['refund_reference'] = $validated['reference'] ?? null;
            $details['processed_by'] = $request->user()?->id;
            $details['processed_at'] = now()->toIso8601String();

            $payment->update([
                'status'          => Payment::STATUS_REFUNDED,
                'paid_at'         => now(),
                'payment_details' => $details,
            ]);
        });

        $amount = abs((float) $payment->amount);
        ActivityLogger::log(
            'refund_approved',
            "Reembolso de S/ " . number_format($amount, 2) . " aprobado para la reserva {$payment->booking?->booking_code} (" . self::METHOD_LABELS[$validated['method']] . ')',
            $payment,
            ['method' => $validated['method'], 'reference' => $validated['reference'] ?? null, 'amount' => $amount]
        );

        $email = $payment->booking?->guest?->email;
        if ($email) {
            try {
                Mail::to($email)->send(new RefundApprovedMail(
                    $payment->booking,
                    $amount,
                    self::METHOD_LABELS[$validated['method']],
                    $validated['reference'] ?? null
                ));
            } catch (\Throwable $e) {
                Log::error('No se pudo enviar el correo de reembolso aprobado', ['error' => get_class($e)]);
            }
        }

        return response()->json([
            'message' => 'Reembolso aprobado.',
            'refund'  => $this->present($payment),
        ]);
    }

    /** POST /api/staff/refunds/{paymentId}/reject {reason} */
    public function reject(Request $request, $paymentId): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:255'],
        ], [], ['reason' => 'motivo']);

        $payment = $this->transition($paymentId, function (Payment $payment) use ($validated, $request) {
            $details = $payment->payment_details ?? [];
            $details['rejection_reason'] = $validated['reason'];
            $details['processed_by'] = $request->user()?->id;
            $details['processed_at'] = now()->toIso8601String();

            $payment->update([
                'status'          => Payment::STATUS_REFUND_REJECTED,
                'payment_details' => $details,
            ]);
        });

        ActivityLogger::log(
            'refund_rejected',
            "Reembolso de S/ " . number_format(abs((float) $payment->amount), 2) . " rechazado para la reserva {$payment->booking?->booking_code}",
            $payment,
            ['reason' => $validated['reason']]
        );

        return response()->json([
            'message' => 'Reembolso rechazado.',
            'refund'  => $this->present($payment),
        ]);
    }

    private function transition($paymentId, callable $apply): Payment
    {
        $payment = DB::transaction(function () use ($paymentId, $apply) {
            $payment = Payment::whereKey($paymentId)->lockForUpdate()->first();
            if (!$payment || (float) $payment->amount >= 0) {
                throw new BookingException('Reembolso no encontrado.', 404);
            }
            if ($payment->status !== Payment::STATUS_REFUND_PENDING) {
                throw new BookingException('El reembolso ya fue procesado.', 409);
            }

            $apply($payment);

            return $payment;
        });

        return $payment->fresh(['booking.guest', 'booking.room']);
    }

    private function present(Payment $payment): array
    {
        $details = $payment->payment_details ?? [];
        $booking = $payment->booking;
        $guest = $booking?->guest;

        return [
            'id'               => $payment->id,
            'amount'           => abs((float) $payment->amount),
            'status'           => $payment->status,
            'original_method'  => $payment->payment_method,
            'reason'           => $details['reason'] ?? null,
            'refund_method'    => $details['refund_method'] ?? null,
            'refund_reference' => $details['refund_reference'] ?? null,
            'rejection_reason' => $details['rejection_reason'] ?? null,
            'processed_at'     => $details['processed_at'] ?? null,
            'created_at'       => $payment->created_at?->toIso8601String(),
            'booking'          => $booking ? [
                'id'           => $booking->id,
                'booking_code' => $booking->booking_code,
                'status'       => $booking->status,
                'check_in'     => $booking->check_in,
                'check_out'    => $booking->check_out,
                'total_amount' => (float) $booking->total_amount,
                'room'         => $booking->room ? ['room_number' => $booking->room->room_number, 'name' => $booking->room->name] : null,
                'guest'        => $guest ? [
                    'name'  => trim($guest->name . ' ' . ($guest->surname ?? '')),
                    'email' => $guest->email,
                ] : null,
            ] : null,
        ];
    }
}
