<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Models\Booking;
use App\Models\Guest;
use App\Models\Room;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Mail;
use App\Mail\BookingConfirmedMail;
use App\Mail\BookingModifiedMail;
use App\Mail\FolioMail;

class BookingController extends Controller
{
    /**
     * Devuelve todas las reservas para el panel de administración.
     * GET /api/staff/bookings
     */
    public function indexStaff(Request $request): JsonResponse
    {
        $query = Booking::with(['guest', 'room']);

        if ($request->filled('status') && $request->query('status') !== 'Todos') {
            $statusMap = [
                'Confirmada' => 'confirmed',
                'Pendiente'  => 'pending_payment',
                'Cancelada'  => 'cancelled',
                'Check-in'   => 'checked_in',
                'Completada' => 'completed'
            ];
            $mappedStatus = $statusMap[$request->query('status')] ?? strtolower($request->query('status'));
            $query->where('status', $mappedStatus);
        }

        $bookings = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'bookings' => $bookings
        ]);
    }

    /**
     * Crea una nueva reserva para un huésped.
     * Genera automáticamente un código único de reserva y actualiza el estado de la habitación.
     * POST /api/bookings
     */
    public function store(StoreBookingRequest $request): JsonResponse
    {
        $validated = $request->validated();
        
        // El request custom ya validó, pero si pasamos coupon_code lo atrapamos (o lo validamos aquí si no está en el request)
        $couponCode = $request->input('coupon_code');

        $room = Room::findOrFail($validated['room_id']);

        $companionsCount = isset($validated['companions']) ? count($validated['companions']) : 0;
        $totalGuests = 1 + $companionsCount;

        if ($totalGuests > $room->capacity) {
            return response()->json([
                'message' => 'La cantidad de personas excede la capacidad máxima de esta habitación.',
                'errors'  => [
                    'companions' => ["Capacidad excedida. La habitación permite un máximo de {$room->capacity} persona(s)."]
                ]
            ], 422);
        }

        $checkIn = Carbon::parse($validated['check_in'])->startOfDay();
        $checkOut = Carbon::parse($validated['check_out'])->startOfDay();
        $nights = $checkIn->diffInDays($checkOut);

        if ($nights < 1) {
            $nights = 1;
        }

        $subTotal = $room->price_per_night * $nights;
        $discountAmount = 0;
        
        $coupon = null;
        if (!empty($couponCode)) {
            $coupon = \App\Models\Coupon::where('code', $couponCode)->where('is_active', true)->first();
            if ($coupon && $coupon->expires_at >= now() && (!$coupon->max_uses || $coupon->current_uses < $coupon->max_uses)) {
                if ($coupon->discount_type === 'percentage') {
                    $discountAmount = $subTotal * ($coupon->discount_value / 100);
                } else {
                    $discountAmount = $coupon->discount_value;
                }
            }
        }
        
        $totalAmount = max(0, $subTotal - $discountAmount);

        try {
            // Iniciar transacción de base de datos para garantizar consistencia atómica
            $booking = DB::transaction(function () use ($validated, $room, $totalAmount, $coupon) {
                // BLOQUEO PESIMISTA:
                // Bloqueamos la fila de la habitación para prevenir 'race conditions' (Double-booking).
                Room::where('id', $room->id)->lockForUpdate()->first();

                // Validar superposición de fechas (debe hacerse DENTRO del lock)
                $isOverlapping = Booking::where('room_id', $room->id)
                    ->where(function ($query) use ($validated) {
                        $query->where('check_in', '<', $validated['check_out'])
                              ->where('check_out', '>', $validated['check_in']);
                    })
                    ->whereIn('status', ['confirmed', 'checked_in', 'reservada', 'pending_payment'])
                    ->exists();

                if ($isOverlapping) {
                    throw new \Exception('La habitación seleccionada ya no se encuentra disponible en las fechas especificadas.');
                }

                // 1. Obtener o registrar la ficha del huésped
            $guest = Guest::where('document_number', $validated['document_number'])
                ->orWhere('email', $validated['guest_email'])
                ->first();

            if (!$guest) {
                $guest = Guest::create([
                    'name'            => $validated['guest_name'],
                    'surname'         => $validated['guest_surname'],
                    'document_type'   => $validated['document_type'],
                    'document_number' => $validated['document_number'],
                    'phone'           => $validated['guest_phone'] ?? null,
                    'email'           => $validated['guest_email'],
                    'notes'           => $validated['notes'] ?? null,
                ]);
            } else {
                // Actualizar datos de contacto si cambiaron
                $guest->update([
                    'name'        => $validated['guest_name'],
                    'surname'     => $validated['guest_surname'],
                    'email'       => $validated['guest_email'],
                    'phone'       => $validated['guest_phone'] ?? $guest->phone,
                    'notes'       => $validated['notes'] ?? $guest->notes,
                ]);
            }

            // 2. Generación automática del código único de reserva (ej: RES-8K9W2B4F)
            $bookingCode = $this->generateUniqueBookingCode();

            // 3. Crear el registro de la reserva
            $newBooking = Booking::create([
                'booking_code' => $bookingCode,
                'guest_id'     => $guest->id,
                'room_id'      => $room->id,
                'check_in'     => $validated['check_in'],
                'check_out'    => $validated['check_out'],
                'total_amount' => $totalAmount,
                'status'       => 'confirmed',
            ]);

            // Guardar acompañantes si existen
            if (!empty($validated['companions'])) {
                foreach ($validated['companions'] as $companion) {
                    \App\Models\BookingCompanion::create([
                        'booking_id'      => $newBooking->id,
                        'name'            => $companion['name'],
                        'surname'         => $companion['surname'],
                        'document_type'   => $companion['document_type'],
                        'document_number' => $companion['document_number'],
                        'email'           => $companion['email'] ?? null,
                        'phone'           => $companion['phone'] ?? null,
                    ]);

                    // Registrar como huésped para futuras búsquedas
                    if (!empty($companion['document_number'])) {
                        $guestComp = Guest::where('document_number', $companion['document_number'])->first();
                        if (!$guestComp) {
                            Guest::create([
                                'name'            => $companion['name'],
                                'surname'         => $companion['surname'],
                                'document_type'   => $companion['document_type'],
                                'document_number' => $companion['document_number'],
                                'email'           => $companion['email'] ?? null,
                                'phone'           => $companion['phone'] ?? null,
                            ]);
                        }
                    }
                }
            }

            // El estado de la habitación NO debe cambiar a 'reservada'. 
            // La habitación sigue estando 'disponible' en el inventario general, 
            // solo se bloquean las fechas en base a los registros de Booking.

            if ($coupon) {
                $coupon->increment('current_uses');
            }

            return $newBooking;
        });
        } catch (\Exception $e) {
            if ($e->getMessage() === 'La habitación seleccionada ya no se encuentra disponible en las fechas especificadas.') {
                return response()->json([
                    'message' => $e->getMessage(),
                    'errors'  => [
                        'dates' => ['Conflicto de fechas con una reserva existente.']
                    ]
                ], 422);
            }
            throw $e;
        }

        // Cargar las relaciones para la respuesta
        $booking->load(['guest', 'room']);

        // Enviar correo de confirmación
        try {
            Mail::to($validated['guest_email'])->send(new BookingConfirmedMail($booking));
        } catch (\Exception $e) {
            \Log::error('No se pudo enviar el correo de confirmación: ' . $e->getMessage());
        }

        return response()->json([
            'message'      => '¡Reserva completada con éxito!',
            'booking_code' => $booking->booking_code,
            'booking'      => $booking,
            'summary'      => [
                'nights'          => $nights,
                'price_per_night' => $room->price_per_night,
                'total_amount'    => $totalAmount,
                'room_status'     => 'reservada',
            ]
        ], 201);
    }

    /**
     * Consulta una reserva por su código único.
     * GET /api/bookings/{code}
     */
    public function showByCode(string $code): JsonResponse
    {
        $booking = Booking::with(['guest', 'room', 'payments'])
            ->where('booking_code', $code)
            ->first();

        if (!$booking) {
            return response()->json([
                'message' => 'Reserva no encontrada con el código proporcionado.'
            ], 404);
        }

        return response()->json([
            'booking' => $booking
        ]);
    }

    /**
     * Devuelve los cargos de una reserva.
     * GET /api/bookings/{id}/charges
     */
    public function getCharges($id): JsonResponse
    {
        $booking = Booking::with('room')->findOrFail($id);
        $charges = \App\Models\Charge::where('booking_id', $id)->orderBy('date')->get();
        $payments = \App\Models\Payment::where('booking_id', $id)->orderBy('created_at')->get();

        return response()->json([
            'charges' => $charges,
            'payments' => $payments
        ]);
    }

    /**
     * Añade un cargo a una reserva.
     * POST /api/bookings/{id}/charges
     */
    public function addCharge(Request $request, $id): JsonResponse
    {
        $booking = Booking::findOrFail($id);
        
        $validated = $request->validate([
            'date' => 'required|date',
            'product_id' => 'nullable|exists:products,id',
            'concept' => 'required_without:product_id|string',
            'quantity' => 'required|integer|min:1',
            'unit_price' => 'required_without:product_id|numeric|min:0',
        ]);

        $product = null;
        $concept = $validated['concept'] ?? '';
        $unit_price = $validated['unit_price'] ?? 0;

        if (!empty($validated['product_id'])) {
            $product = \App\Models\Product::findOrFail($validated['product_id']);
            
            if ($product->stock < $validated['quantity']) {
                return response()->json([
                    'message' => 'Stock insuficiente para el producto seleccionado. Stock actual: ' . $product->stock
                ], 422);
            }
            
            $concept = $product->name;
            $unit_price = $product->price;
            
            // Reducir el stock
            $product->decrement('stock', $validated['quantity']);
        }
        
        $total = $validated['quantity'] * $unit_price;

        $charge = \App\Models\Charge::create([
            'booking_id' => $booking->id,
            'product_id' => $validated['product_id'] ?? null,
            'date' => $validated['date'],
            'concept' => $concept,
            'quantity' => $validated['quantity'],
            'unit_price' => $unit_price,
            'total' => $total
        ]);

        return response()->json([
            'message' => 'Cargo añadido con éxito.',
            'charge' => $charge
        ]);
    }

    /**
     * Procesa un pago para una reserva (cuenta de habitación).
     * POST /api/bookings/{id}/pay
     */
    public function processPayment(Request $request, $id): JsonResponse
    {
        $booking = Booking::findOrFail($id);
        
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'method' => 'required|string|in:Efectivo,Tarjeta,Transferencia'
        ]);
        
        $payment = \App\Models\Payment::create([
            'booking_id' => $booking->id,
            'amount' => $validated['amount'],
            'payment_method' => $validated['method'],
            'status' => 'completed',
            'paid_at' => now(),
            'transaction_id' => 'MANUAL-' . uniqid(),
            'gateway_provider' => 'manual',
            'currency' => 'PEN',
            'receipt_number' => \App\Models\Payment::generateReceiptNumber(),
        ]);

        return response()->json([
            'message' => 'Pago procesado con éxito.',
            'payment' => $payment
        ]);
    }

    /**
     * Envia el folio (estado de cuenta) por correo electrónico.
     * POST /api/bookings/{id}/email-folio
     */
    public function emailFolio(Request $request, $id): JsonResponse
    {
        $booking = Booking::with(['guest', 'room'])->findOrFail($id);
        $charges = \App\Models\Charge::where('booking_id', $id)->orderBy('date')->get();
        $payments = \App\Models\Payment::where('booking_id', $id)->orderBy('created_at')->get();

        $subtotal = $charges->sum('total') + $booking->total_amount;
        $igv = $subtotal * 0.18;
        $total = $subtotal + $igv;
        $pagado = $payments->sum('amount');
        $saldo = max(0, $total - $pagado);

        $totals = [
            'subtotal' => $subtotal,
            'igv' => $igv,
            'total' => $total,
            'pagado' => $pagado,
            'saldo' => $saldo
        ];

        try {
            Mail::to($booking->guest->email)->send(new FolioMail($booking, $charges, $payments, $totals));
            return response()->json([
                'message' => 'Folio enviado por correo exitosamente a ' . $booking->guest->email
            ]);
        } catch (\Exception $e) {
            \Log::error('No se pudo enviar el correo del folio: ' . $e->getMessage());
            return response()->json([
                'message' => 'Hubo un error al intentar enviar el correo. Por favor, revise la configuración de correo.'
            ], 500);
        }
    }

    /**
     * Devuelve las reservas del usuario autenticado.
     * GET /api/my-bookings
     */
    public function myBookings(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->guestProfile) {
            return response()->json([
                'bookings' => []
            ]);
        }

        $bookings = Booking::with(['room', 'payments'])
            ->where('guest_id', $user->guestProfile->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'bookings' => $bookings
        ]);
    }

    /**
     * Generador de código alfanumérico único para la reserva.
     * Formato: RES-XXXXXXXX (8 caracteres alfanuméricos en mayúsculas)
     */
    private function generateUniqueBookingCode(): string
    {
        do {
            $randomString = strtoupper(Str::random(8));
            $code = "RES-{$randomString}";
        } while (Booking::where('booking_code', $code)->exists());

        return $code;
    }
    /**
     * Modifica una reserva existente (fechas y/o habitación).
     * PUT /api/bookings/{code}
     */
    public function update(Request $request, string $code): JsonResponse
    {
        $booking = Booking::where('booking_code', $code)->firstOrFail();

        if (in_array($booking->status, ['cancelled', 'completed'])) {
            return response()->json([
                'message' => 'No se puede modificar una reserva cancelada o completada.'
            ], 422);
        }

        $rules = [
            'check_in'  => ['required', 'date'],
            'check_out' => ['required', 'date', 'after:check_in'],
            'room_id'   => ['sometimes', 'exists:rooms,id'],
        ];

        // Solo exigimos que el check_in no sea en el pasado si están modificando la fecha original
        if ($request->input('check_in') !== Carbon::parse($booking->check_in)->format('Y-m-d')) {
            $rules['check_in'][] = 'after_or_equal:today';
        }

        $validated = $request->validate($rules, [
            'check_in.required' => 'La fecha de check-in es obligatoria.',
            'check_in.date' => 'La fecha de check-in debe ser válida.',
            'check_in.after_or_equal' => 'El nuevo check-in no puede ser anterior a hoy.',
            'check_out.required' => 'La fecha de check-out es obligatoria.',
            'check_out.date' => 'La fecha de check-out debe ser válida.',
            'check_out.after' => 'La fecha de check-out debe ser posterior al check-in.',
            'room_id.exists' => 'La habitación seleccionada no es válida.',
        ]);

        $newRoomId = $validated['room_id'] ?? $booking->room_id;
        $room = Room::findOrFail($newRoomId);

        $checkIn = Carbon::parse($validated['check_in'])->startOfDay();
        $checkOut = Carbon::parse($validated['check_out'])->startOfDay();
        $nights = $checkIn->diffInDays($checkOut);
        if ($nights < 1) $nights = 1;

        // Validar superposición excluyendo la reserva actual
        $isOverlapping = Booking::where('room_id', $newRoomId)
            ->where('id', '!=', $booking->id)
            ->where(function ($query) use ($validated) {
                $query->where('check_in', '<', $validated['check_out'])
                      ->where('check_out', '>', $validated['check_in']);
            })
            ->whereIn('status', ['confirmed', 'checked_in', 'reservada'])
            ->exists();

        if ($isOverlapping) {
            return response()->json([
                'message' => 'La habitación seleccionada no está disponible en las nuevas fechas.'
            ], 422);
        }

        $totalAmount = $room->price_per_night * $nights;
        $priceDifference = $totalAmount - $booking->total_amount;
        $paymentConfirmed = $request->boolean('payment_confirmed', false);

        // Si el precio sube, requerimos pago por la diferencia ANTES de actualizar las fechas en BD
        if ($priceDifference > 0 && !$paymentConfirmed) {
            return response()->json([
                'message' => 'Se requiere el pago de la diferencia para confirmar la modificación.',
                'requires_payment' => true,
                'amount_difference' => $priceDifference,
                'new_total_amount' => $totalAmount,
                'new_check_in' => $validated['check_in'],
                'new_check_out' => $validated['check_out'],
                'room_id' => $newRoomId,
            ]);
        }

        // Si el precio baja, aplicamos política de reembolso similar a la de cancelación
        $refundMessage = null;
        if ($priceDifference < 0) {
            $checkInDate = Carbon::parse($booking->check_in);
            $hoursUntilCheckIn = Carbon::now()->diffInHours($checkInDate, false);
            
            $refundAmount = abs($priceDifference);
            if ($hoursUntilCheckIn >= 48) {
                // Reembolso 100% de la diferencia
                $refundMessage = "Se ha generado un reembolso del 100% de la diferencia (S/ {$refundAmount}) por reducir los días de su estadía con más de 48h de anticipación.";
            } elseif ($hoursUntilCheckIn > 0) {
                // Reembolso 50% de la diferencia
                $refundAmount = $refundAmount * 0.5;
                $refundMessage = "Se ha generado un reembolso del 50% de la diferencia (S/ {$refundAmount}) por reducir los días de su estadía con menos de 48h de anticipación.";
            } else {
                $refundMessage = "No se generan reembolsos por reducir días durante la estadía según las políticas del hotel.";
            }
        }

        $newPayment = null;
        DB::transaction(function () use ($booking, $validated, $newRoomId, $totalAmount, $priceDifference, $paymentConfirmed, &$newPayment) {
            $booking->update([
                'check_in'     => $validated['check_in'],
                'check_out'    => $validated['check_out'],
                'room_id'      => $newRoomId,
                'total_amount' => $totalAmount,
            ]);
            
            if ($priceDifference > 0 && $paymentConfirmed) {
                $newPayment = Payment::create([
                    'booking_id'       => $booking->id,
                    'amount'           => $priceDifference,
                    'payment_method'   => 'card',
                    'status'           => 'completed',
                    'transaction_id'   => 'txn_mock_' . uniqid(),
                    'gateway_provider' => 'mock',
                    'currency'         => 'PEN',
                    'receipt_number'   => Payment::generateReceiptNumber(),
                    'paid_at'          => now(),
                ]);
            }
        });

        $booking = $booking->fresh(['room', 'guest']);

        try {
            $msg = $priceDifference > 0 
                ? "Se ha cobrado satisfactoriamente la diferencia de S/ " . number_format($priceDifference, 2) . " por la extensión de su reserva."
                : ($refundMessage ?? "Las fechas de su reserva han sido modificadas.");
                
            Mail::to($booking->guest->email)->send(new BookingModifiedMail($booking, $msg, $priceDifference));
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('No se pudo enviar correo de modificación: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Reserva modificada con éxito. ' . $refundMessage,
            'booking' => $booking,
            'payment' => $newPayment,
            'summary' => [
                'nights'          => $nights,
                'price_per_night' => $room->price_per_night,
                'total_amount'    => $totalAmount,
            ],
        ]);
    }

    /**
     * Cancela una reserva y aplica la política de reembolso.
     * POST /api/bookings/{code}/cancel
     */
    public function cancel(string $code): JsonResponse
    {
        $booking = Booking::with(['guest', 'payments'])->where('booking_code', $code)->firstOrFail();

        if ($booking->status === 'cancelled') {
            return response()->json([
                'message' => 'La reserva ya se encuentra cancelada.'
            ], 422);
        }

        if (in_array($booking->status, ['checked_in', 'completed'])) {
            return response()->json([
                'message' => 'No se puede cancelar una reserva en curso o completada.'
            ], 422);
        }

        // Lógica de Reembolso: 100% si faltan > 48 horas, 50% si no.
        $checkInDate = Carbon::parse($booking->check_in);
        $hoursUntilCheckIn = Carbon::now()->diffInHours($checkInDate, false);

        $refundPercentage = 0;
        if ($hoursUntilCheckIn >= 48) {
            $refundPercentage = 100;
        } elseif ($hoursUntilCheckIn > 0) {
            $refundPercentage = 50;
        }

        $refundAmount = ($booking->total_amount * $refundPercentage) / 100;

        // Determinar el método de pago principal de esta reserva
        $mainPayment = $booking->payments->first();
        $paymentMethod = $mainPayment ? $mainPayment->payment_method : 'Tarjeta';

        DB::transaction(function () use ($booking) {
            $booking->update([
                'status' => 'cancelled'
            ]);

            // No cambiamos el estado de la habitación aquí, ya que el estado base 
            // no depende de una reserva individual (sigue estando disponible para otras fechas).
            // En un sistema real aquí registraríamos el reembolso en la tabla payments
        });

        // Enviar correo de cancelación y reembolso
        try {
            if ($booking->guest && $booking->guest->email) {
                Mail::to($booking->guest->email)->send(new \App\Mail\BookingCancelledMail(
                    $booking, 
                    $refundPercentage, 
                    $refundAmount, 
                    $paymentMethod
                ));
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('No se pudo enviar correo de cancelación: ' . $e->getMessage());
        }

        return response()->json([
            'message'           => 'Reserva cancelada con éxito.',
            'refund_percentage' => $refundPercentage,
            'refund_amount'     => $refundAmount,
            'payment_method'    => $paymentMethod,
            'booking'           => $booking->fresh()
        ]);
    }

    /**
     * Realiza el Check-in de una reserva.
     * POST /api/staff/bookings/{code}/check-in
     */
    public function checkIn(string $code): JsonResponse
    {
        $booking = Booking::where('booking_code', $code)->firstOrFail();

        if ($booking->status !== 'confirmed') {
            return response()->json([
                'message' => $booking->status === 'pending_payment' 
                    ? 'No se puede realizar el check-in porque el pago está pendiente.' 
                    : 'La reserva debe estar confirmada para realizar el check-in.'
            ], 422);
        }

        $today = Carbon::today();
        $checkInDate = Carbon::parse($booking->check_in)->startOfDay();

        if ($today->lessThan($checkInDate)) {
            return response()->json([
                'message' => 'No se puede realizar el check-in antes de la fecha programada (' . $checkInDate->format('Y-m-d') . ').'
            ], 422);
        }

        DB::transaction(function () use ($booking) {
            $booking->update(['status' => 'checked_in']);
            
            $room = Room::find($booking->room_id);
            if ($room) {
                // Actualizamos el estado de la habitación
                $room->update(['status' => 'ocupada']);
            }
        });

        return response()->json([
            'message' => 'Check-in realizado con éxito.',
            'booking' => $booking->fresh(['room'])
        ]);
    }

    /**
     * Realiza el Check-out de una reserva.
     * POST /api/staff/bookings/{code}/check-out
     */
    public function checkOut(Request $request, string $code): JsonResponse
    {
        $booking = Booking::where('booking_code', $code)->firstOrFail();

        if ($booking->status !== 'checked_in') {
            return response()->json([
                'message' => 'La reserva debe estar en estado Check-in para realizar el Check-out.'
            ], 422);
        }

        $today = Carbon::today();
        $checkOutDate = Carbon::parse($booking->check_out)->startOfDay();

        $earlyCheckoutReason = null;
        if ($today->lessThan($checkOutDate)) {
            if (!$request->filled('early_checkout_reason')) {
                return response()->json([
                    'message' => 'Se requiere un motivo para la salida anticipada.',
                    'requires_reason' => true
                ], 422);
            }
            $earlyCheckoutReason = $request->input('early_checkout_reason');
        }

        DB::transaction(function () use ($booking, $earlyCheckoutReason) {
            $booking->update([
                'status' => 'completed',
                'early_checkout_reason' => $earlyCheckoutReason
            ]);
            
            $room = Room::find($booking->room_id);
            if ($room) {
                $room->update(['status' => 'disponible']);
            }
        });

        return response()->json([
            'message' => 'Check-out realizado con éxito.',
            'booking' => $booking->fresh(['room'])
        ]);
    }
}
