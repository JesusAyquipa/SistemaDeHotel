<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Imagen de la galería de una habitación (SHE-035). `path` es relativo al disco `public`.
 */
class RoomImage extends Model
{
    protected $fillable = [
        'room_id',
        'path',
        'sort_order',
        'is_primary',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'is_primary' => 'boolean',
    ];

    protected $appends = ['url'];

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    /** URL relativa al backend (el frontend la resuelve con assetUrl). */
    public function getUrlAttribute(): string
    {
        return '/storage/' . ltrim((string) $this->path, '/');
    }
}
