<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_code',
        'guest_id',
        'room_id',
        'check_in',
        'check_out',
        'total_amount',
        'status',
    ];

    protected static function booted()
    {
        static::creating(function ($booking) {
            if (empty($booking->booking_code)) {
                $booking->booking_code = 'RES-' . strtoupper(\Illuminate\Support\Str::random(8));
            }
        });
    }

    public function guest()
    {
        return $this->belongsTo(Guest::class);
    }

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Obtiene el pago más reciente asociado a esta reserva.
     */
    public function latestPayment()
    {
        return $this->hasOne(Payment::class)->latestOfMany();
    }
}
