<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Reseña de un huésped sobre su estadía (SHE-037). Una por reserva.
 */
class Review extends Model
{
    use LogsActivity;

    public const STATUS_PENDING   = 'pending';
    public const STATUS_PUBLISHED = 'published';
    public const STATUS_HIDDEN    = 'hidden';

    public const STATUSES = [self::STATUS_PENDING, self::STATUS_PUBLISHED, self::STATUS_HIDDEN];

    protected $fillable = [
        'booking_id',
        'room_id',
        'guest_id',
        'rating',
        'comment',
        'status',
        'staff_reply',
        'replied_at',
        'replied_by',
        'published_at',
    ];

    protected $casts = [
        'rating'       => 'integer',
        'replied_at'   => 'datetime',
        'published_at' => 'datetime',
    ];

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    public function guest()
    {
        return $this->belongsTo(Guest::class);
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PUBLISHED);
    }

    /** Nombre público del autor: "Ana D." (sin datos personales completos). */
    public function authorDisplayName(): string
    {
        $name = trim((string) ($this->guest->name ?? ''));
        $first = $name !== '' ? explode(' ', $name)[0] : 'Huésped';
        $surname = trim((string) ($this->guest->surname ?? ''));

        return $surname !== '' ? $first . ' ' . mb_strtoupper(mb_substr($surname, 0, 1)) . '.' : $first;
    }
}
