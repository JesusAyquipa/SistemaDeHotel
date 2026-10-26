<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use App\Services\BookingVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * SHE-026: verificación de correo (OTP) para reservas sin cuenta.
 */
class BookingVerificationController extends Controller
{
    public function __construct(private BookingVerificationService $verifications)
    {
    }

    /**
     * POST /api/booking-verification/send
     * Siempre responde 200 con el mismo mensaje (no revela si el correo es válido).
     */
    public function send(Request $request): JsonResponse
    {
        $validator = Validator::make($request->only('email'), [
            'email' => ['required', 'string', 'email', 'max:150'],
        ]);

        if (!$validator->fails()) {
            $this->verifications->sendCode($validator->validated()['email']);
            // Sin el código ni el correo completo en la bitácora.
            ActivityLogger::log('verification_sent', 'Código de verificación de correo enviado (reserva sin cuenta)');
        }

        return response()->json(['message' => 'Si el correo es válido, enviamos un código']);
    }

    /**
     * POST /api/booking-verification/verify
     */
    public function verify(Request $request): JsonResponse
    {
        $validator = Validator::make($request->only(['email', 'code']), [
            'email' => ['required', 'string', 'email', 'max:150'],
            'code'  => ['required', 'string', 'regex:/^\d{6}$/'],
        ]);

        $result = $validator->fails()
            ? null
            : $this->verifications->verifyCode($validator->validated()['email'], $validator->validated()['code']);

        if (!$result) {
            ActivityLogger::log('verification_failed', 'Verificación de correo fallida (reserva sin cuenta)');

            return response()->json(['message' => 'Código inválido o vencido'], 422);
        }

        ActivityLogger::log('verification_succeeded', 'Correo verificado (reserva sin cuenta)');

        return response()->json([
            'verification_token' => $result['token'],
            'expires_at'         => $result['expires_at']->toIso8601String(),
        ]);
    }
}
