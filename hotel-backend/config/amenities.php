<?php

/*
|--------------------------------------------------------------------------
| Catálogo de comodidades (SHE-035)
|--------------------------------------------------------------------------
| Clave => [etiqueta en español, icono de Material Symbols].
| Los tipos de habitación guardan un arreglo de claves (room_types.amenities)
| y cada habitación puede sumar extras (rooms.extra_amenities).
| Reflejado en el frontend: src/constants/amenities.js
*/

return [
    'wifi'         => ['label' => 'Wi-Fi de alta velocidad', 'icon' => 'wifi'],
    'tv'           => ['label' => 'Smart TV', 'icon' => 'tv'],
    'ac'           => ['label' => 'Aire acondicionado', 'icon' => 'ac_unit'],
    'heating'      => ['label' => 'Calefacción', 'icon' => 'heat'],
    'bath'         => ['label' => 'Baño privado', 'icon' => 'shower'],
    'bathtub'      => ['label' => 'Bañera', 'icon' => 'bathtub'],
    'safe'         => ['label' => 'Caja fuerte', 'icon' => 'lock'],
    'room_service' => ['label' => 'Servicio a la habitación', 'icon' => 'room_service'],
    'minibar'      => ['label' => 'Frigobar', 'icon' => 'kitchen'],
    'coffee'       => ['label' => 'Cafetera de cortesía', 'icon' => 'coffee_maker'],
    'bathrobe'     => ['label' => 'Batas y amenities premium', 'icon' => 'dry_cleaning'],
    'desk'         => ['label' => 'Escritorio de trabajo', 'icon' => 'desk'],
    'balcony'      => ['label' => 'Balcón / terraza', 'icon' => 'balcony'],
    'view'         => ['label' => 'Vista panorámica', 'icon' => 'landscape'],
    'living_room'  => ['label' => 'Sala de estar', 'icon' => 'weekend'],
    'butler'       => ['label' => 'Servicio de mayordomo', 'icon' => 'concierge'],
    'accessible'   => ['label' => 'Accesible', 'icon' => 'accessible'],
    'pet_friendly' => ['label' => 'Acepta mascotas', 'icon' => 'pets'],
];
