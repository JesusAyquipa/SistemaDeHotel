<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Season extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'name',
        'start_date',
        'end_date',
        'rate_adjustment',
        'is_active',
        'room_type_id', // SHE-034: null = todos los tipos
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'rate_adjustment' => 'decimal:2',
        'is_active' => 'boolean',
        'room_type_id' => 'integer',
    ];

    /** SHE-034: tipo de habitación al que aplica (null = todos). */
    public function roomType()
    {
        return $this->belongsTo(RoomType::class);
    }

    /** Temporadas que aplican a un tipo: las generales (null) + las del tipo. */
    public function scopeForRoomType($query, ?int $roomTypeId)
    {
        return $query->where(function ($q) use ($roomTypeId) {
            $q->whereNull('room_type_id');
            if ($roomTypeId) {
                $q->orWhere('room_type_id', $roomTypeId);
            }
        });
    }

    /**
     * Temporadas activas que se cruzan con el rango [$from, $to] (fechas inclusivas).
     * rate_adjustment es un porcentaje: 20.00 = +20%, -10.00 = -10%.
     */
    public function scopeActiveBetween($query, $from, $to)
    {
        return $query->where('is_active', true)
            ->whereDate('start_date', '<=', $to)
            ->whereDate('end_date', '>=', $from);
    }
}
