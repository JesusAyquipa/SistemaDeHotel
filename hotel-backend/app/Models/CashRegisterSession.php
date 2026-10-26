<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Sesión de caja de un usuario (SHE-014): apertura con monto inicial y cierre
 * vinculado al CashRegisterClosure correspondiente.
 */
class CashRegisterSession extends Model
{
    public const STATUS_OPEN   = 'open';
    public const STATUS_CLOSED = 'closed';

    protected $fillable = [
        'user_id',
        'opened_at',
        'opening_amount',
        'closed_at',
        'cash_register_closure_id',
        'status',
        'notes',
    ];

    protected $casts = [
        'opened_at'      => 'datetime',
        'closed_at'      => 'datetime',
        'opening_amount' => 'decimal:2',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function closure()
    {
        return $this->belongsTo(CashRegisterClosure::class, 'cash_register_closure_id');
    }

    public function scopeOpen($query)
    {
        return $query->where('status', self::STATUS_OPEN);
    }
}
