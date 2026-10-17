<?php

namespace Database\Seeders;

use App\Models\Room;
use App\Models\RoomType;
use Illuminate\Database\Seeder;

/**
 * SHE-034 / SHE-035: tipos de habitación del catálogo demo y su asignación.
 * Idempotente: updateOrCreate por slug y asignación por número de habitación.
 * Si la tarifa de la habitación coincide con la base del tipo, el override queda en null.
 */
class RoomTypeSeeder extends Seeder
{
    private const BASE = ['wifi', 'tv', 'ac', 'bath', 'safe', 'room_service'];

    public function run(): void
    {
        $types = [
            'individual' => [
                'name' => 'Individual', 'base_price' => 180.00, 'capacity' => 1, 'bed_type' => 'individual',
                'description' => 'Habitaciones individuales ideales para viajeros solos o de negocios.',
                'amenities' => [...self::BASE, 'desk'],
                'rooms' => ['101', '108'],
            ],
            'doble' => [
                'name' => 'Doble', 'base_price' => 280.00, 'capacity' => 2, 'bed_type' => 'doble',
                'description' => 'Habitaciones dobles clásicas con todo el confort del hotel.',
                'amenities' => [...self::BASE, 'minibar'],
                'rooms' => ['202'],
            ],
            'deluxe-king' => [
                'name' => 'Deluxe King', 'base_price' => 320.00, 'capacity' => 2, 'bed_type' => 'king',
                'description' => 'Habitaciones de lujo con cama king size.',
                'amenities' => [...self::BASE, 'minibar', 'coffee', 'bathrobe'],
                'rooms' => ['214'],
            ],
            'familiar' => [
                'name' => 'Familiar', 'base_price' => 360.00, 'capacity' => 4, 'bed_type' => 'doble',
                'description' => 'Amplias habitaciones para familias o grupos pequeños.',
                'amenities' => [...self::BASE, 'minibar', 'living_room'],
                'rooms' => ['115'],
            ],
            'suite' => [
                'name' => 'Suite', 'base_price' => 450.00, 'capacity' => 2, 'bed_type' => 'king',
                'description' => 'Suites con sala de estar, vistas y servicios premium.',
                'amenities' => [...self::BASE, 'minibar', 'coffee', 'bathrobe', 'bathtub', 'living_room', 'view'],
                'rooms' => ['303', '418'],
            ],
            'penthouse' => [
                'name' => 'Penthouse', 'base_price' => 1200.00, 'capacity' => 4, 'bed_type' => 'king',
                'description' => 'La experiencia más exclusiva del hotel, con terraza y mayordomo.',
                'amenities' => [...self::BASE, 'minibar', 'coffee', 'bathrobe', 'bathtub', 'living_room', 'view', 'balcony', 'butler'],
                'rooms' => ['500'],
            ],
        ];

        foreach ($types as $slug => $data) {
            $roomNumbers = $data['rooms'];
            unset($data['rooms']);

            $type = RoomType::updateOrCreate(['slug' => $slug], $data + ['active' => true]);

            foreach (Room::whereIn('room_number', $roomNumbers)->get() as $room) {
                $override = $room->getRawOriginal('price_per_night');
                if ($override !== null && round((float) $override, 2) === round((float) $type->base_price, 2)) {
                    $override = null;
                }
                $room->room_type_id = $type->id;
                $room->price_per_night = $override;
                if ($room->isDirty()) {
                    $room->save();
                }
            }
        }

        // Extras por habitación de ejemplo
        Room::where('room_number', '418')->update(['extra_amenities' => json_encode(['desk', 'butler'])]);

        $this->command?->info('Tipos de habitación asignados.');
    }
}
