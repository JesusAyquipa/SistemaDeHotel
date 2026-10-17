<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    use HasFactory, LogsActivity;

    // Vocabulario de estados operativos de la habitación.
    public const STATUS_AVAILABLE   = 'disponible';
    public const STATUS_OCCUPIED    = 'ocupada';
    public const STATUS_CLEANING    = 'limpieza';
    public const STATUS_MAINTENANCE = 'mantenimiento';
    public const STATUS_RESERVED    = 'reservada';

    /** Estados en los que la habitación no puede recibir nuevas reservas. */
    public const UNBOOKABLE_STATUSES = [self::STATUS_MAINTENANCE, 'inactiva', 'fuera_de_servicio'];

    protected $fillable = [
        'room_number',
        'name',
        'description',
        'bed_type',
        'capacity',
        'size_m2',
        'price_per_night',
        'image_url',
        'status',
        // SHE-034 / SHE-035
        'room_type_id',
        'extra_amenities',
    ];

    protected $casts = [
        'extra_amenities' => 'array',
    ];

    /**
     * SHE-034: tipo de habitación (tarifa base, comodidades comunes).
     */
    public function roomType()
    {
        return $this->belongsTo(RoomType::class);
    }

    /** SHE-035: galería de imágenes (principal primero, luego por orden). */
    public function images()
    {
        return $this->hasMany(RoomImage::class)->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id');
    }

    /**
     * REGLA ÚNICA de precio (SHE-034): override de la habitación ?? tarifa base del tipo.
     * price_per_night (columna) es el override opcional.
     */
    public function getEffectivePriceAttribute(): float
    {
        $override = $this->attributes['price_per_night'] ?? null;
        if ($override !== null) {
            return round((float) $override, 2);
        }

        return round((float) ($this->roomType?->base_price ?? 0), 2);
    }

    /**
     * Filtra por precio efectivo ($operator: >=, <=). El valor se interpola como número
     * (float formateado) porque SQLite compara mal una expresión sin afinidad con un
     * parámetro enlazado como texto.
     */
    public function scopeWhereEffectivePrice($query, string $operator, float $value)
    {
        $operator = in_array($operator, ['>=', '<=', '>', '<', '='], true) ? $operator : '>=';

        return $query->whereRaw(self::effectivePriceSql() . " {$operator} " . sprintf('%.2F', $value));
    }

    /** Misma regla en SQL (filtros y ordenamiento por precio). */
    public static function effectivePriceSql(): string
    {
        return 'COALESCE(rooms.price_per_night, (SELECT room_types.base_price FROM room_types WHERE room_types.id = rooms.room_type_id), 0)';
    }

    /** Claves de comodidades: las del tipo + extras de la habitación (sin duplicados). */
    public function amenityKeys(): array
    {
        return array_values(array_unique(array_merge(
            (array) ($this->roomType?->amenities ?? []),
            (array) ($this->extra_amenities ?? [])
        )));
    }

    /**
     * Compatibilidad: en JSON `price_per_night` es el precio EFECTIVO (lo que leen los
     * clientes existentes); el override crudo se expone como `price_override`.
     */
    public function toArray()
    {
        $array = parent::toArray();
        if (array_key_exists('price_per_night', $this->attributes) || array_key_exists('room_type_id', $this->attributes)) {
            $raw = $this->attributes['price_per_night'] ?? null;
            $array['price_override'] = $raw !== null ? round((float) $raw, 2) : null;
            $array['effective_price'] = $this->effective_price;
            $array['price_per_night'] = $array['effective_price'];
        }

        return $array;
    }

    /**
     * Relación con las reservas de esta habitación.
     */
    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }

    /** Reseñas de huéspedes (SHE-037). */
    public function reviews()
    {
        return $this->hasMany(Review::class);
    }
}
