<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    use HasFactory;

    protected $fillable = [
        'room_number',
        'name',
        'description',
        'bed_type',
        'capacity',
        'size_m2',
        'price_per_night',
        'image_url',
        'status',
    ];

    /**
     * Relación con las reservas de esta habitación.
     */
    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }
}
