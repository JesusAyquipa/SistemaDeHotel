<?php

namespace App\Services;

use App\Mail\BookingVerificationCodeMail;
use App\Models\BookingVerification;
use App\Services\Booking\BookingException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Verificación de correo (OTP) para reservas sin cuenta (SHE-026).
 *
 * - Código de 6 dígitos, guardado como HMAC (ligado al correo), vence en 10 min, máx. 5 intentos.
 * - Token de verificación: 64 caracteres aleatorios, guardado como SHA-256, vale 30 min,
 *   ligado al correo y de un solo uso (se consume al crear la reserva).
 * - NUNCA se registra el código ni el token (ni en logs ni en la bitácora).
 */
class BookingVerificationService
{
    public const CODE_TTL_MINUTES  = 10;
    public const TOKEN_TTL_MINUTES = 30;
    public const MAX_ATTEMPTS      = 5;

    public static function normalizeEmail(string $email): string
    {
        return mb_strtolower(trim($email));
    }

    public static function hashCode(string $email, string $code): string
    {
        return hash_hmac('sha256', self::normalizeEmail($email) . '|' . $code, (string) config('app.key'));
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /**
     * Genera y envía un código nuevo (invalida los anteriores sin usar de ese correo).
     */
    public function sendCode(string $email): void
    {
        $email = self::normalizeEmail($email);
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::transaction(function () use ($email, $code) {
            // Solo códigos pendientes: un token ya verificado (aún sin consumir) no se destruye.
            BookingVerification::where('email', $email)->whereNull('consumed_at')->whereNull('token_hash')->delete();

            BookingVerification::create([
                'email'           => $email,
                'code_hash'       => self::hashCode($email, $code),
                'code_expires_at' => now()->addMinutes(self::CODE_TTL_MINUTES),
                'attempts'        => 0,
            ]);
        });

        Mail::to($email)->send(new BookingVerificationCodeMail($code, self::CODE_TTL_MINUTES));
    }

    /**
     * Valida el código. Devuelve [token, expires_at] o null si es inválido/vencido/agotado.
     *
     * @return array{token: string, expires_at: \Illuminate\Support\Carbon}|null
     */
    public function verifyCode(string $email, string $code): ?array
    {
        $email = self::normalizeEmail($email);

        return DB::transaction(function () use ($email, $code) {
            $record = BookingVerification::where('email', $email)
                ->whereNotNull('code_hash')
                ->whereNull('token_hash')
                ->whereNull('consumed_at')
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if (!$record || !$record->code_expires_at || $record->code_expires_at->isPast()
                || $record->attempts >= self::MAX_ATTEMPTS) {
                return null;
            }

            // El intento se cuenta SIEMPRE, acierte o no.
            $record->attempts = $record->attempts + 1;

            if (!hash_equals($record->code_hash, self::hashCode($email, $code))) {
                $record->save();

                return null;
            }

            $token = Str::random(64);
            $expiresAt = now()->addMinutes(self::TOKEN_TTL_MINUTES);
            $record->forceFill([
                'code_hash'        => null,
                'code_expires_at'  => null,
                'token_hash'       => self::hashToken($token),
                'token_expires_at' => $expiresAt,
            ])->save();

            return ['token' => $token, 'expires_at' => $expiresAt];
        });
    }

    /**
     * Comprueba que el token es válido, no consumido y pertenece al correo. No lo consume.
     *
     * @throws BookingException 422 con requires_verification
     */
    public function assertValid(?string $token, string $email): BookingVerification
    {
        $record = null;
        if (is_string($token) && strlen($token) === 64) {
            $record = BookingVerification::where('token_hash', self::hashToken($token))->first();
        }

        if (!$record
            || $record->consumed_at !== null
            || !$record->token_expires_at
            || $record->token_expires_at->isPast()
            || $record->email !== self::normalizeEmail($email)) {
            throw new BookingException('Verifica tu correo para continuar', 422, ['requires_verification' => true]);
        }

        return $record;
    }

    /**
     * Consume el token de forma atómica (un solo uso). Llamar dentro de la transacción de la reserva.
     *
     * @throws BookingException si ya fue consumido (carrera)
     */
    public function consume(BookingVerification $record): void
    {
        $updated = BookingVerification::whereKey($record->id)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => now()]);

        if ($updated !== 1) {
            throw new BookingException('Verifica tu correo para continuar', 422, ['requires_verification' => true]);
        }
    }
}
