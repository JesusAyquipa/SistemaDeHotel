<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookingCompanion extends Model
{
    protected $fillable = [
        'booking_id',
        'name',
        'surname',
        'document_type',
        'document_number',
    ];

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }
}
