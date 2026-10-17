<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Model;

/**
 * Tarea de housekeeping asignable al personal (SHE-032).
 * Flujo: pending → in_progress → done → inspected.
 */
class HousekeepingTask extends Model
{
    use LogsActivity;

    public const TYPE_CLEANING    = 'cleaning';
    public const TYPE_INSPECTION  = 'inspection';
    public const TYPE_MAINTENANCE = 'maintenance';

    public const TYPES = [self::TYPE_CLEANING, self::TYPE_INSPECTION, self::TYPE_MAINTENANCE];

    public const STATUS_PENDING     = 'pending';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_DONE        = 'done';
    public const STATUS_INSPECTED   = 'inspected';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_IN_PROGRESS,
        self::STATUS_DONE,
        self::STATUS_INSPECTED,
    ];

    /** Estados en los que la tarea sigue abierta. */
    public const OPEN_STATUSES = [self::STATUS_PENDING, self::STATUS_IN_PROGRESS, self::STATUS_DONE];

    protected $fillable = [
        'room_id',
        'assigned_to',
        'type',
        'status',
        'notes',
        'created_by',
        'booking_id',
        'started_at',
        'finished_at',
        'inspected_by',
        'inspected_at',
    ];

    protected $casts = [
        'started_at'   => 'datetime',
        'finished_at'  => 'datetime',
        'inspected_at' => 'datetime',
    ];

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function inspector()
    {
        return $this->belongsTo(User::class, 'inspected_by');
    }

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function scopeOpen($query)
    {
        return $query->whereIn('status', self::OPEN_STATUSES);
    }
}
