<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Coupon extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'discount_type',
        'discount_value',
        'expires_at',
        'max_uses',
        'current_uses',
        'is_active',
    ];

    protected $casts = [
        'expires_at' => 'date',
        'discount_value' => 'decimal:2',
        'is_active' => 'boolean',
    ];
}
