<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Registro persistente de un cierre de caja.
 */
class CashRegisterClosure extends Model
{
    protected $fillable = [
        'user_id',
        'opened_at',
        'closed_at',
        'totals',
        'expected_amount',
        'counted_amount',
        'difference',
        'notes',
    ];

    protected $casts = [
        'opened_at'       => 'datetime',
        'closed_at'       => 'datetime',
        'totals'          => 'array',
        'expected_amount' => 'decimal:2',
        'counted_amount'  => 'decimal:2',
        'difference'      => 'decimal:2',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class, 'cash_register_closure_id');
    }
}
