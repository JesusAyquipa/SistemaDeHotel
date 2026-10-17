<?php

namespace App\Services;

use App\Models\Booking;
use App\Services\Booking\BookingException;
use App\Services\Booking\GuestResolver;
use Illuminate\Support\Facades\DB;

/**
 * Creación de reservas (walk-in del personal y checkout público) con una sola
 * implementación de: bloqueo de habitación, disponibilidad, capacidad, cupón,
 * precios, resolución de huésped y acompañantes.
 */
class BookingService
{
    public function __construct(
        private BookingAvailabilityService $availability,
        private BookingPricingService $pricing,
        private CouponService $coupons,
        private GuestResolver $guests,
    ) {
    }

    /**
     * @param array         $data        Datos validados (room_id, check_in, check_out, guest_*, document_*, companions, coupon_code)
     * @param bool          $byStaff     true = walk-in del personal (confirmed); false = checkout público (pending_payment)
     * @param callable|null $afterCreate fn(Booking $booking, array $quote): void, ejecutado dentro de la transacción
     * @return array{booking: Booking, quote: array}
     */
    public function create(array $data, bool $byStaff, ?callable $afterCreate = null): array
    {
        return DB::transaction(function () use ($data, $byStaff, $afterCreate) {
            $room = $this->availability->lockRoom((int) $data['room_id']);
            $companions = $data['companions'] ?? [];

            $this->availability->assertBookable($room, $data['check_in'], $data['check_out'], 1 + count($companions));

            $coupon = null;
            if (!empty($data['coupon_code'])) {
                $coupon = $this->coupons->findValid($data['coupon_code']);
                if (!$coupon) {
                    throw new BookingException('El cupón ingresado no es válido, está agotado o ha expirado.', 422);
                }
            }

            $quote = $this->pricing->quote($room, $data['check_in'], $data['check_out'], $coupon?->terms());

            $guest = $byStaff
                ? $this->guests->resolveForStaff($data)
                : $this->guests->resolveForPublic($data);

            $booking = Booking::create([
                'guest_id'        => $guest->id,
                'room_id'         => $room->id,
                'check_in'        => $data['check_in'],
                'check_out'       => $data['check_out'],
                'total_amount'    => $quote['total'],
                'status'          => $byStaff ? Booking::STATUS_CONFIRMED : Booking::STATUS_PENDING_PAYMENT,
                'expires_at'      => $byStaff ? null : now()->addMinutes(Booking::PENDING_TTL_MINUTES),
                'coupon_id'       => $coupon?->id,
                'discount_amount' => $quote['discount'],
                'pricing_details' => $quote,
            ]);

            if (!empty($companions)) {
                $this->guests->attachCompanions($booking, $companions);
            }

            // Reserva confirmada por el personal: el uso del cupón se contabiliza ahora.
            if ($byStaff && $coupon && !$this->coupons->consumeForBooking($booking)) {
                throw new BookingException('El cupón ya no tiene usos disponibles.', 409);
            }

            if ($afterCreate) {
                $afterCreate($booking, $quote);
            }

            return ['booking' => $booking, 'quote' => $quote];
        });
    }

    /**
     * Resumen público de una cotización (respuesta API).
     */
    public static function summary(array $quote): array
    {
        return [
            'nights'            => $quote['nights'],
            'price_per_night'   => $quote['price_per_night'],
            'nightly'           => $quote['nightly'],
            'season_adjustment' => $quote['season_adjustment'],
            'sub_total'         => $quote['subtotal'],
            'discount'          => $quote['discount'],
            'total_amount'      => $quote['total'],
            'igv_included'      => $quote['igv']['amount'],
            'taxable_base'      => $quote['igv']['base'],
            'currency'          => $quote['currency'] ?? 'PEN',
        ];
    }
}
