<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class PingController extends Controller
{
    /**
     * Endpoint de prueba para verificar conectividad entre Frontend (React) y Backend (Laravel API).
     */
    public function ping(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'message' => '¡Conexión exitosa entre Laravel API REST y React SPA!',
            'timestamp' => now()->toDateTimeString(),
            'app_name' => config('app.name'),
            'environment' => config('app.env'),
            'roles_configured' => ['admin', 'recepcionista', 'cliente'],
        ]);
    }
}
