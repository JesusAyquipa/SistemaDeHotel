<?php

namespace App\Services\Booking;

use App\Models\Booking;
use App\Models\BookingCompanion;
use App\Models\Guest;

/**
 * Resolución de la ficha de huésped para reservas.
 * Nunca modifica nombre/email de fichas existentes.
 */
class GuestResolver
{
    private const GENERIC_PUBLIC_ERROR = 'No pudimos validar los datos del huésped. Verifique su documento y correo o contacte a recepción.';

    /**
     * Reservas creadas por el personal: reutiliza la ficha por número de documento.
     * Si el email pertenece a otro huésped -> 422.
     */
    public function resolveForStaff(array $data): Guest
    {
        $guest = Guest::where('document_number', $data['document_number'])->first();
        $emailOwner = Guest::emailIs($data['guest_email'])->first();

        if ($guest) {
            if ($emailOwner && $emailOwner->id !== $guest->id) {
                throw new BookingException('El correo electrónico indicado pertenece a otro huésped registrado.', 422);
            }
            GuestScreening::assertAllowed($guest);
            return $guest;
        }

        if ($emailOwner) {
            throw new BookingException('El correo electrónico indicado pertenece a otro huésped registrado con otro documento.', 422);
        }

        return $this->createGuest($data);
    }

    /**
     * Reservas públicas: nunca modifica fichas existentes. Si el documento existe,
     * solo se usa esa ficha si el email coincide (sin distinguir mayúsculas).
     */
    public function resolveForPublic(array $data): Guest
    {
        $email = mb_strtolower(trim($data['guest_email']));
        $guest = Guest::where('document_number', $data['document_number'])->first();

        if ($guest) {
            if (empty($guest->email) || mb_strtolower($guest->email) !== $email) {
                throw new BookingException(self::GENERIC_PUBLIC_ERROR, 422);
            }
            GuestScreening::assertAllowed($guest);
            return $guest;
        }

        if (Guest::emailIs($email)->exists()) {
            throw new BookingException(self::GENERIC_PUBLIC_ERROR, 422);
        }

        return $this->createGuest($data);
    }

    /**
     * Registra los acompañantes de la reserva y crea fichas de huésped nuevas
     * (sin tocar las existentes) para búsquedas futuras.
     */
    public function attachCompanions(Booking $booking, array $companions): void
    {
        foreach ($companions as $companion) {
            BookingCompanion::create([
                'booking_id'      => $booking->id,
                'name'            => $companion['name'],
                'surname'         => $companion['surname'],
                'document_type'   => $companion['document_type'],
                'document_number' => $companion['document_number'],
                'email'           => $companion['email'] ?? null,
                'phone'           => $companion['phone'] ?? null,
            ]);

            if (empty($companion['document_number'])
                || Guest::where('document_number', $companion['document_number'])->exists()) {
                continue;
            }

            $email = $companion['email'] ?? null;
            if ($email && Guest::emailIs($email)->exists()) {
                $email = null; // el email es único en guests: no duplicar
            }

            Guest::create([
                'name'            => $companion['name'],
                'surname'         => $companion['surname'],
                'document_type'   => $companion['document_type'],
                'document_number' => $companion['document_number'],
                'email'           => $email,
                'phone'           => $companion['phone'] ?? null,
            ]);
        }
    }

    private function createGuest(array $data): Guest
    {
        return Guest::create([
            'name'            => $data['guest_name'],
            'surname'         => $data['guest_surname'],
            'document_type'   => $data['document_type'],
            'document_number' => $data['document_number'],
            'phone'           => $data['guest_phone'] ?? null,
            'email'           => mb_strtolower(trim($data['guest_email'])),
            'notes'           => $data['notes'] ?? null,
        ]);
    }
}
