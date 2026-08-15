<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Guest extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'surname',
        'document_type',
        'document_number',
        'birth_date',
        'nationality',
        'phone',
        'email',
        'address',
        'notes',
        'user_id',
    ];

    /**
     * Relación opcional con la cuenta de usuario si tiene registro en la web.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Relación con las reservas asociadas a la ficha de este huésped.
     */
    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }
}
