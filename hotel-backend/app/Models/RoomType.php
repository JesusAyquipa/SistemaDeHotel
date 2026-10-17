<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Tipo de habitación (SHE-034): tarifa base, capacidad y comodidades comunes.
 */
class RoomType extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'base_price',
        'capacity',
        'bed_type',
        'amenities',
        'active',
    ];

    protected $casts = [
        'base_price' => 'decimal:2',
        'capacity'   => 'integer',
        'amenities'  => 'array',
        'active'     => 'boolean',
    ];

    public function rooms()
    {
        return $this->hasMany(Room::class);
    }

    public function seasons()
    {
        return $this->hasMany(Season::class);
    }

    /**
     * Expande claves de comodidades al formato {key, label, icon} según config/amenities.php.
     * Las claves desconocidas se ignoran.
     */
    public static function describeAmenities(iterable $keys): array
    {
        $catalog = config('amenities', []);
        $out = [];
        foreach ($keys as $key) {
            if (is_string($key) && isset($catalog[$key]) && !isset($out[$key])) {
                $out[$key] = ['key' => $key, 'label' => $catalog[$key]['label'], 'icon' => $catalog[$key]['icon']];
            }
        }

        return array_values($out);
    }
}
