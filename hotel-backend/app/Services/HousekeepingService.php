<?php

namespace App\Services;

use App\Events\RoomStatusUpdated;
use App\Models\Booking;
use App\Models\HousekeepingTask;
use App\Models\Room;
use App\Models\User;
use App\Services\Booking\BookingException;
use Illuminate\Support\Facades\DB;

/**
 * Flujo de tareas de housekeeping (SHE-032): creación automática al check-out,
 * inicio, fin e inspección (que libera la habitación).
 */
class HousekeepingService
{
    /**
     * Crea la tarea de limpieza tras un check-out. No duplica si la habitación
     * ya tiene una limpieza abierta.
     */
    public function createCheckoutCleaning(Room|int|null $room, ?Booking $booking = null): ?HousekeepingTask
    {
        $roomId = $room instanceof Room ? $room->id : $room;
        if (!$roomId) {
            return null;
        }

        $existing = HousekeepingTask::where('room_id', $roomId)
            ->where('type', HousekeepingTask::TYPE_CLEANING)
            ->open()
            ->first();
        if ($existing) {
            return $existing;
        }

        return HousekeepingTask::create([
            'room_id'    => $roomId,
            'type'       => HousekeepingTask::TYPE_CLEANING,
            'status'     => HousekeepingTask::STATUS_PENDING,
            'booking_id' => $booking?->id,
            'created_by' => auth()->id(),
            'notes'      => $booking ? "Limpieza de salida (reserva {$booking->booking_code})" : 'Limpieza de salida',
        ]);
    }

    public function start(HousekeepingTask $task, User $user): HousekeepingTask
    {
        return DB::transaction(function () use ($task, $user) {
            $task = HousekeepingTask::whereKey($task->id)->lockForUpdate()->firstOrFail();
            if ($task->status !== HousekeepingTask::STATUS_PENDING) {
                throw new BookingException('Solo se pueden iniciar tareas pendientes.', 422);
            }

            $task->update([
                'status'      => HousekeepingTask::STATUS_IN_PROGRESS,
                'started_at'  => now(),
                'assigned_to' => $task->assigned_to ?? $user->id,
            ]);

            return $task;
        });
    }

    public function finish(HousekeepingTask $task): HousekeepingTask
    {
        return DB::transaction(function () use ($task) {
            $task = HousekeepingTask::whereKey($task->id)->lockForUpdate()->firstOrFail();
            if ($task->status !== HousekeepingTask::STATUS_IN_PROGRESS) {
                throw new BookingException('Solo se pueden finalizar tareas en curso.', 422);
            }

            $task->update([
                'status'      => HousekeepingTask::STATUS_DONE,
                'finished_at' => now(),
            ]);

            return $task;
        });
    }

    /**
     * Inspección: marca la tarea como inspeccionada y, aplicando las reglas de
     * SHE-017 (no liberar una habitación con huésped alojado), deja la
     * habitación `disponible`.
     *
     * @return array{task: HousekeepingTask, room_released: bool, old_status: ?string}
     */
    public function inspect(HousekeepingTask $task, User $user, ?string $notes = null): array
    {
        $result = DB::transaction(function () use ($task, $user, $notes) {
            $task = HousekeepingTask::whereKey($task->id)->lockForUpdate()->firstOrFail();
            if ($task->status !== HousekeepingTask::STATUS_DONE) {
                throw new BookingException('Solo se pueden inspeccionar tareas finalizadas.', 422);
            }

            $data = [
                'status'       => HousekeepingTask::STATUS_INSPECTED,
                'inspected_by' => $user->id,
                'inspected_at' => now(),
            ];
            if ($notes) {
                $data['notes'] = trim(($task->notes ? $task->notes . "\n" : '') . 'Inspección: ' . $notes);
            }
            $task->update($data);

            $room = Room::whereKey($task->room_id)->lockForUpdate()->first();
            $oldStatus = $room?->status;
            $released = false;

            if ($room && $room->status !== Room::STATUS_AVAILABLE) {
                // SHE-017: una habitación con huésped alojado no puede pasar a disponible.
                $hasGuest = $room->bookings()->where('status', Booking::STATUS_CHECKED_IN)->exists();
                if (!$hasGuest) {
                    Room::withoutActivityLogging(fn () => $room->update(['status' => Room::STATUS_AVAILABLE]));
                    $released = true;
                }
            }

            return ['task' => $task, 'room' => $room, 'room_released' => $released, 'old_status' => $oldStatus];
        });

        if ($result['room_released']) {
            $room = $result['room'];
            ActivityLogger::log(
                'status_change',
                "Habitación {$room->room_number}: {$result['old_status']} → " . Room::STATUS_AVAILABLE . '. Motivo: inspección de housekeeping',
                $room,
                [
                    'old'    => ['status' => $result['old_status']],
                    'new'    => ['status' => Room::STATUS_AVAILABLE],
                    'reason' => 'Inspección de housekeeping',
                    'forced' => false,
                ]
            );

            try {
                event(new RoomStatusUpdated($room, (string) $result['old_status'], Room::STATUS_AVAILABLE));
            } catch (\Throwable $e) {
                report($e); // la difusión en tiempo real nunca debe romper la inspección
            }
        }

        unset($result['room']);

        return $result;
    }
}
