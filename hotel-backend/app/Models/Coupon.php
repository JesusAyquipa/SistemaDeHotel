<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Coupon extends Model
{
    use HasFactory, LogsActivity;

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

    public const TYPE_PERCENTAGE = 'percentage';
    public const TYPE_FIXED      = 'fixed';

    /**
     * Cupones utilizables ahora: activos, vigentes hasta el final del día de expires_at
     * y con usos disponibles.
     */
    public function scopeUsable($query)
    {
        return $query->where('is_active', true)
            ->whereDate('expires_at', '>=', now()->toDateString())
            ->where(function ($q) {
                $q->whereNull('max_uses')->orWhereColumn('current_uses', '<', 'max_uses');
            });
    }

    /**
     * Valida reglas de negocio del cupón (incluye porcentaje <= 100).
     */
    public function isCurrentlyValid(): bool
    {
        if (!$this->is_active || $this->expires_at === null) {
            return false;
        }

        // Vigente durante todo el día de expiración.
        if ($this->expires_at->copy()->endOfDay()->lt(now())) {
            return false;
        }

        if ($this->max_uses !== null && (int) $this->current_uses >= (int) $this->max_uses) {
            return false;
        }

        $value = (float) $this->discount_value;
        if ($value <= 0) {
            return false;
        }

        if ($this->discount_type === self::TYPE_PERCENTAGE && $value > 100) {
            return false;
        }

        return in_array($this->discount_type, [self::TYPE_PERCENTAGE, self::TYPE_FIXED], true);
    }

    /** Snapshot inmutable de los términos del cupón (para recalcular precios). */
    public function terms(): array
    {
        return [
            'coupon_id' => $this->id,
            'code'      => $this->code,
            'type'      => $this->discount_type,
            'value'     => (float) $this->discount_value,
        ];
    }
}
