<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\PingController;
use App\Http\Controllers\Api\GuestController;
use App\Http\Controllers\Api\RoomController;

// Endpoint de prueba de arquitectura /api/ping
Route::get('/ping', [PingController::class, 'ping']);

// Cargar subarchivos de rutas organizadas por módulo en routes/api/
require __DIR__ . '/api/staff.php';

// Registro de huéspedes
Route::post('/guests', [GuestController::class, 'store']);

// Habitaciones: catálogo de disponibilidad con filtros
Route::get('/rooms/available', [RoomController::class, 'available']);

// Ruta protegida de prueba para autenticación Sanctum
Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
