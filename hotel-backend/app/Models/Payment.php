<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'amount',
        'payment_method',
        'status',
        'paid_at',
        'transaction_id',
        'gateway_provider',
        'currency',
        'receipt_number',
        'payment_details',
    ];

    protected $casts = [
        'payment_details' => 'array',
        'paid_at'         => 'datetime',
        'amount'          => 'decimal:2',
    ];

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    /**
     * Genera un número de comprobante único con formato REC-YYYYMM-XXXX.
     */
    public static function generateReceiptNumber(): string
    {
        $prefix = 'REC-' . now()->format('Ym') . '-';
        do {
            $number = $prefix . strtoupper(\Illuminate\Support\Str::random(6));
        } while (static::where('receipt_number', $number)->exists());

        return $number;
    }
}
