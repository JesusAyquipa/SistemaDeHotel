<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\PingController;
use App\Http\Controllers\Api\GuestController;

// Endpoint de prueba de arquitectura /api/ping
Route::get('/ping', [PingController::class, 'ping']);

// Cargar rutas del módulo de personal
require __DIR__ . '/api/staff.php';

// Registro de huéspedes
Route::post('/guests', [GuestController::class, 'store']);

// LOGIN
Route::post('/login', function (Request $request) {

    $credentials = $request->validate([
        'email' => ['required', 'email'],
        'password' => ['required'],
    ]);

    // Solo permite iniciar sesión a usuarios activos
    if (! Auth::attempt([
        'email' => $credentials['email'],
        'password' => $credentials['password'],
        'is_active' => true,
    ])) {
        return response()->json([
            'message' => 'Credenciales incorrectas o usuario inactivo.'
        ], 422);
    }

    $request->session()->regenerate();

    return response()->json([
        'message' => 'Inicio de sesión correcto.'
    ]);
});

// LOGOUT
Route::post('/logout', function (Request $request) {

    Auth::guard('web')->logout();

    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return response()->json([
        'message' => 'Sesión cerrada correctamente.'
    ]);

})->middleware('auth:sanctum');

// USUARIO AUTENTICADO + ROLES
Route::get('/user', function (Request $request) {

    $user = $request->user();

    return response()->json([
        'id' => $user->id,
        'name' => $user->name,
        'email' => $user->email,
        'is_active' => $user->is_active,
        'roles' => $user->getRoleNames()->values(),
    ]);

})->middleware('auth:sanctum');