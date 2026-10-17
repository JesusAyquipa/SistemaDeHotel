<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory, LogsActivity;

    public const STATUS_PENDING        = 'pending';
    public const STATUS_COMPLETED      = 'completed';
    public const STATUS_FAILED         = 'failed';
    public const STATUS_CANCELLED      = 'cancelled';
    public const STATUS_REFUND_PENDING = 'refund_pending';
    public const STATUS_REFUNDED       = 'refunded';
    public const STATUS_REFUND_REJECTED = 'refund_rejected';

    /** Métodos de pago que ingresan a la caja física (efectivo). */
    public const CASH_METHODS = ['Efectivo', 'cash'];
    /** Métodos de pago con voucher / POS. */
    public const VOUCHER_METHODS = ['Tarjeta', 'card'];

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
        'is_reconciled',
        'cash_register_closure_id',
    ];

    protected $casts = [
        'payment_details' => 'array',
        'paid_at'         => 'datetime',
        'amount'          => 'decimal:2',
        'is_reconciled'   => 'boolean',
    ];

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function closure()
    {
        return $this->belongsTo(CashRegisterClosure::class, 'cash_register_closure_id');
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
