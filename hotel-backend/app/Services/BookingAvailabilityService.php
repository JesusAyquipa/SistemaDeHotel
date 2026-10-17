<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Room;
use App\Services\Booking\BookingException;

/**
 * Verificaciones de disponibilidad. lockRoom()/assertBookable() deben invocarse
 * dentro de DB::transaction para que el bloqueo pesimista sea efectivo.
 */
class BookingAvailabilityService
{
    /**
     * Bloquea la fila de la habitación (SELECT ... FOR UPDATE) para serializar reservas concurrentes.
     */
    public function lockRoom(int $roomId): Room
    {
        $room = Room::whereKey($roomId)->lockForUpdate()->first();

        if (!$room) {
            throw new BookingException('La habitación seleccionada no existe.', 404);
        }

        return $room;
    }

    public function hasOverlap(int $roomId, $checkIn, $checkOut, ?int $excludeBookingId = null): bool
    {
        return Booking::where('room_id', $roomId)
            ->when($excludeBookingId, fn ($q) => $q->where('id', '!=', $excludeBookingId))
            ->blocking()
            ->overlapping($checkIn, $checkOut)
            ->exists();
    }

    /**
     * Valida estado operativo, capacidad y solapamiento de fechas.
     */
    public function assertBookable(Room $room, $checkIn, $checkOut, int $totalGuests, ?int $excludeBookingId = null): void
    {
        if (in_array($room->status, Room::UNBOOKABLE_STATUSES, true)) {
            throw new BookingException('La habitación seleccionada no está disponible para reservas (fuera de servicio).', 422);
        }

        if ($totalGuests > (int) $room->capacity) {
            throw new BookingException(
                "La cantidad de personas excede la capacidad máxima de esta habitación ({$room->capacity}).",
                422,
                ['errors' => ['companions' => ["Capacidad excedida. La habitación permite un máximo de {$room->capacity} persona(s)."]]]
            );
        }

        if ($this->hasOverlap($room->id, $checkIn, $checkOut, $excludeBookingId)) {
            throw new BookingException(
                'La habitación seleccionada ya no se encuentra disponible en las fechas especificadas.',
                409,
                ['errors' => ['dates' => ['Conflicto de fechas con una reserva existente.']]]
            );
        }
    }
}
