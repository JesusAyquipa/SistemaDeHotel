<?php

namespace Database\Seeders;

use App\Models\Room;
use Illuminate\Database\Seeder;

class RoomSeeder extends Seeder
{
    /**
     * Inserta habitaciones de ejemplo variadas para poder probar filtros con datos reales.
     */
    public function run(): void
    {
        $rooms = [
            [
                'room_number'    => '101',
                'name'           => 'Habitación Individual Clásica',
                'description'    => 'Acogedora habitación individual con vista al jardín interior. Decoración clásica con detalles en madera de caoba, cama individual con ropa de cama de lino y escritorio de correspondencia.',
                'bed_type'       => 'individual',
                'capacity'       => 1,
                'size_m2'        => 22,
                'price_per_night'=> 180.00,
                'image_url'      => null,
                'status'         => 'disponible',
            ],
            [
                'room_number'    => '202',
                'name'           => 'Suite Doble Patrimonio',
                'description'    => 'Nuestra habitación doble estándar ofrece una experiencia excepcional. Presenta cortinas de lino grueso, accesorios de latón y una mesa de escritura artesanal para correspondencia.',
                'bed_type'       => 'doble',
                'capacity'       => 2,
                'size_m2'        => 38,
                'price_per_night'=> 280.00,
                'image_url'      => null,
                'status'         => 'disponible',
            ],
            [
                'room_number'    => '303',
                'name'           => 'Suite Embajador',
                'description'    => 'Amplia suite de esquina con vistas panorámicas. Incluye sala de estar separada con escritorio, molduras originales de 1894 y baño de mármol con bañera de patas.',
                'bed_type'       => 'king',
                'capacity'       => 2,
                'size_m2'        => 79,
                'price_per_night'=> 450.00,
                'image_url'      => null,
                'status'         => 'disponible',
            ],
            [
                'room_number'    => '214',
                'name'           => 'Habitación Doble Deluxe',
                'description'    => 'Habitación doble de lujo con vista a la plaza central. Cama king size, minibar y acceso al salón privado de huéspedes en el tercer piso.',
                'bed_type'       => 'king',
                'capacity'       => 2,
                'size_m2'        => 45,
                'price_per_night'=> 320.00,
                'image_url'      => null,
                'status'         => 'disponible',
            ],
            [
                'room_number'    => '115',
                'name'           => 'Habitación Familiar Doble',
                'description'    => 'Espaciosa habitación familiar con dos camas dobles, ideal para familias o grupos pequeños. Amplio baño y zona de estar independiente.',
                'bed_type'       => 'doble',
                'capacity'       => 4,
                'size_m2'        => 55,
                'price_per_night'=> 360.00,
                'image_url'      => null,
                'status'         => 'disponible',
            ],
            [
                'room_number'    => '418',
                'name'           => 'Junior Suite Ejecutiva',
                'description'    => 'Suite junior con zona de trabajo profesional, cama king y vistas al jardín. Incluye servicio de mayordomo y acceso prioritario al business center.',
                'bed_type'       => 'king',
                'capacity'       => 2,
                'size_m2'        => 62,
                'price_per_night'=> 520.00,
                'image_url'      => null,
                'status'         => 'disponible',
            ],
            [
                'room_number'    => '500',
                'name'           => 'El Penthouse del Fundador',
                'description'    => 'La cima de nuestra oferta. Ocupa todo el piso superior con biblioteca privada, comedor formal y terraza perimetral con vistas a la plaza de la ciudad.',
                'bed_type'       => 'king',
                'capacity'       => 4,
                'size_m2'        => 195,
                'price_per_night'=> 1200.00,
                'image_url'      => null,
                'status'         => 'disponible',
            ],
            [
                'room_number'    => '108',
                'name'           => 'Habitación Individual Ejecutiva',
                'description'    => 'Habitación individual con todos los servicios ejecutivos. Escritorio amplio, Wi-Fi de alta velocidad, minibar y vistas al jardín interior. Ideal para viajeros de negocios.',
                'bed_type'       => 'individual',
                'capacity'       => 1,
                'size_m2'        => 28,
                'price_per_night'=> 220.00,
                'image_url'      => null,
                'status'         => 'mantenimiento',
            ],
        ];

        foreach ($rooms as $room) {
            Room::create($room);
        }
    }
}
