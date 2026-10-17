<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingPrecheck;
use App\Models\Charge;
use App\Models\Payment;
use App\Services\ActivityLogger;
use App\Services\FolioCalculator;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Portal del cliente (SHE-036): estado de cuenta y pre check-in online.
 */
class GuestPortalController extends Controller
{
    private const NAME_REGEX = '/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/u';

    public function __construct(private FolioCalculator $folio)
    {
    }

    /**
     * Estado de cuenta de la reserva (dueño o personal; si no, 404).
     * GET /api/bookings/{code}/folio
     */
    public function folio(Request $request, string $code): JsonResponse
    {
        $booking = $this->findAccessible($request, $code);
        if (!$booking) {
            return $this->notFound();
        }

        $charges = Charge::where('booking_id', $booking->id)
            ->orderBy('date')
            ->get(['id', 'date', 'concept', 'quantity', 'unit_price', 'total']);

        $payments = Payment::where('booking_id', $booking->id)->orderBy('created_at')->get();

        $mapPayment = fn (Payment $p) => [
            'id'             => $p->id,
            'amount'         => (float) $p->amount,
            'payment_method' => $p->payment_method,
            'status'         => $p->status,
            'receipt_number' => $p->receipt_number,
            'paid_at'        => $p->paid_at?->toIso8601String(),
            'created_at'     => $p->created_at?->toIso8601String(),
            'brand'          => $p->payment_details['brand'] ?? null,
            'last4'          => $p->payment_details['last4'] ?? null,
            'reason'         => $p->payment_details['reason'] ?? null,
        ];

        $refundStatuses = [Payment::STATUS_REFUND_PENDING, Payment::STATUS_REFUNDED];

        return response()->json([
            'booking' => [
                'booking_code' => $booking->booking_code,
                'status'       => $booking->status,
                'check_in'     => Carbon::parse($booking->check_in)->toDateString(),
                'check_out'    => Carbon::parse($booking->check_out)->toDateString(),
                'nights'       => Carbon::parse($booking->check_in)->diffInDays(Carbon::parse($booking->check_out)),
                'room'         => $booking->room ? [
                    'id'          => $booking->room->id,
                    'name'        => $booking->room->name,
                    'room_number' => $booking->room->room_number,
                ] : null,
            ],
            'charges'  => $charges,
            'payments' => $payments
                ->filter(fn (Payment $p) => !in_array($p->status, $refundStatuses, true) && (float) $p->amount > 0)
                ->map($mapPayment)->values(),
            'refunds'  => $payments
                ->filter(fn (Payment $p) => in_array($p->status, $refundStatuses, true))
                ->map(fn (Payment $p) => array_merge($mapPayment($p), ['amount' => abs((float) $p->amount)]))
                ->values(),
            'totals'   => $this->folio->totals($booking),
        ]);
    }

    /**
     * Datos de pre check-in de la reserva (dueño o personal).
     * GET /api/bookings/{code}/pre-check-in
     */
    public function showPreCheckIn(Request $request, string $code): JsonResponse
    {
        $booking = $this->findAccessible($request, $code);
        if (!$booking) {
            return $this->notFound();
        }

        $guest = $booking->guest;

        return response()->json([
            'pre_check_in' => $booking->preCheckIn,
            'window'       => $this->windowInfo($booking),
            'capacity'     => (int) ($booking->room->capacity ?? 0),
            // Datos de la ficha del huésped para precargar el formulario
            'prefill'      => [
                'document_type'   => $guest->document_type ?? null,
                'document_number' => $guest->document_number ?? null,
                'nationality'     => $guest->nationality ?? null,
                'address'         => $guest->address ?? null,
                'companions'      => $booking->companions()
                    ->get(['name', 'surname', 'document_type', 'document_number', 'email', 'phone'])
                    ->toArray(),
            ],
        ]);
    }

    /**
     * Registra o actualiza el pre check-in (solo el dueño). Reserva confirmada con
     * check-in hoy o dentro de los próximos 7 días; editable hasta el check-in.
     * POST /api/bookings/{code}/pre-check-in
     */
    public function storePreCheckIn(Request $request, string $code): JsonResponse
    {
        $booking = Booking::with(['guest', 'room', 'preCheckIn'])->where('booking_code', $code)->first();

        if (!$booking || !$booking->isOwnedBy($request->user())) {
            return $this->notFound();
        }

        $window = $this->windowInfo($booking);
        if (!$window['open']) {
            return response()->json(['message' => $window['reason']], 422);
        }

        $documentRules = ['required', 'string', 'max:50'];
        if ($request->input('document_type') === 'DNI') {
            $documentRules[] = 'regex:/^[0-9]{8}$/';
        }

        $validated = $request->validate([
            'arrival_time'                 => ['nullable', 'date_format:H:i'],
            'document_type'                => ['required', 'string', 'in:DNI,CE,PAS,RUC,OTRO'],
            'document_number'              => $documentRules,
            'nationality'                  => ['nullable', 'string', 'max:100'],
            'address'                      => ['nullable', 'string', 'max:255'],
            'companions'                   => ['nullable', 'array'],
            'companions.*.name'            => ['required', 'string', 'max:255', 'regex:' . self::NAME_REGEX],
            'companions.*.surname'         => ['required', 'string', 'max:255', 'regex:' . self::NAME_REGEX],
            'companions.*.document_type'   => ['required', 'string', 'max:50'],
            'companions.*.document_number' => ['required', 'string', 'max:50'],
            'companions.*.email'           => ['nullable', 'email', 'max:255'],
            'companions.*.phone'           => ['nullable', 'string', 'max:20', 'regex:/^\+?[0-9\s\-]+$/'],
            'special_requests'             => ['nullable', 'string', 'max:1000'],
        ], [
            'arrival_time.date_format'              => 'La hora de llegada debe tener el formato HH:MM.',
            'document_type.in'                      => 'El tipo de documento no es válido.',
            'document_number.regex'                 => 'El DNI debe tener 8 dígitos.',
            'companions.*.name.required'            => 'El nombre del acompañante es obligatorio.',
            'companions.*.name.regex'               => 'El nombre del acompañante solo debe contener letras.',
            'companions.*.surname.required'         => 'Los apellidos del acompañante son obligatorios.',
            'companions.*.surname.regex'            => 'Los apellidos del acompañante solo deben contener letras.',
            'companions.*.document_number.required' => 'El documento del acompañante es obligatorio.',
        ]);

        $companions = array_values(array_map(fn (array $c) => [
            'name'            => trim($c['name']),
            'surname'         => trim($c['surname']),
            'document_type'   => $c['document_type'],
            'document_number' => trim($c['document_number']),
            'email'           => $c['email'] ?? null,
            'phone'           => $c['phone'] ?? null,
        ], $validated['companions'] ?? []));

        $capacity = (int) ($booking->room->capacity ?? 0);
        if ($capacity > 0 && 1 + count($companions) > $capacity) {
            return response()->json([
                'message' => "Capacidad excedida. La habitación permite un máximo de {$capacity} persona(s).",
                'errors'  => ['companions' => ["Capacidad excedida. La habitación permite un máximo de {$capacity} persona(s)."]],
            ], 422);
        }

        $isUpdate = $booking->preCheckIn !== null;

        $precheck = BookingPrecheck::updateOrCreate(
            ['booking_id' => $booking->id],
            [
                'arrival_time'     => $validated['arrival_time'] ?? null,
                'document_type'    => $validated['document_type'],
                'document_number'  => trim($validated['document_number']),
                'nationality'      => $validated['nationality'] ?? null,
                'address'          => $validated['address'] ?? null,
                'companions'       => $companions,
                'special_requests' => $validated['special_requests'] ?? null,
                'submitted_at'     => now(),
            ]
        );

        ActivityLogger::log(
            'pre_check_in',
            ($isUpdate ? 'Pre check-in actualizado' : 'Pre check-in registrado') . " para la reserva {$booking->booking_code}",
            $booking
        );

        return response()->json([
            'message'      => $isUpdate ? 'Pre check-in actualizado con éxito.' : 'Pre check-in registrado con éxito.',
            'pre_check_in' => $precheck->fresh(),
        ], $isUpdate ? 200 : 201);
    }

    /**
     * Ventana del pre check-in: reserva confirmada y check-in entre hoy y hoy + 7 días.
     */
    private function windowInfo(Booking $booking): array
    {
        $today = now()->startOfDay();
        $checkIn = Carbon::parse($booking->check_in)->startOfDay();
        $opensAt = $checkIn->copy()->subDays(BookingPrecheck::WINDOW_DAYS);

        $reason = null;
        if ($booking->status !== Booking::STATUS_CONFIRMED) {
            $reason = 'El pre check-in solo está disponible para reservas confirmadas que aún no han ingresado.';
        } elseif ($today->lt($opensAt)) {
            $reason = 'El pre check-in se habilita ' . BookingPrecheck::WINDOW_DAYS . ' días antes de la llegada (desde el ' . $opensAt->format('d/m/Y') . ').';
        } elseif ($today->gt($checkIn)) {
            $reason = 'La fecha de llegada ya pasó; el pre check-in ya no está disponible.';
        }

        return [
            'open'     => $reason === null,
            'opens_at' => $opensAt->toDateString(),
            'reason'   => $reason,
        ];
    }

    private function findAccessible(Request $request, string $code): ?Booking
    {
        $booking = Booking::with(['guest', 'room', 'preCheckIn'])->where('booking_code', $code)->first();

        return $booking && $booking->isAccessibleBy($request->user()) ? $booking : null;
    }

    private function notFound(): JsonResponse
    {
        return response()->json(['message' => 'Reserva no encontrada con el código proporcionado.'], 404);
    }
}
