<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Mail\BookingCancelledMail;
use App\Mail\BookingConfirmedMail;
use App\Mail\BookingModifiedMail;
use App\Events\BookingCheckedOut;
use App\Mail\FolioMail;
use App\Models\Booking;
use App\Models\Charge;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Room;
use App\Services\ActivityLogger;
use App\Services\Booking\BookingException;
use App\Services\BookingAvailabilityService;
use App\Services\BookingPricingService;
use App\Services\BookingService;
use App\Services\CashSessionService;
use App\Services\CouponService;
use App\Services\FolioCalculator;
use App\Services\Payment\CardValidator;
use App\Services\Payment\PaymentGatewayInterface;
use App\Services\RefundPolicy;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BookingController extends Controller
{
    public function __construct(
        private BookingService $bookings,
        private BookingAvailabilityService $availability,
        private BookingPricingService $pricing,
        private CouponService $coupons,
        private FolioCalculator $folio,
    ) {
    }

    /**
     * Devuelve todas las reservas para el panel de administración.
     * GET /api/staff/bookings
     */
    public function indexStaff(Request $request): JsonResponse
    {
        $query = Booking::with(['guest', 'room', 'preCheckIn']);

        if ($request->filled('status') && $request->query('status') !== 'Todos') {
            $statusMap = [
                'Confirmada' => Booking::STATUS_CONFIRMED,
                'Pendiente'  => Booking::STATUS_PENDING_PAYMENT,
                'Cancelada'  => Booking::STATUS_CANCELLED,
                'Check-in'   => Booking::STATUS_CHECKED_IN,
                'Check-out'  => Booking::STATUS_CHECKED_OUT,
                'Completada' => Booking::STATUS_CHECKED_OUT,
                'Expirada'   => Booking::STATUS_EXPIRED,
            ];
            $raw = (string) $request->query('status');
            $mappedStatus = $statusMap[$raw] ?? strtolower($raw);

            if (in_array($mappedStatus, Booking::STATUSES, true)) {
                $query->where('status', $mappedStatus);
            }
        }

        $bookings = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'bookings' => $bookings
        ]);
    }

    /**
     * Crea una reserva walk-in (solo personal). Queda en estado `confirmed`.
     * payment_method: cash (registra el cobro en efectivo) | cash_later (pago pendiente en recepción, por defecto).
     * POST /api/bookings
     */
    public function store(StoreBookingRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $extra = $request->validate([
            'coupon_code'    => ['nullable', 'string', 'max:50'],
            'payment_method' => ['nullable', 'string', 'in:cash,cash_later'],
        ]);

        $data = array_merge($validated, ['coupon_code' => $extra['coupon_code'] ?? null]);
        $paymentMethod = $extra['payment_method'] ?? 'cash_later';
        $cashPayment = null;

        $staffId = (int) $request->user()->id;

        $result = $this->bookings->create($data, true, function (Booking $booking, array $quote) use ($paymentMethod, $staffId, &$cashPayment) {
            if ($paymentMethod === 'cash' && $quote['total'] > 0) {
                $session = CashSessionService::requireOpenSessionLocked($staffId);
                $cashPayment = Payment::create([
                    'cash_register_session_id' => $session->id,
                    'booking_id'       => $booking->id,
                    'amount'           => $quote['total'],
                    'payment_method'   => 'Efectivo',
                    'status'           => Payment::STATUS_COMPLETED,
                    'transaction_id'   => 'CASH-' . strtoupper(Str::random(8)),
                    'gateway_provider' => 'manual',
                    'currency'         => 'PEN',
                    'receipt_number'   => Payment::generateReceiptNumber(),
                    'paid_at'          => now(),
                    'payment_details'  => [
                        'discount_amount' => $quote['discount'],
                        'coupon_code'     => $quote['coupon']['code'] ?? null,
                        'sub_total'       => $quote['subtotal'],
                    ],
                ]);
            }
        });

        /** @var Booking $booking */
        $booking = $result['booking'];
        $quote = $result['quote'];
        $booking->load(['guest', 'room']);

        $this->sendMail($booking->guest->email ?? null, new BookingConfirmedMail($booking), 'confirmación');

        return response()->json([
            'message'        => '¡Reserva completada con éxito!',
            'booking_code'   => $booking->booking_code,
            'booking'        => $booking,
            'method'         => $paymentMethod,
            'receipt_number' => $cashPayment?->receipt_number,
            'ticket_code'    => $cashPayment?->transaction_id ?? $booking->booking_code,
            'summary'        => BookingService::summary($quote),
        ], 201);
    }

    /**
     * Consulta una reserva por su código único (dueño o personal; si no, 404).
     * GET /api/bookings/{code}
     */
    public function showByCode(Request $request, string $code): JsonResponse
    {
        $booking = Booking::with(['guest', 'room', 'payments', 'preCheckIn'])
            ->where('booking_code', $code)
            ->first();

        if (!$booking || !$booking->isAccessibleBy($request->user())) {
            return $this->notFound();
        }

        return response()->json([
            'booking' => $booking
        ]);
    }

    /**
     * Devuelve los cargos de una reserva.
     * GET /api/staff/bookings/{id}/charges
     */
    public function getCharges($id): JsonResponse
    {
        $booking = Booking::with('room')->find($id);
        if (!$booking) {
            return $this->notFound();
        }

        return response()->json([
            'charges'  => Charge::where('booking_id', $booking->id)->orderBy('date')->get(),
            'payments' => Payment::where('booking_id', $booking->id)->orderBy('created_at')->get(),
            'totals'   => $this->folio->totals($booking),
        ]);
    }

    /**
     * Añade un cargo (consumo) a una reserva. Descuenta stock de forma atómica.
     * POST /api/staff/bookings/{id}/charges
     */
    public function addCharge(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'date'       => 'required|date',
            'product_id' => 'nullable|integer|exists:products,id',
            'concept'    => 'required_without:product_id|nullable|string|max:255',
            'quantity'   => 'required|integer|min:1|max:1000',
            'unit_price' => 'required_without:product_id|nullable|numeric|min:0|max:100000',
        ]);

        $charge = DB::transaction(function () use ($validated, $id) {
            $booking = Booking::whereKey($id)->lockForUpdate()->first();
            if (!$booking) {
                throw new BookingException('Reserva no encontrada.', 404);
            }

            if (!in_array($booking->status, [Booking::STATUS_CONFIRMED, Booking::STATUS_CHECKED_IN], true)) {
                throw new BookingException('Solo se pueden registrar consumos en reservas confirmadas o con check-in.', 422);
            }

            $quantity = (int) $validated['quantity'];
            $concept = $validated['concept'] ?? '';
            $unitPrice = (float) ($validated['unit_price'] ?? 0);
            $productId = $validated['product_id'] ?? null;

            if ($productId) {
                $product = Product::whereKey($productId)->lockForUpdate()->first();

                if (!$product || !$product->is_active) {
                    throw new BookingException('El producto seleccionado no está disponible.', 422);
                }

                $tracksStock = $product->tracks_stock === null ? true : (bool) $product->tracks_stock;
                if ($tracksStock) {
                    $affected = Product::whereKey($product->id)
                        ->where('stock', '>=', $quantity)
                        ->decrement('stock', $quantity);

                    if ($affected === 0) {
                        throw new BookingException('Stock insuficiente para el producto seleccionado. Stock actual: ' . $product->stock, 422);
                    }
                }

                $concept = $product->name;
                $unitPrice = (float) $product->price;
            }

            return Charge::create([
                'booking_id' => $booking->id,
                'product_id' => $productId,
                'date'       => $validated['date'],
                'concept'    => $concept,
                'quantity'   => $quantity,
                'unit_price' => $unitPrice,
                'total'      => round($quantity * $unitPrice, 2),
            ]);
        });

        return response()->json([
            'message' => 'Cargo añadido con éxito.',
            'charge'  => $charge,
        ]);
    }

    /**
     * Registra un pago manual (recepción) sobre la cuenta de la reserva.
     * POST /api/staff/bookings/{id}/pay
     */
    public function processPayment(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|gt:0|max:1000000',
            'method' => 'required|string|in:Efectivo,Tarjeta,Transferencia',
        ]);

        $amount = round((float) $validated['amount'], 2);

        $staffId = (int) $request->user()->id;

        [$payment, $balance] = DB::transaction(function () use ($id, $amount, $validated, $staffId) {
            $session = CashSessionService::requireOpenSessionLocked($staffId);

            $booking = Booking::whereKey($id)->lockForUpdate()->first();
            if (!$booking) {
                throw new BookingException('Reserva no encontrada.', 404);
            }

            if (in_array($booking->status, [Booking::STATUS_CANCELLED, Booking::STATUS_EXPIRED], true)) {
                throw new BookingException('No se pueden registrar pagos en una reserva cancelada o expirada.', 422);
            }

            $balance = $booking->balance();
            if ($balance <= 0) {
                throw new BookingException('La reserva no tiene saldo pendiente.', 422, ['balance' => $balance]);
            }

            if ($amount > $balance + 0.001) {
                throw new BookingException(
                    'El monto excede el saldo pendiente (S/ ' . number_format($balance, 2) . ').',
                    422,
                    ['balance' => $balance]
                );
            }

            $payment = Payment::create([
                'booking_id'       => $booking->id,
                'cash_register_session_id' => $session->id,
                'amount'           => $amount,
                'payment_method'   => $validated['method'],
                'status'           => Payment::STATUS_COMPLETED,
                'paid_at'          => now(),
                'transaction_id'   => 'MANUAL-' . strtoupper(Str::random(12)),
                'gateway_provider' => 'manual',
                'currency'         => 'PEN',
                'receipt_number'   => Payment::generateReceiptNumber(),
            ]);

            // Una reserva pendiente que se paga en recepción queda confirmada.
            if ($booking->status === Booking::STATUS_PENDING_PAYMENT
                && $booking->paidAmount() + 0.001 >= (float) $booking->total_amount) {
                if (!$this->coupons->consumeForBooking($booking)) {
                    throw new BookingException('El cupón de la reserva ya no tiene usos disponibles.', 409);
                }
                $booking->update(['status' => Booking::STATUS_CONFIRMED, 'expires_at' => null]);
                Payment::where('booking_id', $booking->id)
                    ->where('status', Payment::STATUS_PENDING)
                    ->update(['status' => Payment::STATUS_CANCELLED]);
            }

            return [$payment, $booking->balance()];
        });

        ActivityLogger::log(
            'payment',
            'Pago en recepción de S/ ' . number_format($amount, 2) . " ({$validated['method']}) para la reserva #{$id}",
            $payment
        );

        return response()->json([
            'message' => 'Pago procesado con éxito.',
            'payment' => $payment,
            'balance' => $balance,
        ]);
    }

    /**
     * Envía el folio (estado de cuenta) por correo electrónico.
     * Los importes incluyen IGV; se muestra la porción de IGV incluida.
     * POST /api/staff/bookings/{id}/email-folio
     */
    public function emailFolio(Request $request, $id): JsonResponse
    {
        $booking = Booking::with(['guest', 'room'])->find($id);
        if (!$booking) {
            return $this->notFound();
        }

        $charges = Charge::where('booking_id', $booking->id)->orderBy('date')->get();
        $payments = Payment::where('booking_id', $booking->id)->orderBy('created_at')->get();
        $totals = $this->folio->totals($booking);

        if (empty($booking->guest?->email)) {
            return response()->json(['message' => 'El huésped no tiene un correo electrónico registrado.'], 422);
        }

        try {
            Mail::to($booking->guest->email)->send(new FolioMail($booking, $charges, $payments, $totals));
        } catch (\Throwable $e) {
            Log::error('No se pudo enviar el correo del folio', ['booking_id' => $booking->id, 'error' => get_class($e)]);
            return response()->json([
                'message' => 'Hubo un error al intentar enviar el correo. Por favor, revise la configuración de correo.'
            ], 500);
        }

        return response()->json([
            'message' => 'Folio enviado por correo exitosamente a ' . $booking->guest->email,
            'totals'  => $totals,
        ]);
    }

    /**
     * Devuelve las reservas del usuario autenticado.
     * GET /api/my-bookings
     */
    public function myBookings(Request $request): JsonResponse
    {
        $bookings = Booking::with(['room', 'payments', 'preCheckIn', 'review'])
            ->ownedBy($request->user())
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'bookings' => $bookings
        ]);
    }

    /**
     * Modifica una reserva existente (fechas y/o habitación). Dueño o personal.
     *
     * - El precio se recalcula en el servidor (temporadas + cupón original).
     * - `payment_confirmed` del cliente se IGNORA.
     * - Diferencia positiva: sin datos de tarjeta responde requires_payment (sin cambios);
     *   con card_number/card_expiry/card_cvc/card_holder se cobra en el servidor (402 si falla, sin cambios).
     * - Diferencia negativa: se registra un Payment `refund_pending` con monto negativo según la política.
     *
     * PUT /api/bookings/{code}
     */
    public function update(Request $request, string $code): JsonResponse
    {
        $booking = Booking::with('guest')->where('booking_code', $code)->first();

        if (!$booking || !$booking->isAccessibleBy($request->user())) {
            return $this->notFound();
        }

        if (!$booking->isModifiable()) {
            return response()->json([
                'message' => 'Solo se pueden modificar reservas pendientes de pago o confirmadas.'
            ], 422);
        }

        $rules = [
            'check_in'    => ['required', 'date'],
            'check_out'   => ['required', 'date', 'after:check_in'],
            'room_id'     => ['sometimes', 'integer', 'exists:rooms,id'],
            'card_number' => ['nullable', 'string', 'max:23'],
            'card_expiry' => ['nullable', 'string', 'max:5'],
            'card_cvc'    => ['nullable', 'string', 'max:4'],
            'card_holder' => ['nullable', 'string', 'max:100'],
        ];

        if ($request->input('check_in') !== Carbon::parse($booking->check_in)->format('Y-m-d')) {
            $rules['check_in'][] = 'after_or_equal:today';
        }

        $validated = $request->validate($rules, [
            'check_in.required'       => 'La fecha de check-in es obligatoria.',
            'check_in.date'           => 'La fecha de check-in debe ser válida.',
            'check_in.after_or_equal' => 'El nuevo check-in no puede ser anterior a hoy.',
            'check_out.required'      => 'La fecha de check-out es obligatoria.',
            'check_out.date'          => 'La fecha de check-out debe ser válida.',
            'check_out.after'         => 'La fecha de check-out debe ser posterior al check-in.',
            'room_id.exists'          => 'La habitación seleccionada no es válida.',
        ]);

        $cardFields = ['card_number', 'card_expiry', 'card_cvc', 'card_holder'];
        $providedCard = array_filter($cardFields, fn ($f) => !empty($validated[$f]));
        if (count($providedCard) > 0 && count($providedCard) < count($cardFields)) {
            throw ValidationException::withMessages(
                collect($cardFields)->reject(fn ($f) => !empty($validated[$f]))
                    ->mapWithKeys(fn ($f) => [$f => ['Este campo es obligatorio para cobrar la diferencia.']])
                    ->all()
            );
        }
        $hasCard = count($providedCard) === count($cardFields);

        $outcome = DB::transaction(function () use ($booking, $validated, $hasCard) {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->first();
            if (!$locked->isModifiable()) {
                throw new BookingException('Solo se pueden modificar reservas pendientes de pago o confirmadas.', 422);
            }

            $newRoomId = (int) ($validated['room_id'] ?? $locked->room_id);
            $room = $this->availability->lockRoom($newRoomId);
            $totalGuests = 1 + $locked->companions()->count();

            $this->availability->assertBookable($room, $validated['check_in'], $validated['check_out'], $totalGuests, $locked->id);

            // Se preservan los términos del cupón original (sin revalidar vigencia ni usos).
            $couponTerms = $locked->pricing_details['coupon'] ?? null;
            $quote = $this->pricing->quote($room, $validated['check_in'], $validated['check_out'], $couponTerms);
            $difference = round($quote['total'] - (float) $locked->total_amount, 2);

            $newPayment = null;
            $refund = null;
            $refundPercentage = null;

            if ($locked->status === Booking::STATUS_CONFIRMED && $difference > 0) {
                if (!$hasCard) {
                    return [
                        'requires_payment' => true,
                        'quote'            => $quote,
                        'difference'       => $difference,
                        'room_id'          => $newRoomId,
                    ];
                }

                $errors = CardValidator::errors($validated['card_number'], $validated['card_expiry'], $validated['card_cvc']);
                if ($errors) {
                    throw ValidationException::withMessages($errors);
                }

                $charge = app(PaymentGatewayInterface::class)->processPayment(
                    $validated['card_number'],
                    $validated['card_expiry'],
                    $validated['card_cvc'],
                    $difference,
                    'PEN',
                    ['booking_code' => $locked->booking_code, 'reason' => 'modification']
                );

                if (empty($charge['success'])) {
                    throw new BookingException(
                        $charge['message'] ?? 'El pago de la diferencia fue rechazado.',
                        402,
                        ['decline_reason' => $charge['decline_reason'] ?? null]
                    );
                }

                $newPayment = Payment::create([
                    'booking_id'       => $locked->id,
                    'amount'           => $difference,
                    'payment_method'   => 'card',
                    'status'           => Payment::STATUS_COMPLETED,
                    'transaction_id'   => $charge['transaction_id'],
                    'gateway_provider' => $charge['provider'],
                    'currency'         => 'PEN',
                    'receipt_number'   => Payment::generateReceiptNumber(),
                    'paid_at'          => now(),
                    'payment_details'  => [
                        'brand'  => $charge['payment_details']['brand'] ?? null,
                        'last4'  => $charge['payment_details']['last4'] ?? null,
                        'reason' => 'Diferencia por modificación de reserva',
                    ],
                ]);
            } elseif ($locked->status === Booking::STATUS_CONFIRMED && $difference < 0) {
                // Política configurable (SHE-028): reducción menos la penalidad vigente.
                $refundCalc = RefundPolicy::modificationRefund($locked, abs($difference));
                $refundPercentage = $refundCalc['refund_percentage'];
                $refundAmount = $refundCalc['refund_amount'];
                $refund = RefundPolicy::recordRefund($locked, $refundAmount, 'Reducción por modificación de reserva');
            } elseif ($locked->status === Booking::STATUS_PENDING_PAYMENT) {
                // Aún no pagada: se actualiza el monto del pago pendiente.
                Payment::where('booking_id', $locked->id)
                    ->where('status', Payment::STATUS_PENDING)
                    ->update(['amount' => $quote['total']]);
            }

            $locked->update([
                'check_in'        => $validated['check_in'],
                'check_out'       => $validated['check_out'],
                'room_id'         => $newRoomId,
                'total_amount'    => $quote['total'],
                'discount_amount' => $quote['discount'],
                'pricing_details' => $quote,
            ]);

            return [
                'requires_payment'  => false,
                'quote'             => $quote,
                'difference'        => $difference,
                'payment'           => $newPayment,
                'refund'            => $refund,
                'refund_percentage' => $refundPercentage,
            ];
        });

        if ($outcome['requires_payment']) {
            return response()->json([
                'message'           => 'Se requiere el pago de la diferencia para confirmar la modificación.',
                'requires_payment'  => true,
                'amount_difference' => $outcome['difference'],
                'new_total_amount'  => $outcome['quote']['total'],
                'new_check_in'      => $validated['check_in'],
                'new_check_out'     => $validated['check_out'],
                'room_id'           => $outcome['room_id'],
                'summary'           => BookingService::summary($outcome['quote']),
            ]);
        }

        $difference = $outcome['difference'];
        $refundAmount = $outcome['refund'] ? abs((float) $outcome['refund']->amount) : 0.0;

        if ($difference > 0 && $outcome['payment']) {
            $msg = 'Se ha cobrado satisfactoriamente la diferencia de S/ ' . number_format($difference, 2) . ' por la modificación de su reserva.';
        } elseif ($difference < 0 && $outcome['refund_percentage'] !== null) {
            $msg = $refundAmount > 0
                ? "Se ha registrado un reembolso del {$outcome['refund_percentage']}% de la diferencia (S/ " . number_format($refundAmount, 2) . ').'
                : 'No se generan reembolsos por esta modificación según las políticas del hotel.';
        } else {
            $msg = 'Las fechas de su reserva han sido modificadas.';
        }

        $booking = $booking->fresh(['room', 'guest']);
        $this->sendMail($booking->guest->email ?? null, new BookingModifiedMail($booking, $msg, $difference), 'modificación');

        return response()->json([
            'message' => 'Reserva modificada con éxito. ' . $msg,
            'booking' => $booking,
            'payment' => $outcome['payment'],
            'refund'  => $outcome['refund'],
            'summary' => BookingService::summary($outcome['quote']),
        ]);
    }

    /**
     * Cancela una reserva y registra el reembolso (refund_pending) según la política.
     * POST /api/bookings/{code}/cancel
     */
    public function cancel(Request $request, string $code): JsonResponse
    {
        $booking = Booking::with('guest')->where('booking_code', $code)->first();

        if (!$booking || !$booking->isAccessibleBy($request->user())) {
            return $this->notFound();
        }

        $outcome = DB::transaction(function () use ($booking) {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->first();

            if ($locked->status === Booking::STATUS_CANCELLED) {
                throw new BookingException('La reserva ya se encuentra cancelada.', 422);
            }
            if (!$locked->isModifiable()) {
                throw new BookingException('Solo se pueden cancelar reservas pendientes de pago o confirmadas.', 422);
            }

            // Política configurable (SHE-028): lo cobrado menos la penalidad de la ventana.
            $refundCalc = RefundPolicy::cancellationRefund($locked);
            $refundPercentage = $refundCalc['refund_percentage'];
            $refundAmount = $refundCalc['refund_amount'];

            $mainPayment = $locked->payments()->where('amount', '>', 0)->orderBy('created_at')->first();

            if ($locked->status === Booking::STATUS_PENDING_PAYMENT) {
                $this->coupons->releaseForBooking($locked);
            }

            Payment::where('booking_id', $locked->id)
                ->where('status', Payment::STATUS_PENDING)
                ->update(['status' => Payment::STATUS_CANCELLED]);

            $locked->update(['status' => Booking::STATUS_CANCELLED, 'expires_at' => null]);

            $refund = RefundPolicy::recordRefund($locked, $refundAmount, 'Cancelación de reserva');

            return [
                'refund_percentage' => $refundPercentage,
                'refund_amount'     => $refund ? abs((float) $refund->amount) : 0.0,
                'refund'            => $refund,
                'payment_method'    => $mainPayment->payment_method ?? 'Tarjeta',
            ];
        });

        $booking = $booking->fresh(['guest']);
        ActivityLogger::log(
            'cancel',
            "Reserva {$booking->booking_code} cancelada (reembolso {$outcome['refund_percentage']}%: S/ " . number_format($outcome['refund_amount'], 2) . ')',
            $booking
        );
        $this->sendMail(
            $booking->guest->email ?? null,
            new BookingCancelledMail($booking, $outcome['refund_percentage'], $outcome['refund_amount'], $outcome['payment_method']),
            'cancelación'
        );

        return response()->json([
            'message'           => 'Reserva cancelada con éxito.',
            'refund_percentage' => $outcome['refund_percentage'],
            'refund_amount'     => $outcome['refund_amount'],
            'payment_method'    => $outcome['payment_method'],
            'refund'            => $outcome['refund'],
            'booking'           => $booking,
        ]);
    }

    /**
     * Check-in: reserva confirmada, desde el día de check-in (se permite ingreso temprano
     * ese mismo día) y antes del día de check-out. La habitación pasa a `ocupada`.
     * POST /api/staff/bookings/{code}/check-in
     */
    public function checkIn(string $code): JsonResponse
    {
        $booking = DB::transaction(function () use ($code) {
            $booking = Booking::where('booking_code', $code)->lockForUpdate()->first();
            if (!$booking) {
                throw new BookingException('Reserva no encontrada.', 404);
            }

            if ($booking->status !== Booking::STATUS_CONFIRMED) {
                throw new BookingException(
                    $booking->status === Booking::STATUS_PENDING_PAYMENT
                        ? 'No se puede realizar el check-in porque el pago está pendiente.'
                        : 'La reserva debe estar confirmada para realizar el check-in.',
                    422
                );
            }

            $today = now()->startOfDay();
            $checkInDate = Carbon::parse($booking->check_in)->startOfDay();
            $checkOutDate = Carbon::parse($booking->check_out)->startOfDay();

            if ($today->lt($checkInDate)) {
                throw new BookingException('No se puede realizar el check-in antes de la fecha programada (' . $checkInDate->format('Y-m-d') . ').', 422);
            }
            if ($today->gte($checkOutDate)) {
                throw new BookingException('No se puede realizar el check-in: la fecha de salida de la reserva ya pasó.', 422);
            }

            $room = Room::whereKey($booking->room_id)->lockForUpdate()->first();
            if ($room && in_array($room->status, Room::UNBOOKABLE_STATUSES, true)) {
                throw new BookingException('La habitación está fuera de servicio (mantenimiento). Reasigne la reserva antes del check-in.', 422);
            }

            if ($room && $room->status === Room::STATUS_CLEANING) {
                throw new BookingException('La habitación está en limpieza. Márquela como disponible antes del check-in.', 422);
            }

            $booking->update(['status' => Booking::STATUS_CHECKED_IN]);
            $room?->update(['status' => Room::STATUS_OCCUPIED]);

            return $booking;
        });

        ActivityLogger::log('check_in', "Check-in de la reserva {$booking->booking_code}", $booking);

        return response()->json([
            'message' => 'Check-in realizado con éxito.',
            'booking' => $booking->fresh(['room'])
        ]);
    }

    /**
     * Check-out: bloqueado si hay saldo pendiente, salvo force=true por un administrador.
     * La habitación pasa a `limpieza`.
     * POST /api/staff/bookings/{code}/check-out
     */
    public function checkOut(Request $request, string $code): JsonResponse
    {
        $request->validate([
            'early_checkout_reason' => ['nullable', 'string', 'max:500'],
            'force'                 => ['nullable', 'boolean'],
        ]);

        $force = $request->boolean('force');
        if ($force && !$request->user()?->hasRole('admin')) {
            return response()->json(['message' => 'Solo un administrador puede forzar el check-out con saldo pendiente.'], 403);
        }

        $booking = DB::transaction(function () use ($request, $code, $force) {
            $booking = Booking::where('booking_code', $code)->lockForUpdate()->first();
            if (!$booking) {
                throw new BookingException('Reserva no encontrada.', 404);
            }

            if ($booking->status !== Booking::STATUS_CHECKED_IN) {
                throw new BookingException('La reserva debe estar en estado Check-in para realizar el Check-out.', 422);
            }

            $balance = $booking->balance();
            if ($balance > 0.009 && !$force) {
                throw new BookingException(
                    'La cuenta tiene un saldo pendiente de S/ ' . number_format($balance, 2) . '. Registre el pago antes del check-out.',
                    422,
                    ['balance' => $balance, 'requires_payment' => true]
                );
            }

            $earlyCheckoutReason = null;
            if (now()->startOfDay()->lt(Carbon::parse($booking->check_out)->startOfDay())) {
                if (!$request->filled('early_checkout_reason')) {
                    throw new BookingException('Se requiere un motivo para la salida anticipada.', 422, ['requires_reason' => true]);
                }
                $earlyCheckoutReason = $request->input('early_checkout_reason');
            }

            $booking->update([
                'status'                => Booking::STATUS_CHECKED_OUT,
                'early_checkout_reason' => $earlyCheckoutReason,
            ]);

            Room::whereKey($booking->room_id)->update(['status' => Room::STATUS_CLEANING]);

            if ($force && $balance > 0.009) {
                Log::warning('Check-out forzado con saldo pendiente', [
                    'booking_id' => $booking->id,
                    'balance'    => $balance,
                    'user_id'    => $request->user()?->id,
                ]);
            }

            return $booking;
        });

        ActivityLogger::log(
            'check_out',
            "Check-out de la reserva {$booking->booking_code}" . ($request->boolean('force') ? ' (forzado por administrador)' : ''),
            $booking
        );
        BookingCheckedOut::dispatch($booking);

        return response()->json([
            'message' => 'Check-out realizado con éxito.',
            'booking' => $booking->fresh(['room'])
        ]);
    }

    private function notFound(): JsonResponse
    {
        return response()->json(['message' => 'Reserva no encontrada con el código proporcionado.'], 404);
    }

    private function sendMail(?string $to, $mailable, string $label): void
    {
        if (empty($to)) {
            return;
        }

        try {
            Mail::to($to)->send($mailable);
        } catch (\Throwable $e) {
            Log::error("No se pudo enviar el correo de {$label}", ['error' => get_class($e)]);
        }
    }
}
