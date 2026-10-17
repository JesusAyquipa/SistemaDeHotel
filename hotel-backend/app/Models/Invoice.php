<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Comprobante interno (boleta/factura). NO es un comprobante electrónico SUNAT.
 */
class Invoice extends Model
{
    public const TYPE_BOLETA  = 'boleta';
    public const TYPE_FACTURA = 'factura';
    public const TYPES = [self::TYPE_BOLETA, self::TYPE_FACTURA];

    public const SERIES = [
        self::TYPE_BOLETA  => 'B001',
        self::TYPE_FACTURA => 'F001',
    ];

    public const STATUS_ISSUED = 'issued';
    public const STATUS_VOIDED = 'voided';

    public const DOC_TYPES = ['DNI', 'RUC', 'CE', 'PAS'];

    protected $fillable = [
        'booking_id',
        'type',
        'series',
        'number',
        'customer_doc_type',
        'customer_doc_number',
        'customer_name',
        'customer_address',
        'subtotal',
        'igv',
        'total',
        'items',
        'issued_at',
        'status',
        'voided_reason',
        'voided_at',
        'issued_by',
        'voided_by',
    ];

    protected $casts = [
        'items'     => 'array',
        'number'    => 'integer',
        'subtotal'  => 'decimal:2',
        'igv'       => 'decimal:2',
        'total'     => 'decimal:2',
        'issued_at' => 'datetime',
        'voided_at' => 'datetime',
    ];

    protected $appends = ['full_number'];

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function issuer()
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    public function voider()
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ISSUED);
    }

    /** Número completo, p. ej. B001-00000012. */
    public function getFullNumberAttribute(): string
    {
        return $this->series . '-' . str_pad((string) $this->number, 8, '0', STR_PAD_LEFT);
    }

    /** Datos del emisor (config/hotel.php) para la representación impresa. */
    public static function hotelData(): array
    {
        return [
            'name'    => config('hotel.name'),
            'ruc'     => config('hotel.ruc'),
            'address' => config('hotel.address'),
            'phone'   => config('hotel.phone'),
        ];
    }
}
