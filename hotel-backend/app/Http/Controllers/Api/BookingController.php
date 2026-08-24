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

            // 4. Actualizar el estado de la habitación a 'reservada'
            $room->update([
                'status' => 'reservada',
            ]);

            return $newBooking;
        });

        // Cargar las relaciones para la respuesta
        $booking->load(['guest', 'room']);

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
}
