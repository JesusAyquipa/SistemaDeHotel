<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Models\Booking;
use App\Models\Guest;
use App\Models\Room;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Mail;
use App\Mail\BookingConfirmedMail;

class BookingController extends Controller
{
    /**
     * Crea una nueva reserva para un huésped.
     * Genera automáticamente un código único de reserva y actualiza el estado de la habitación.
     * POST /api/bookings
     */
    public function store(StoreBookingRequest $request): JsonResponse
    {
        $validated = $request->validated();

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

        // Validar si la habitación ya se encuentra reservada en el rango de fechas solicitado
        $isOverlapping = Booking::where('room_id', $room->id)
            ->where(function ($query) use ($validated) {
                $query->where('check_in', '<', $validated['check_out'])
                      ->where('check_out', '>', $validated['check_in']);
            })
            ->whereIn('status', ['confirmed', 'checked_in', 'reservada'])
            ->exists();

        if ($isOverlapping) {
            return response()->json([
                'message' => 'La habitación seleccionada ya no se encuentra disponible en las fechas especificadas.',
                'errors'  => [
                    'dates' => ['Conflicto de fechas con una reserva existente.']
                ]
            ], 422);
        }

        $totalAmount = $room->price_per_night * $nights;

        // Iniciar transacción de base de datos para garantizar consistencia atómica
        $booking = DB::transaction(function () use ($validated, $room, $nights, $totalAmount) {
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
                    ]);
                }
            }

            // 4. Actualizar el estado de la habitación a 'reservada'
            $room->update([
                'status' => 'reservada',
            ]);

            return $newBooking;
        });

        // Cargar las relaciones para la respuesta
        $booking->load(['guest', 'room']);

        // Enviar correo de confirmación
        try {
            Mail::to($booking->guest->email)->send(new BookingConfirmedMail($booking));
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

        $validated = $request->validate([
            'check_in'  => 'required|date|after_or_equal:today',
            'check_out' => 'required|date|after:check_in',
            'room_id'   => 'sometimes|exists:rooms,id',
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

        DB::transaction(function () use ($booking, $validated, $newRoomId, $room, $totalAmount) {
            // Si la habitación cambió, liberar la antigua (si no tiene otras reservas, aunque de forma simple marcamos la nueva como reservada)
            if ($booking->room_id !== $newRoomId) {
                $oldRoom = Room::find($booking->room_id);
                // Aquí en un sistema real se verificaría si la habitación antigua tiene otras reservas antes de marcarla como disponible
                // Por simplicidad en este MVP, dejaremos que otro proceso actualice el estado de las habitaciones o lo asumimos libre si no tiene overlap
                $oldRoom->update(['status' => 'disponible']);
                $room->update(['status' => 'reservada']);
            }

            $booking->update([
                'check_in'     => $validated['check_in'],
                'check_out'    => $validated['check_out'],
                'room_id'      => $newRoomId,
                'total_amount' => $totalAmount,
            ]);
        });

        return response()->json([
            'message' => 'Reserva modificada con éxito',
            'booking' => $booking->fresh(['room']),
            'summary' => [
                'nights'          => $nights,
                'price_per_night' => $room->price_per_night,
                'total_amount'    => $totalAmount,
            ]
        ]);
    }

    /**
     * Cancela una reserva y aplica la política de reembolso.
     * POST /api/bookings/{code}/cancel
     */
    public function cancel(string $code): JsonResponse
    {
        $booking = Booking::where('booking_code', $code)->firstOrFail();

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

        DB::transaction(function () use ($booking) {
            $booking->update([
                'status' => 'cancelled'
            ]);

            // Liberar habitación
            $room = Room::find($booking->room_id);
            if ($room) {
                $room->update(['status' => 'disponible']);
            }
            
            // En un sistema real aquí registraríamos el reembolso en la tabla payments
        });

        return response()->json([
            'message'           => 'Reserva cancelada con éxito.',
            'refund_percentage' => $refundPercentage,
            'refund_amount'     => $refundAmount,
            'booking'           => $booking->fresh()
        ]);
    }
}
