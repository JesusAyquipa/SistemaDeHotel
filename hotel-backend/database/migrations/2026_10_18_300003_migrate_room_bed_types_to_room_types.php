<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * SHE-034 (migración de datos): crea un tipo de habitación por cada valor distinto
 * de rooms.bed_type (el "tipo" que usaba el sistema hasta ahora) y lo asigna.
 * La tarifa base del tipo es la menor tarifa de sus habitaciones; cada habitación
 * conserva su price_per_night como override, así ningún precio cambia.
 */
return new class extends Migration
{
    private const LABELS = [
        'individual' => 'Individual',
        'doble'      => 'Doble',
        'king'       => 'King',
        'suite'      => 'Suite',
        'familiar'   => 'Familiar',
    ];

    /** Comodidades equivalentes a la lista fija que mostraba PublicRoomController. */
    private const BASE_AMENITIES = ['wifi', 'tv', 'ac', 'bath', 'safe', 'room_service'];
    private const EXTRA_AMENITIES = [
        'doble' => ['minibar'],
        'king'  => ['minibar', 'coffee', 'bathrobe'],
    ];

    public function up(): void
    {
        $groups = DB::table('rooms')
            ->whereNull('room_type_id')
            ->selectRaw('bed_type, MIN(price_per_night) as min_price, MAX(capacity) as max_capacity')
            ->groupBy('bed_type')
            ->get();

        foreach ($groups as $group) {
            $bed = (string) $group->bed_type;
            $slug = Str::slug($bed) ?: 'tipo';
            $name = self::LABELS[$bed] ?? Str::title($bed);

            $typeId = DB::table('room_types')->where('slug', $slug)->value('id');
            if (!$typeId) {
                $typeId = DB::table('room_types')->insertGetId([
                    'name'        => $name,
                    'slug'        => $slug,
                    'description' => null,
                    'base_price'  => round((float) $group->min_price, 2),
                    'capacity'    => max(1, (int) $group->max_capacity),
                    'bed_type'    => $bed,
                    'amenities'   => json_encode(array_values(array_unique(array_merge(
                        self::BASE_AMENITIES,
                        self::EXTRA_AMENITIES[$bed] ?? []
                    )))),
                    'active'      => true,
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }

            DB::table('rooms')
                ->whereNull('room_type_id')
                ->where('bed_type', $bed)
                ->update(['room_type_id' => $typeId]);
        }
    }

    public function down(): void
    {
        DB::table('rooms')->update(['room_type_id' => null]);
        DB::table('room_types')->delete();
    }
};
