<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Charge extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'date',
        'concept',
        'quantity',
        'unit_price',
        'total'
    ];

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }
}
