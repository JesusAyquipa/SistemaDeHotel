<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Registro de eventos en la bitácora de auditoría.
 *
 * Un fallo al registrar NUNCA debe romper la petición: los errores se reportan
 * (report()) y se ignoran.
 */
class ActivityLogger
{
    /** Atributos que jamás se guardan en la bitácora. */
    public const SENSITIVE_KEYS = [
        'password',
        'remember_token',
        'token',
        'tokens',
        'access_token',
        'api_token',
        'cvc',
        'cvv',
        'payment_details',
    ];

    /**
     * @param string     $action      created|updated|deleted|login|logout|check_in|...
     * @param string     $description Texto legible (en español)
     * @param Model|null $subject     Entidad afectada
     * @param array|null $changes     ['old' => [...], 'new' => [...]] u otros datos de contexto
     * @param User|null  $user        Autor; por defecto el usuario autenticado
     */
    public static function log(string $action, string $description, ?Model $subject = null, ?array $changes = null, ?User $user = null): ?ActivityLog
    {
        try {
            $user ??= auth()->user();
            $request = app()->bound('request') ? request() : null;
            $userAgent = $request?->userAgent();

            return ActivityLog::create([
                'user_id'      => $user?->getKey(),
                'action'       => Str::limit($action, 50, ''),
                'subject_type' => $subject ? class_basename($subject) : null,
                'subject_id'   => $subject?->getKey(),
                'description'  => Str::limit($description, 495),
                'changes'      => $changes ? self::sanitize($changes) : null,
                'ip_address'   => $request?->ip(),
                'user_agent'   => $userAgent ? Str::limit($userAgent, 255, '') : null,
            ]);
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }

    /**
     * Elimina recursivamente las claves sensibles.
     */
    public static function sanitize(array $data): array
    {
        $clean = [];
        foreach ($data as $key => $value) {
            if (is_string($key) && self::isSensitive($key)) {
                continue;
            }
            $clean[$key] = is_array($value) ? self::sanitize($value) : $value;
        }

        return $clean;
    }

    public static function isSensitive(string $key): bool
    {
        $key = strtolower($key);

        return in_array($key, self::SENSITIVE_KEYS, true)
            || str_starts_with($key, 'card_')
            || str_contains($key, 'password')
            || str_ends_with($key, '_token');
    }
}
