<?php

namespace App\Services\Payment;

/**
 * Validación de datos de tarjeta (sin almacenarlos ni registrarlos en logs).
 */
class CardValidator
{
    public static function normalizeNumber(string $number): string
    {
        return preg_replace('/[\s\-]/', '', $number) ?? '';
    }

    public static function luhnValid(string $number): bool
    {
        $digits = self::normalizeNumber($number);
        if (!preg_match('/^\d{13,19}$/', $digits)) {
            return false;
        }

        $sum = 0;
        $alt = false;
        for ($i = strlen($digits) - 1; $i >= 0; $i--) {
            $n = (int) $digits[$i];
            if ($alt) {
                $n *= 2;
                if ($n > 9) {
                    $n -= 9;
                }
            }
            $sum += $n;
            $alt = !$alt;
        }

        return $sum % 10 === 0;
    }

    /**
     * MM/YY vigente: la tarjeta es válida hasta el último día del mes indicado.
     */
    public static function expiryValid(string $expiry): bool
    {
        if (!preg_match('/^(\d{2})\/(\d{2})$/', trim($expiry), $m)) {
            return false;
        }

        $month = (int) $m[1];
        $year = 2000 + (int) $m[2];
        if ($month < 1 || $month > 12) {
            return false;
        }

        $endOfMonth = \Carbon\Carbon::create($year, $month, 1)->endOfMonth();

        return $endOfMonth->gte(now());
    }

    public static function cvcValid(string $cvc): bool
    {
        return (bool) preg_match('/^\d{3,4}$/', trim($cvc));
    }

    /**
     * Devuelve errores por campo (vacío si todo es válido).
     */
    public static function errors(?string $number, ?string $expiry, ?string $cvc): array
    {
        $errors = [];
        if (!self::luhnValid((string) $number)) {
            $errors['card_number'] = ['El número de tarjeta no es válido.'];
        }
        if (!self::expiryValid((string) $expiry)) {
            $errors['card_expiry'] = ['La tarjeta está vencida o la fecha es inválida (MM/YY).'];
        }
        if (!self::cvcValid((string) $cvc)) {
            $errors['card_cvc'] = ['El CVC debe tener 3 o 4 dígitos.'];
        }

        return $errors;
    }
}
