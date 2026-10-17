<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Model;

/**
 * Datos de pre check-in online enviados por el huésped antes de su llegada (SHE-036).
 */
class BookingPrecheck extends Model
{
    use LogsActivity;

    /** Días antes del check-in en que se habilita el pre check-in. */
    public const WINDOW_DAYS = 7;

    protected $fillable = [
        'booking_id',
        'arrival_time',
        'document_type',
        'document_number',
        'nationality',
        'address',
        'companions',
        'special_requests',
        'submitted_at',
    ];

    protected $casts = [
        'companions'   => 'array',
        'submitted_at' => 'datetime',
    ];

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }
}
