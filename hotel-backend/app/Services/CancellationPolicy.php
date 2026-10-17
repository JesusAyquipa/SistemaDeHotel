<?php

namespace App\Services;

use App\Models\Setting;

/**
 * Política de cancelación y no-show configurable (SHE-028).
 * Se guarda en la tabla settings bajo la clave `cancellation_policy`.
 */
class CancellationPolicy
{
    public const KEY = 'cancellation_policy';

    public const DEFAULTS = [
        'free_cancellation_hours'          => 48,
        'late_cancellation_penalty_nights' => 1,
        'no_show_penalty_nights'           => 1,
        'no_show_grace_hours'              => 2,
    ];

    public const RULES = [
        'free_cancellation_hours'          => ['required', 'integer', 'min:0', 'max:720'],
        'late_cancellation_penalty_nights' => ['required', 'integer', 'min:0', 'max:30'],
        'no_show_penalty_nights'           => ['required', 'integer', 'min:0', 'max:30'],
        'no_show_grace_hours'              => ['required', 'integer', 'min:0', 'max:48'],
    ];

    public static function current(): array
    {
        $stored = [];
        try {
            $stored = Setting::getValue(self::KEY, []) ?? [];
        } catch (\Throwable $e) {
            report($e); // tabla aún no migrada: valores por defecto
        }

        $policy = [];
        foreach (self::DEFAULTS as $key => $default) {
            $policy[$key] = isset($stored[$key]) ? (int) $stored[$key] : $default;
        }

        return $policy;
    }

    public static function update(array $values): array
    {
        $policy = array_merge(self::current(), array_intersect_key($values, self::DEFAULTS));
        $policy = array_map('intval', $policy);
        Setting::setValue(self::KEY, $policy);

        return $policy;
    }
}
