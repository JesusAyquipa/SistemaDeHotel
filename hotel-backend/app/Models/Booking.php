<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    use HasFactory, LogsActivity;

    // Estados canónicos de una reserva (única fuente de verdad).
    public const STATUS_PENDING_PAYMENT = 'pending_payment';
    public const STATUS_CONFIRMED       = 'confirmed';
    public const STATUS_CHECKED_IN      = 'checked_in';
    public const STATUS_CHECKED_OUT     = 'checked_out';
    public const STATUS_CANCELLED       = 'cancelled';
    public const STATUS_EXPIRED         = 'expired';
    public const STATUS_NO_SHOW         = 'no_show';

    public const STATUSES = [
        self::STATUS_PENDING_PAYMENT,
        self::STATUS_CONFIRMED,
        self::STATUS_CHECKED_IN,
        self::STATUS_CHECKED_OUT,
        self::STATUS_CANCELLED,
        self::STATUS_EXPIRED,
        self::STATUS_NO_SHOW,
    ];

    /**
     * Estados que bloquean la disponibilidad de la habitación.
     * pending_payment solo bloquea mientras expires_at > now() (ver scopeBlocking).
     */
    public const BLOCKING_STATUSES = [
        self::STATUS_PENDING_PAYMENT,
        self::STATUS_CONFIRMED,
        self::STATUS_CHECKED_IN,
    ];

    /** Estados en los que la reserva puede modificarse o cancelarse. */
    public const MODIFIABLE_STATUSES = [
        self::STATUS_PENDING_PAYMENT,
        self::STATUS_CONFIRMED,
    ];

    /** Minutos que una reserva pending_payment retiene la habitación. */
    public const PENDING_TTL_MINUTES = 30;

    public const STAFF_ROLES = ['admin', 'recepcionista'];

    protected $fillable = [
        'booking_code',
        'guest_id',
        'room_id',
        'check_in',
        'check_out',
        'total_amount',
        'status',
        'early_checkout_reason',
        'expires_at',
        'coupon_id',
        'discount_amount',
        'coupon_counted',
        'pricing_details',
    ];

    protected $casts = [
        'expires_at'      => 'datetime',
        'coupon_counted'  => 'boolean',
        'pricing_details' => 'array',
        'discount_amount' => 'decimal:2',
    ];

    protected $hidden = [
        'coupon_counted',
    ];

    protected static function booted()
    {
        static::creating(function ($booking) {
            if (empty($booking->booking_code)) {
                $booking->booking_code = \App\Services\Booking\BookingCodeGenerator::generate();
            }
        });
    }

    public function guest()
    {
        return $this->belongsTo(Guest::class);
    }

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function charges()
    {
        return $this->hasMany(Charge::class);
    }

    public function coupon()
    {
        return $this->belongsTo(Coupon::class);
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }

    public function companions()
    {
        return $this->hasMany(BookingCompanion::class);
    }

    /** Pre check-in online (SHE-036). Se serializa como `pre_check_in`. */
    public function preCheckIn()
    {
        return $this->hasOne(BookingPrecheck::class);
    }

    /** Reseña del huésped (SHE-037). */
    public function review()
    {
        return $this->hasOne(Review::class);
    }

    /**
     * Obtiene el pago más reciente asociado a esta reserva.
     */
    public function latestPayment()
    {
        return $this->hasOne(Payment::class)->latestOfMany();
    }

    // ------------------------------------------------------------------
    // Scopes
    // ------------------------------------------------------------------

    /**
     * Reservas que bloquean la habitación: confirmed, checked_in y
     * pending_payment aún no vencidas (expires_at > now()).
     */
    public function scopeBlocking(Builder $query): Builder
    {
        return $query->where(function (Builder $q) {
            $q->whereIn('status', [self::STATUS_CONFIRMED, self::STATUS_CHECKED_IN])
              ->orWhere(function (Builder $q) {
                  $q->where('status', self::STATUS_PENDING_PAYMENT)
                    ->where('expires_at', '>', now());
              });
        });
    }

    /**
     * Reservas cuyo rango [check_in, check_out) se cruza con [$checkIn, $checkOut).
     */
    public function scopeOverlapping(Builder $query, $checkIn, $checkOut): Builder
    {
        $in  = $checkIn instanceof \DateTimeInterface ? $checkIn->format('Y-m-d') : (string) $checkIn;
        $out = $checkOut instanceof \DateTimeInterface ? $checkOut->format('Y-m-d') : (string) $checkOut;

        return $query->where('check_in', '<', $out)->where('check_out', '>', $in);
    }

    /**
     * Reservas pending_payment cuyo plazo de pago ya venció.
     */
    public function scopeExpiredPending(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PENDING_PAYMENT)
            ->where(function (Builder $q) {
                $q->where('expires_at', '<=', now())
                  ->orWhere(function (Builder $q) {
                      $q->whereNull('expires_at')
                        ->where('created_at', '<=', now()->subMinutes(self::PENDING_TTL_MINUTES));
                  });
            });
    }

    /**
     * Reservas pertenecientes a un usuario (ver isOwnedBy).
     */
    public function scopeOwnedBy(Builder $query, User $user): Builder
    {
        return $query->whereHas('guest', function (Builder $q) use ($user) {
            $q->where('user_id', $user->id)
              ->orWhere(function (Builder $q) use ($user) {
                  $q->whereNull('user_id')
                    ->whereRaw('LOWER(email) = ?', [mb_strtolower((string) $user->email)]);
              });
        });
    }

    // ------------------------------------------------------------------
    // Autorización / helpers de dominio
    // ------------------------------------------------------------------

    public static function userIsStaff(?User $user): bool
    {
        return $user !== null && $user->hasAnyRole(self::STAFF_ROLES);
    }

    /**
     * Dueño = guest.user_id == user.id, o (guest.user_id null y email coincide sin distinguir mayúsculas).
     */
    public function isOwnedBy(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        $guest = $this->guest;
        if (!$guest) {
            return false;
        }

        if ($guest->user_id !== null) {
            return (int) $guest->user_id === (int) $user->id;
        }

        return !empty($guest->email)
            && mb_strtolower($guest->email) === mb_strtolower((string) $user->email);
    }

    /**
     * Acceso permitido al dueño de la reserva o al personal del hotel.
     */
    public function isAccessibleBy(?User $user): bool
    {
        return self::userIsStaff($user) || $this->isOwnedBy($user);
    }

    public function isModifiable(): bool
    {
        return in_array($this->status, self::MODIFIABLE_STATUSES, true);
    }

    public function isPendingExpired(): bool
    {
        if ($this->status !== self::STATUS_PENDING_PAYMENT) {
            return false;
        }

        if ($this->expires_at === null) {
            return $this->created_at !== null
                && $this->created_at->lte(now()->subMinutes(self::PENDING_TTL_MINUTES));
        }

        return $this->expires_at->lte(now());
    }

    /** Suma de pagos completados (positivos). */
    public function paidAmount(): float
    {
        return round((float) $this->payments()
            ->where('status', Payment::STATUS_COMPLETED)
            ->where('amount', '>', 0)
            ->sum('amount'), 2);
    }

    /** Suma (positiva) de reembolsos ya registrados (pendientes o ejecutados). */
    public function refundedAmount(): float
    {
        return round(abs((float) $this->payments()
            ->whereIn('status', [Payment::STATUS_REFUND_PENDING, Payment::STATUS_REFUNDED])
            ->sum('amount')), 2);
    }

    public function chargesTotal(): float
    {
        return round((float) $this->charges()->sum('total'), 2);
    }

    /**
     * Saldo = total de alojamiento + consumos - pagos completados.
     */
    public function balance(): float
    {
        return round((float) $this->total_amount + $this->chargesTotal() - $this->paidAmount(), 2);
    }
}
