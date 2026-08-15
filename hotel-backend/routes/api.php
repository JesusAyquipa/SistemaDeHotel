<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\PingController;

// Endpoint de prueba de arquitectura /api/ping
Route::get('/ping', [PingController::class, 'ping']);

// Cargar subarchivos de rutas organizadas por módulo en routes/api/
require __DIR__ . '/api/staff.php';

// Ruta protegida de prueba para autenticación Sanctum
Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
