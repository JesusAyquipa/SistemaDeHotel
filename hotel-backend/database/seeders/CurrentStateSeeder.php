<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

/**
 * Estado base del catálogo: roles, habitaciones, cupones y temporadas.
 * No contiene usuarios ni datos personales: las cuentas demo se crean en
 * DatabaseSeeder a partir de variables de entorno.
 */
class CurrentStateSeeder extends Seeder
{
    public function run(): void
    {
        // ── Roles ────────────────────────────────────────────
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
        foreach (['admin', 'recepcionista', 'cliente'] as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }
        $this->command->info('Roles insertados.');

        // ── Rooms ────────────────────────────────────────────
        $now = '2026-09-22 08:12:56';
        $rooms = [
            // Piso 1
            [
                'room_number'    => '101',
                'name'           => 'Habitación Individual Clásica',
                'description'    => 'Acogedora habitación individual con vista al jardín interior. Decoración clásica con detalles en madera de caoba, cama individual con ropa de cama de lino y escritorio de correspondencia.',
                'bed_type'       => 'individual',
                'capacity'       => 1,
                'size_m2'        => 22,
                'price_per_night'=> 180.00,
                'image_url'      => '/images/rooms/photo-1590490360182-c33d57733427.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '102',
                'name'           => 'Habitación Individual Jardín',
                'description'    => 'Acogedora habitación individual con acceso directo al jardín botánico interior. Cuenta con cama de plaza y media, escritorio de caoba y abundante luz natural.',
                'bed_type'       => 'individual',
                'capacity'       => 1,
                'size_m2'        => 24,
                'price_per_night'=> 180.00,
                'image_url'      => '/images/rooms/photo-1631049307264-da0ec9d70304.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '103',
                'name'           => 'Habitación Individual Estándar',
                'description'    => 'Cómoda habitación pensada para estancias cortas. Equipada con cama individual, baño privado con ducha española y estación de té y café.',
                'bed_type'       => 'individual',
                'capacity'       => 1,
                'size_m2'        => 21,
                'price_per_night'=> 180.00,
                'image_url'      => '/images/rooms/photo-1505693416388-ac5ce068fe85.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '104',
                'name'           => 'Habitación Individual Ejecutiva Plus',
                'description'    => 'Habitación individual con espacio de trabajo ergonómico, internet de fibra simétrica, minibar y excelente aislamiento acústico.',
                'bed_type'       => 'individual',
                'capacity'       => 1,
                'size_m2'        => 26,
                'price_per_night'=> 200.00,
                'image_url'      => '/images/rooms/photo-1595526114035-0d45ed16cfbf.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '105',
                'name'           => 'Habitación Familiar Colonial',
                'description'    => 'Amplia habitación familiar equipada con dos camas dobles de alta gama, zona de estar con sofá y amplio baño con doble lavabo.',
                'bed_type'       => 'doble',
                'capacity'       => 4,
                'size_m2'        => 54,
                'price_per_night'=> 360.00,
                'image_url'      => '/images/rooms/photo-1596394516093-501ba68a0ba6.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '106',
                'name'           => 'Habitación Familiar Jardín Terraza',
                'description'    => 'Estancia familiar en planta baja con terraza privada hacia los jardines del hotel. Dos camas dobles, frigobar surtido y juegos de mesa.',
                'bed_type'       => 'doble',
                'capacity'       => 4,
                'size_m2'        => 58,
                'price_per_night'=> 380.00,
                'image_url'      => '/images/rooms/photo-1566195992011-5f6b21e539aa.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '108',
                'name'           => 'Habitación Individual Ejecutiva',
                'description'    => 'Habitación individual con todos los servicios ejecutivos. Escritorio amplio, Wi-Fi de alta velocidad, minibar y vistas al jardín interior. Ideal para viajeros de negocios.',
                'bed_type'       => 'individual',
                'capacity'       => 1,
                'size_m2'        => 28,
                'price_per_night'=> 220.00,
                'image_url'      => '/images/rooms/photo-1590490359683-658d3d23f972.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '115',
                'name'           => 'Habitación Familiar Doble',
                'description'    => 'Espaciosa habitación familiar con dos camas dobles, ideal para familias o grupos pequeños. Amplio baño y zona de estar independiente.',
                'bed_type'       => 'doble',
                'capacity'       => 4,
                'size_m2'        => 55,
                'price_per_night'=> 360.00,
                'image_url'      => '/images/rooms/photo-1587985064135-0366536eab42.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],

            // Piso 2
            [
                'room_number'    => '201',
                'name'           => 'Habitación Doble Balcón Clásico',
                'description'    => 'Habitación con encanto histórico y balcón francés con vista a la calle colonial. Cama queen, muebles de roble y detalles de bronce.',
                'bed_type'       => 'doble',
                'capacity'       => 2,
                'size_m2'        => 36,
                'price_per_night'=> 280.00,
                'image_url'      => '/images/rooms/photo-1566665797739-1674de7a421a.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '202',
                'name'           => 'Suite Doble Patrimonio',
                'description'    => 'Nuestra habitación doble estándar ofrece una experiencia excepcional. Presenta cortinas de lino grueso, accesorios de latón y una mesa de escritura artesanal para correspondencia.',
                'bed_type'       => 'doble',
                'capacity'       => 2,
                'size_m2'        => 38,
                'price_per_night'=> 280.00,
                'image_url'      => '/images/rooms/photo-1591088398332-8a7791972843.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '203',
                'name'           => 'Habitación Doble Superior',
                'description'    => 'Elegante habitación doble con techos altos y vigas de madera a la vista. Baño moderno revestido en piedra natural y ducha de lluvia.',
                'bed_type'       => 'doble',
                'capacity'       => 2,
                'size_m2'        => 35,
                'price_per_night'=> 280.00,
                'image_url'      => '/images/rooms/photo-1598928506311-c55ded91a20c.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '204',
                'name'           => 'Habitación Doble Vista Patio',
                'description'    => 'Espacio sereno y silencioso con vista al patio de fuentes central. Decoración minimalista cálida con textiles artesanales.',
                'bed_type'       => 'doble',
                'capacity'       => 2,
                'size_m2'        => 34,
                'price_per_night'=> 280.00,
                'image_url'      => '/images/rooms/photo-1616486338812-3dadae4b4ace.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '205',
                'name'           => 'Habitación Doble Ejecutiva',
                'description'    => 'Diseñada para parejas o viajeros de negocios que buscan amplitud adicional, con sala de lectura y minibar premium.',
                'bed_type'       => 'doble',
                'capacity'       => 2,
                'size_m2'        => 39,
                'price_per_night'=> 300.00,
                'image_url'      => '/images/rooms/photo-1578683010236-d716f9a3f461.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '214',
                'name'           => 'Habitación Doble Deluxe',
                'description'    => 'Habitación doble de lujo con vista a la plaza central. Cama king size, minibar y acceso al salón privado de huéspedes en el tercer piso.',
                'bed_type'       => 'king',
                'capacity'       => 2,
                'size_m2'        => 45,
                'price_per_night'=> 320.00,
                'image_url'      => '/images/rooms/photo-1582719478250-c89cae4dc85b.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],

            // Piso 3
            [
                'room_number'    => '301',
                'name'           => 'Deluxe King Terraza',
                'description'    => 'Amplia habitación con cama King Size y terraza privada amueblada para disfrutar el atardecer. Baño en suite con acabados en travertino.',
                'bed_type'       => 'king',
                'capacity'       => 2,
                'size_m2'        => 48,
                'price_per_night'=> 320.00,
                'image_url'      => '/images/rooms/photo-1611892440504-42a792e24d32.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '302',
                'name'           => 'Deluxe King Vista Panorámica',
                'description'    => 'Ventanales de piso a techo con vistas despejadas a la ciudad histórica. Cama King con sábanas de 400 hilos y cafetera Nespresso.',
                'bed_type'       => 'king',
                'capacity'       => 2,
                'size_m2'        => 50,
                'price_per_night'=> 340.00,
                'image_url'      => '/images/rooms/photo-1540518614846-7ede433c4ef4.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '303',
                'name'           => 'Suite Embajador',
                'description'    => 'Amplia suite de esquina con vistas panorámicas. Incluye sala de estar separada con escritorio, molduras originales de 1894 y baño de mármol con bañera de patas.',
                'bed_type'       => 'king',
                'capacity'       => 2,
                'size_m2'        => 79,
                'price_per_night'=> 450.00,
                'image_url'      => '/images/rooms/photo-1631049552057-403cdb8f0658.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '304',
                'name'           => 'Deluxe King Clásica Imperial',
                'description'    => 'Sofisticada habitación Deluxe con cama king y cabecero tapizado a mano, amplio vestidor y baño de diseño contemporáneo.',
                'bed_type'       => 'king',
                'capacity'       => 2,
                'size_m2'        => 46,
                'price_per_night'=> 320.00,
                'image_url'      => '/images/rooms/photo-1618773928121-c32242e63f39.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '305',
                'name'           => 'Suite Junior Colonial',
                'description'    => 'Suite espaciosa con antesala independiente, chimenea decorativa restaurada, sofá chaise longue y tina de inmersión profunda.',
                'bed_type'       => 'king',
                'capacity'       => 2,
                'size_m2'        => 66,
                'price_per_night'=> 450.00,
                'image_url'      => '/images/rooms/photo-1591825729269-caeb344f6df2.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],

            // Piso 4
            [
                'room_number'    => '401',
                'name'           => 'Suite Presidencial Menor',
                'description'    => 'Exclusiva suite de alto nivel con comedor para cuatro personas, salón de reuniones privado y amenidades de baño de diseñador.',
                'bed_type'       => 'king',
                'capacity'       => 2,
                'size_m2'        => 82,
                'price_per_night'=> 480.00,
                'image_url'      => '/images/rooms/photo-1613553507747-5f8d62ad5904.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '402',
                'name'           => 'Deluxe King Alta Gama',
                'description'    => 'Habitación Deluxe ubicada en el cuarto piso con iluminación inteligente, cama King ortopédica y ducha efecto lluvia.',
                'bed_type'       => 'king',
                'capacity'       => 2,
                'size_m2'        => 52,
                'price_per_night'=> 330.00,
                'image_url'      => '/images/rooms/photo-1590490360182-c33d57733427.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '403',
                'name'           => 'Suite Imperial con Hidromasaje',
                'description'    => 'Lujo supremo con jacuzzi hidromasaje integrado en suite, cava de vinos climatizada y vista privilegiada a la ciudad.',
                'bed_type'       => 'king',
                'capacity'       => 2,
                'size_m2'        => 88,
                'price_per_night'=> 500.00,
                'image_url'      => '/images/rooms/photo-1578683010236-d716f9a3f461.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '418',
                'name'           => 'Junior Suite Ejecutiva',
                'description'    => 'Suite junior con zona de trabajo profesional, cama king y vistas al jardín. Incluye servicio de mayordomo y acceso prioritario al business center.',
                'bed_type'       => 'king',
                'capacity'       => 2,
                'size_m2'        => 62,
                'price_per_night'=> 520.00,
                'image_url'      => '/images/rooms/photo-1582719478250-c89cae4dc85b.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],

            // Piso 5
            [
                'room_number'    => '500',
                'name'           => 'El Penthouse del Fundador',
                'description'    => 'La cima de nuestra oferta. Ocupa todo el piso superior con biblioteca privada, comedor formal y terraza perimetral con vistas a la plaza de la ciudad.',
                'bed_type'       => 'king',
                'capacity'       => 4,
                'size_m2'        => 195,
                'price_per_night'=> 1200.00,
                'image_url'      => '/images/rooms/photo-1502672260266-1c1ef2d93688.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'room_number'    => '501',
                'name'           => 'Grand Penthouse Royal Terraza',
                'description'    => 'Magnífico penthouse en el último piso con terraza panorámica de 40 m², zona lounge privada, dos dormitorios y servicio de mayordomo exclusivo.',
                'bed_type'       => 'king',
                'capacity'       => 4,
                'size_m2'        => 175,
                'price_per_night'=> 1100.00,
                'image_url'      => '/images/rooms/photo-1600585154340-be6161a56a0c.jpg',
                'status'         => 'disponible',
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
        ];

        DB::table('rooms')->upsert(
            $rooms,
            ['room_number'],
            ['name', 'description', 'bed_type', 'capacity', 'size_m2', 'price_per_night', 'image_url']
        );
        $this->command->info(count($rooms) . ' habitaciones insertadas/actualizadas.');
        $this->command->info('Habitaciones insertadas.');

        // ── Coupons ──────────────────────────────────────────
        DB::table('coupons')->upsert([
            ['id' => 1, 'code' => 'BIENVENIDA20', 'discount_type' => 'percentage', 'discount_value' => 20.00, 'expires_at' => '2027-12-31', 'max_uses' => 100, 'current_uses' => 1, 'is_active' => 1, 'created_at' => '2026-10-05 04:35:02', 'updated_at' => '2026-10-05 04:56:55'],
            ['id' => 2, 'code' => 'DESC50FIJO',   'discount_type' => 'fixed',      'discount_value' => 50.00, 'expires_at' => '2027-12-31', 'max_uses' => 50,  'current_uses' => 0, 'is_active' => 1, 'created_at' => '2026-10-05 04:35:02', 'updated_at' => '2026-10-05 04:35:02'],
            ['id' => 3, 'code' => 'VERANOVIP',    'discount_type' => 'percentage', 'discount_value' => 15.00, 'expires_at' => '2027-03-31', 'max_uses' => 200, 'current_uses' => 0, 'is_active' => 1, 'created_at' => '2026-10-05 04:35:02', 'updated_at' => '2026-10-05 04:35:02'],
        ], ['id'], ['code', 'discount_value']);
        $this->command->info('Cupones insertados.');

        // ── Seasons ──────────────────────────────────────────
        DB::table('seasons')->upsert([
            ['id' => 1, 'name' => 'Verano 2027',       'start_date' => '2027-01-01', 'end_date' => '2027-03-31', 'rate_adjustment' => 20.00, 'is_active' => 1, 'created_at' => '2026-10-05 04:35:02', 'updated_at' => '2026-10-05 04:35:02'],
            ['id' => 2, 'name' => 'Semana Santa 2027', 'start_date' => '2027-04-10', 'end_date' => '2027-04-17', 'rate_adjustment' => 50.00, 'is_active' => 1, 'created_at' => '2026-10-05 04:35:02', 'updated_at' => '2026-10-05 04:35:02'],
            ['id' => 3, 'name' => 'Fiestas Patrias 2027','start_date' => '2027-07-25', 'end_date' => '2027-07-31', 'rate_adjustment' => 35.00, 'is_active' => 1, 'created_at' => '2026-10-05 04:35:02', 'updated_at' => '2026-10-05 04:35:02'],
        ], ['id'], ['name']);
        $this->command->info('Temporadas insertadas.');

        $this->command->info('✅ Seed completado exitosamente.');
    }
}
