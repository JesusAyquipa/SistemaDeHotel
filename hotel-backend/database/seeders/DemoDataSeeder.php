<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\BookingCompanion;
use App\Models\CashRegisterSession;
use App\Models\Charge;
use App\Models\Coupon;
use App\Models\Guest;
use App\Models\HousekeepingTask;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Review;
use App\Models\Room;
use App\Models\User;
use App\Services\InvoiceService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Datos de demostración para pruebas manuales (SOLO entornos locales).
 *
 * Genera, relativo a la fecha actual:
 *  - Huéspedes (VIP, lista negra, con cuenta de cliente).
 *  - Reservas en todos los estados: checked_out, checked_in, llegadas y salidas de hoy,
 *    futuras, pending_payment, cancelled, no_show y expired.
 *  - Pagos, consumos (cargos), comprobantes, reseñas, tareas de limpieza y una caja abierta.
 *
 * Uso: php artisan db:seed --class=DemoDataSeeder
 * Es idempotente: si ya existen reservas demo (RES-DEMO*), no hace nada.
 */
class DemoDataSeeder extends Seeder
{
    private const CODE_PREFIX = 'RES-DEMO';

    private int $receiptSeq = 0;

    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->error('DemoDataSeeder no se ejecuta en producción.');
            return;
        }

        if (Booking::where('booking_code', 'like', self::CODE_PREFIX . '%')->exists()) {
            $this->command?->warn('Los datos demo ya existen (reservas RES-DEMO*). Omitido.');
            return;
        }

        Model::unguard();

        DB::transaction(function () {
            $admin = User::role('admin')->first();
            $reception = User::role('recepcionista')->first() ?? $admin;

            $clientUsers = $this->seedClientUsers();
            $guests = $this->seedGuests($clientUsers);
            $rooms = Room::all()->keyBy('room_number');
            $session = $this->openCashSession($reception);

            $this->seedBookings($guests, $rooms, $session, $admin);
            $this->seedHousekeeping($rooms, $reception, $admin);
        });

        Model::reguard();

        $this->command?->info('✅ Datos demo generados.');
    }

    // ─────────────────────────────────────────────────────────────────────

    private function seedClientUsers(): array
    {
        $password = env('SEED_CLIENT_PASSWORD') ?: 'Cliente123!';
        $users = [];

        foreach ([
            'cliente1@example.com' => 'Carla Mendoza',
            'cliente2@example.com' => 'Diego Ramírez',
        ] as $email => $name) {
            $user = User::firstOrCreate(
                ['email' => $email],
                ['name' => $name, 'password' => Hash::make($password), 'is_active' => true]
            );
            $user->syncRoles(['cliente']);
            $users[$email] = $user;
        }

        $this->command?->info("Clientes demo: cliente1@example.com / cliente2@example.com (contraseña: {$password})");

        return $users;
    }

    private function seedGuests(array $clientUsers): array
    {
        $data = [
            'carla'   => ['Carla', 'Mendoza Ruiz', 'DNI', '45871236', 'Peruana', '987654321', 'cliente1@example.com', ['user' => 'cliente1@example.com', 'vip' => true, 'prefs' => ['pillow' => 'firme', 'floor' => 'alto']]],
            'diego'   => ['Diego', 'Ramírez Soto', 'DNI', '70123456', 'Peruana', '912345678', 'cliente2@example.com', ['user' => 'cliente2@example.com']],
            'sofia'   => ['Sofía', 'Castillo Vega', 'DNI', '41236587', 'Peruana', '998877665', 'sofia.castillo@example.com', []],
            'john'    => ['John', 'Miller', 'PAS', 'X1234567', 'Estadounidense', '+14155550123', 'john.miller@example.com', ['vip' => true]],
            'ana'     => ['Ana', 'Torres Quispe', 'DNI', '72589631', 'Peruana', '955443322', 'ana.torres@example.com', []],
            'lucas'   => ['Lucas', 'Fernández', 'CE', 'CE0045821', 'Argentina', '944332211', 'lucas.fernandez@example.com', []],
            'maria'   => ['María', 'Gómez Huamán', 'DNI', '40125896', 'Peruana', '933221100', 'maria.gomez@example.com', ['prefs' => ['diet' => 'vegetariana']]],
            'pierre'  => ['Pierre', 'Dubois', 'PAS', 'FR9876543', 'Francesa', '+33612345678', 'pierre.dubois@example.com', []],
            'valeria' => ['Valeria', 'Rojas Paredes', 'DNI', '46985213', 'Peruana', '922110099', 'valeria.rojas@example.com', []],
            'jorge'   => ['Jorge', 'Salazar Díaz', 'DNI', '09876543', 'Peruana', '911009988', 'jorge.salazar@example.com', ['vip' => true]],
            'camila'  => ['Camila', 'Herrera', 'CE', 'CE0078945', 'Colombiana', '900998877', 'camila.herrera@example.com', []],
            'raul'    => ['Raúl', 'Vargas Ccopa', 'DNI', '43215678', 'Peruana', '977665544', 'raul.vargas@example.com', ['blacklist' => 'Daños en la habitación y cuenta impaga (estancia anterior).']],
        ];

        $guests = [];
        foreach ($data as $key => [$name, $surname, $docType, $docNumber, $nationality, $phone, $email, $opts]) {
            $guests[$key] = Guest::updateOrCreate(
                ['document_number' => $docNumber],
                [
                    'name' => $name,
                    'surname' => $surname,
                    'document_type' => $docType,
                    'nationality' => $nationality,
                    'phone' => $phone,
                    'email' => $email,
                    'birth_date' => Carbon::now()->subYears(25 + crc32($key) % 35)->format('Y-m-d'),
                    'user_id' => isset($opts['user']) ? $clientUsers[$opts['user']]->id : null,
                    'preferences' => $opts['prefs'] ?? null,
                    'is_vip' => $opts['vip'] ?? false,
                    'is_blacklisted' => isset($opts['blacklist']),
                    'blacklist_reason' => $opts['blacklist'] ?? null,
                ]
            );
        }

        return $guests;
    }

    private function openCashSession(User $user): CashRegisterSession
    {
        $existing = CashRegisterSession::where('user_id', $user->id)->where('status', 'open')->first();

        return $existing ?? CashRegisterSession::create([
            'user_id' => $user->id,
            'opened_at' => Carbon::today()->setTime(7, 0),
            'opening_amount' => 200.00,
            'status' => 'open',
            'notes' => 'Caja demo (turno mañana)',
        ]);
    }

    /**
     * Reservas por habitación (d = días respecto a hoy). Se evita solapamiento
     * con las reservas demo de DatabaseSeeder (202: +2..+5, 303: hoy..+2).
     */
    private function seedBookings(array $guests, $rooms, CashRegisterSession $session, ?User $admin): void
    {
        $coupon = Coupon::where('code', 'BIENVENIDA20')->first();

        $plan = [
            // room, guest, in, out, status, extra
            ['202', 'pierre',  -40, -36, 'checked_out', ['review' => [5, 'Excelente atención y la habitación impecable. Volveré.', true]]],
            ['202', 'sofia',    -3,  -1, 'checked_out', ['charges' => [['Desayuno Buffet', 2], ['Botella de Vino', 1]], 'invoice' => 'boleta', 'review' => [4, 'Muy cómoda, el desayuno podría tener más variedad.', false]]],
            ['101', 'ana',     -20, -17, 'checked_out', ['charges' => [['Lavado por Pieza', 3]], 'invoice' => 'boleta', 'review' => [4, 'Buena relación calidad-precio.', true]]],
            ['101', 'diego',    -2,  +1, 'checked_in',  ['charges' => [['Coca Cola 500ml', 2], ['Papas Lays', 1]], 'charges_paid_cash_today' => true]],
            ['214', 'raul',    -10,  -8, 'cancelled',   []],
            ['214', 'lucas',    -1,  +3, 'checked_in',  ['charges' => [['Almuerzo Menú', 2], ['Cerveza Local', 3]]]],
            ['214', 'maria',   +10, +14, 'confirmed',   []],
            ['418', 'jorge',   -30, -25, 'checked_out', ['coupon' => true, 'charges' => [['Masaje Relajante (60m)', 1], ['Cena a la Carta', 2]], 'invoice' => 'factura', 'review' => [5, 'Servicio de mayordomo impecable. El mejor hotel de la ciudad.', true, 'Muchas gracias, Sr. Salazar. ¡Lo esperamos pronto!']]],
            ['418', 'john',     -4,  +2, 'checked_in',  ['charges' => [['Transporte al Aeropuerto', 1], ['Desayuno Buffet', 4], ['Sesión Sauna', 1]]]],
            ['108', 'camila',   -6,  -4, 'no_show',     []],
            ['108', 'valeria',  -3,   0, 'checked_in',  ['charges' => [['Café / Té', 3]]]],
            ['115', 'maria',   -15, -12, 'checked_out', ['companions' => 3, 'charges' => [['Cama Adicional', 1]], 'invoice' => 'boleta', 'review' => [3, 'La habitación es amplia pero el aire acondicionado hacía ruido.', false]]],
            ['115', 'carla',     0,  +3, 'confirmed',   ['cash_later' => true, 'companions' => 1]],
            ['115', 'sofia',   +20, +22, 'pending_payment', []],
            ['303', 'valeria', -12,  -9, 'checked_out', ['invoice' => 'boleta']],
            ['303', 'carla',    +7,  +9, 'confirmed',   []],
            ['500', 'john',    -25, -22, 'checked_out', ['charges' => [['Botella de Vino', 2], ['Late Check-out', 1]], 'invoice' => 'factura']],
            ['500', 'jorge',   +30, +33, 'confirmed',   ['coupon' => true]],
            ['500', 'diego',   +40, +42, 'expired',     []],
        ];

        $n = 0;
        foreach ($plan as [$roomNumber, $guestKey, $in, $out, $status, $extra]) {
            $room = $rooms[$roomNumber] ?? null;
            if (!$room) {
                continue;
            }
            $n++;
            $booking = $this->createBooking($n, $room, $guests[$guestKey], $in, $out, $status, $extra, $coupon);
            $this->createPayments($booking, $status, $in, $extra);

            if (!empty($extra['companions'])) {
                $this->createCompanions($booking, $extra['companions']);
            }
            if (!empty($extra['charges'])) {
                $this->createCharges($booking, $extra['charges'], $in, $out, $status, $extra, $session);
            }
            if (!empty($extra['invoice']) && $admin) {
                $this->createInvoice($booking, $guests[$guestKey], $extra['invoice'], $admin);
            }
            if (!empty($extra['review'])) {
                $this->createReview($booking, $extra['review'], $out, $admin);
            }
        }

        // Estado físico de las habitaciones acorde a las reservas.
        foreach (['101', '214', '418', '108'] as $number) {
            $rooms[$number]?->update(['status' => Room::STATUS_OCCUPIED]);
        }
        $rooms['202']?->update(['status' => Room::STATUS_CLEANING]);
    }

    private function createBooking(int $n, Room $room, Guest $guest, int $in, int $out, string $status, array $extra, ?Coupon $coupon): Booking
    {
        $checkIn = Carbon::today()->addDays($in);
        $nights = $out - $in;
        $nightly = (float) $room->effective_price; // precio del tipo de habitación (o el propio)
        $subtotal = round($nightly * $nights, 2);

        $discount = 0;
        $couponId = null;
        if (!empty($extra['coupon']) && $coupon) {
            $discount = $coupon->discount_type === 'percentage'
                ? round($subtotal * $coupon->discount_value / 100, 2)
                : (float) $coupon->discount_value;
            $couponId = $coupon->id;
        }

        $createdAt = $checkIn->copy()->subDays(in_array($status, ['pending_payment', 'expired']) ? 0 : 10)->setTime(10, 30);
        if ($status === 'pending_payment') {
            $createdAt = Carbon::now()->subMinutes(5);
        } elseif ($status === 'expired') {
            $createdAt = Carbon::now()->subDays(2);
        }

        return Booking::create([
            'booking_code' => sprintf('%s%04d', self::CODE_PREFIX, $n),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'check_in' => $checkIn->format('Y-m-d'),
            'check_out' => Carbon::today()->addDays($out)->format('Y-m-d'),
            'total_amount' => $subtotal - $discount,
            'status' => $status,
            'expires_at' => match ($status) {
                'pending_payment' => Carbon::now()->addMinutes(25),
                'expired' => $createdAt->copy()->addMinutes(30),
                default => null,
            },
            'coupon_id' => $couponId,
            'discount_amount' => $discount,
            'coupon_counted' => (bool) $couponId,
            'pricing_details' => [
                'nights' => $nights,
                'base_price' => $nightly,
                'subtotal' => $subtotal,
                'discount_amount' => $discount,
                'total' => $subtotal - $discount,
            ],
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);
    }

    private function createPayments(Booking $booking, string $status, int $in, array $extra): void
    {
        $paidAt = Carbon::parse($booking->created_at)->addMinutes(3);

        [$paymentStatus, $method] = match (true) {
            $status === 'pending_payment' => ['pending', 'card'],
            $status === 'expired' => ['failed', 'card'],
            $status === 'cancelled' => ['refunded', 'card'],
            !empty($extra['cash_later']) => ['pending', 'cash_later'],
            default => ['completed', 'card'],
        };

        if ($paymentStatus === 'failed') {
            return; // la reserva caducó sin que llegara a pagarse
        }

        $this->payment($booking, (float) $booking->total_amount, $method, $paymentStatus,
            $paymentStatus === 'completed' || $paymentStatus === 'refunded' ? $paidAt : null,
            ['reconciled' => $status === 'checked_out']);
    }

    private function createCharges(Booking $booking, array $items, int $in, int $out, string $status, array $extra, CashRegisterSession $session): void
    {
        $sum = 0;
        $i = 0;
        foreach ($items as [$productName, $qty]) {
            $product = Product::where('name', $productName)->first();
            if (!$product) {
                continue;
            }
            // Un consumo por día de estancia, sin pasar de la última noche ni (si sigue alojado) de hoy.
            $day = min($in + $i, $out - 1);
            if ($status === 'checked_in') {
                $day = min($day, 0);
            }
            $total = round($product->price * $qty, 2);
            $sum += $total;
            $i++;

            Charge::create([
                'booking_id' => $booking->id,
                'product_id' => $product->id,
                'date' => Carbon::today()->addDays($day)->format('Y-m-d'),
                'concept' => $product->name,
                'quantity' => $qty,
                'unit_price' => $product->price,
                'total' => $total,
            ]);
        }

        if ($sum <= 0) {
            return;
        }

        if ($status === 'checked_out') {
            // Consumos liquidados en efectivo al hacer el check-out.
            $this->payment($booking, $sum, 'cash', 'completed', Carbon::today()->addDays($out)->setTime(11, 15), ['reconciled' => true]);
        } elseif (!empty($extra['charges_paid_cash_today'])) {
            // Consumos pagados hoy en recepción: entran en la caja abierta.
            $this->payment($booking, $sum, 'cash', 'completed', Carbon::now()->subHour(), ['session' => $session->id]);
        }
        // Resto de huéspedes alojados: consumos pendientes en el folio.
    }

    private function payment(Booking $booking, float $amount, string $method, string $status, ?Carbon $paidAt, array $opts = []): Payment
    {
        $this->receiptSeq++;
        $isCard = $method === 'card';

        return Payment::create([
            'booking_id' => $booking->id,
            'amount' => $amount,
            'payment_method' => $method,
            'status' => $status,
            'paid_at' => $paidAt,
            'transaction_id' => $isCard ? 'sim_demo_' . str_pad((string) $this->receiptSeq, 6, '0', STR_PAD_LEFT) : null,
            'gateway_provider' => $isCard ? 'simulation' : 'manual',
            'currency' => 'PEN',
            'receipt_number' => $status === 'completed' || $status === 'refunded'
                ? sprintf('REC-%s-DEMO%04d', ($paidAt ?? now())->format('Ym'), $this->receiptSeq)
                : null,
            'payment_details' => $isCard
                ? ['brand' => ['visa', 'mastercard', 'amex'][$this->receiptSeq % 3], 'last4' => (string) (4242 + $this->receiptSeq), 'demo' => true]
                : ['demo' => true],
            'is_reconciled' => $opts['reconciled'] ?? false,
            'cash_register_session_id' => $opts['session'] ?? null,
            'created_at' => $paidAt ?? $booking->created_at,
            'updated_at' => $paidAt ?? $booking->created_at,
        ]);
    }

    private function createCompanions(Booking $booking, int $count): void
    {
        $people = [
            ['Pedro', 'Gómez Huamán', 'DNI', '71234590'],
            ['Lucía', 'Gómez Huamán', 'DNI', '78945612'],
            ['Tomás', 'Gómez Huamán', 'DNI', '79856321'],
        ];
        foreach (array_slice($people, 0, $count) as [$name, $surname, $docType, $doc]) {
            BookingCompanion::create([
                'booking_id' => $booking->id,
                'name' => $name,
                'surname' => $surname,
                'document_type' => $docType,
                'document_number' => $doc,
            ]);
        }
    }

    private function createInvoice(Booking $booking, Guest $guest, string $type, User $admin): void
    {
        $data = $type === 'factura'
            ? ['type' => 'factura', 'customer_doc_type' => 'RUC', 'customer_doc_number' => '20601234567',
               'customer_name' => 'Consultora Andina S.A.C.', 'customer_address' => 'Av. Javier Prado Este 1234, San Isidro, Lima']
            : ['type' => 'boleta', 'customer_doc_type' => $guest->document_type === 'PAS' ? 'PAS' : $guest->document_type,
               'customer_doc_number' => $guest->document_number, 'customer_name' => "{$guest->name} {$guest->surname}"];

        try {
            app(InvoiceService::class)->issue($booking->fresh(), $data, $admin);
        } catch (\Throwable $e) {
            $this->command?->warn("No se pudo emitir comprobante para {$booking->booking_code}: {$e->getMessage()}");
        }
    }

    private function createReview(Booking $booking, array $review, int $out, ?User $admin): void
    {
        [$rating, $comment, $published] = $review;
        $reply = $review[3] ?? null;
        $at = Carbon::today()->addDays($out)->setTime(18, 0);

        Review::create([
            'booking_id' => $booking->id,
            'room_id' => $booking->room_id,
            'guest_id' => $booking->guest_id,
            'rating' => $rating,
            'comment' => $comment,
            'status' => $published ? Review::STATUS_PUBLISHED : Review::STATUS_PENDING,
            'published_at' => $published ? $at->copy()->addDay() : null,
            'staff_reply' => $reply,
            'replied_at' => $reply ? $at->copy()->addDays(2) : null,
            'replied_by' => $reply ? $admin?->id : null,
            'created_at' => $at,
            'updated_at' => $at,
        ]);
    }

    private function seedHousekeeping($rooms, User $reception, ?User $admin): void
    {
        $lastCheckout = Booking::where('booking_code', 'like', self::CODE_PREFIX . '%')
            ->where('room_id', $rooms['202']->id ?? 0)
            ->where('status', 'checked_out')
            ->latest('check_out')
            ->first();

        $tasks = [
            ['202', 'cleaning', 'pending', 'Limpieza tras check-out.', $lastCheckout?->id],
            ['303', 'cleaning', 'in_progress', 'Preparar para llegada de hoy.', null],
            ['500', 'maintenance', 'pending', 'Revisar grifería del baño principal.', null],
            ['101', 'inspection', 'done', 'Inspección de minibar.', null],
            ['214', 'cleaning', 'inspected', 'Limpieza diaria.', null],
        ];

        foreach ($tasks as [$number, $type, $status, $notes, $bookingId]) {
            $room = $rooms[$number] ?? null;
            if (!$room) {
                continue;
            }
            $started = in_array($status, ['in_progress', 'done', 'inspected']) ? Carbon::now()->subHours(2) : null;
            $finished = in_array($status, ['done', 'inspected']) ? Carbon::now()->subHour() : null;

            HousekeepingTask::create([
                'room_id' => $room->id,
                'assigned_to' => $reception->id,
                'type' => $type,
                'status' => $status,
                'notes' => $notes,
                'created_by' => $admin?->id ?? $reception->id,
                'booking_id' => $bookingId,
                'started_at' => $started,
                'finished_at' => $finished,
                'inspected_by' => $status === 'inspected' ? $admin?->id : null,
                'inspected_at' => $status === 'inspected' ? Carbon::now()->subMinutes(30) : null,
            ]);
        }
    }
}
