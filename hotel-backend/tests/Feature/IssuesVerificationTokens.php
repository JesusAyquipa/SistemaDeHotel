<?php

namespace Tests\Feature;

use App\Models\BookingVerification;
use App\Services\BookingVerificationService;
use Illuminate\Support\Str;

/**
 * SHE-026: emite tokens de verificación de correo válidos para las pruebas del checkout público.
 */
trait IssuesVerificationTokens
{
    protected function verificationTokenFor(string $email, int $ttlMinutes = 30): string
    {
        $token = Str::random(64);

        BookingVerification::create([
            'email'            => BookingVerificationService::normalizeEmail($email),
            'token_hash'       => BookingVerificationService::hashToken($token),
            'token_expires_at' => now()->addMinutes($ttlMinutes),
        ]);

        return $token;
    }
}
