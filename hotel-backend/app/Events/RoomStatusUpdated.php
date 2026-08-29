<?php

namespace App\Events;

use App\Models\Room;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RoomStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Room $room;
    public string $oldStatus;
    public string $newStatus;

    public function __construct(Room $room, string $oldStatus, string $newStatus)
    {
        $this->room = $room;
        $this->oldStatus = $oldStatus;
        $this->newStatus = $newStatus;
    }

    /**
     * Canal público en el que se transmite el evento de cambio de estado.
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('rooms'),
        ];
    }

    /**
     * Nombre del evento para clientes frontend (Laravel Echo).
     */
    public function broadcastAs(): string
    {
        return 'room.status.updated';
    }

    /**
     * Payload que se envía a los suscriptores WebSocket.
     */
    public function broadcastWith(): array
    {
        return [
            'room_id'     => $this->room->id,
            'room_number' => $this->room->room_number,
            'name'        => $this->room->name,
            'old_status'  => $this->oldStatus,
            'new_status'  => $this->newStatus,
            'updated_at'  => now()->toIso8601String(),
        ];
    }
}
