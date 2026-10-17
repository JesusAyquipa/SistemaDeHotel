<?php

/*
|--------------------------------------------------------------------------
| Datos del establecimiento
|--------------------------------------------------------------------------
| Usados en correos, comprobantes y folios. Configurables por entorno.
*/

return [
    'name'    => env('HOTEL_NAME', 'Hotel Demo'),
    'ruc'     => env('HOTEL_RUC', '00000000000'),
    'address' => env('HOTEL_ADDRESS', 'Lima, Perú'),
    'phone'   => env('HOTEL_PHONE', '+51 1 000-0000'),
];
