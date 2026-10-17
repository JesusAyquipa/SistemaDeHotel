<?php

namespace App\Support;

/**
 * Validación de documentos de identidad peruanos (DNI, RUC, CE, pasaporte).
 */
class PeruDocument
{
    private const RUC_PREFIXES = ['10', '15', '17', '20'];
    private const RUC_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

    public static function isValidDni(?string $value): bool
    {
        return is_string($value) && preg_match('/^\d{8}$/', $value) === 1;
    }

    /**
     * RUC: 11 dígitos, prefijo 10/15/17/20 y dígito verificador módulo 11.
     */
    public static function isValidRuc(?string $value): bool
    {
        if (!is_string($value) || preg_match('/^\d{11}$/', $value) !== 1) {
            return false;
        }
        if (!in_array(substr($value, 0, 2), self::RUC_PREFIXES, true)) {
            return false;
        }

        $sum = 0;
        foreach (self::RUC_WEIGHTS as $i => $weight) {
            $sum += ((int) $value[$i]) * $weight;
        }
        $check = 11 - ($sum % 11);
        if ($check === 10) {
            $check = 0;
        } elseif ($check === 11) {
            $check = 1;
        }

        return $check === (int) $value[10];
    }

    public static function isValid(string $type, ?string $value): bool
    {
        return match (strtoupper($type)) {
            'DNI'   => self::isValidDni($value),
            'RUC'   => self::isValidRuc($value),
            'CE'    => is_string($value) && preg_match('/^[A-Za-z0-9]{8,12}$/', $value) === 1,
            'PAS'   => is_string($value) && preg_match('/^[A-Za-z0-9]{6,15}$/', $value) === 1,
            default => false,
        };
    }

    public static function message(string $type): string
    {
        return match (strtoupper($type)) {
            'DNI'   => 'El DNI debe tener 8 dígitos.',
            'RUC'   => 'El RUC no es válido (11 dígitos, inicia en 10, 15, 17 o 20 y dígito verificador correcto).',
            'CE'    => 'El carné de extranjería debe tener entre 8 y 12 caracteres alfanuméricos.',
            'PAS'   => 'El pasaporte debe tener entre 6 y 15 caracteres alfanuméricos.',
            default => 'Tipo de documento no válido.',
        };
    }
}
