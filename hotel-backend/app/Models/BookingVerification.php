<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Verificación de correo para reservas sin cuenta (SHE-026).
 * Solo se guardan hashes: nunca el código ni el token en claro.
 */
class BookingVerification extends Model
{
    protected $fillable = [
        'email',
        'code_hash',
        'code_expires_at',
        'attempts',
        'token_hash',
        'token_expires_at',
        'consumed_at',
    ];

    protected $hidden = ['code_hash', 'token_hash'];

    protected $casts = [
        'code_expires_at'  => 'datetime',
        'token_expires_at' => 'datetime',
        'consumed_at'      => 'datetime',
        'attempts'         => 'integer',
    ];
}
