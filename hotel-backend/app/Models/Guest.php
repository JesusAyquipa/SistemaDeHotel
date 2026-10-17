<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Guest extends Model
{
    use HasFactory, LogsActivity;

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
        // SHE-033: preferencias, VIP y lista negra
        'preferences',
        'is_vip',
        'is_blacklisted',
        'blacklist_reason',
    ];

    protected $casts = [
        'preferences'    => 'array',
        'is_vip'         => 'boolean',
        'is_blacklisted' => 'boolean',
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

    /** Búsqueda por email sin distinguir mayúsculas. */
    public function scopeEmailIs($query, ?string $email)
    {
        return $query->whereRaw('LOWER(email) = ?', [mb_strtolower(trim((string) $email))]);
    }

    /** Teléfono enmascarado (solo últimos 3 dígitos visibles). */
    public function maskedPhone(): ?string
    {
        if (empty($this->phone)) {
            return null;
        }
        $digits = preg_replace('/\D/', '', $this->phone);
        $len = strlen($digits);
        if ($len <= 3) {
            return str_repeat('*', $len);
        }
        return str_repeat('*', $len - 3) . substr($digits, -3);
    }
}
