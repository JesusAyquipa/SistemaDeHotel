<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use LogsActivity;

    /** Categorías que son servicios (sin control de stock). */
    public const SERVICE_CATEGORIES = ['servicios_spa', 'lavanderia'];

    protected $fillable = [
        'name',
        'category',
        'price',
        'stock',
        'is_active',
        'tracks_stock',
    ];

    protected $casts = [
        'tracks_stock' => 'boolean',
        'stock'        => 'integer',   // casts tomados del commit 5bec1f7 (Jesús)
        'is_active'    => 'boolean',
    ];

    public function charges()
    {
        return $this->hasMany(Charge::class);
    }
}
