<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Entrada de la bitácora de auditoría. Solo se inserta (nunca se actualiza).
 */
class ActivityLog extends Model
{
    public const UPDATED_AT = null;

    /** Etiquetas en español de las entidades auditadas (nombre corto => etiqueta). */
    public const SUBJECT_LABELS = [
        'Booking' => 'Reserva',
        'Room'    => 'Habitación',
        'Product' => 'Producto',
        'Coupon'  => 'Cupón',
        'Season'  => 'Temporada',
        'Guest'   => 'Huésped',
        'User'    => 'Usuario',
        'Payment' => 'Pago',
        'Charge'  => 'Consumo',
        'Invoice' => 'Comprobante',
        'CashRegisterSession' => 'Caja',
    ];

    protected $fillable = [
        'user_id',
        'action',
        'subject_type',
        'subject_id',
        'description',
        'changes',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'changes'    => 'array',
        'created_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
