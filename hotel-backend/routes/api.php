<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\PingController;
use App\Http\Controllers\Api\GuestController;
use App\Http\Controllers\Api\RoomController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PaymentWebhookController;

// Endpoint de prueba de arquitectura /api/ping
Route::get('/ping', [PingController::class, 'ping']);

// Cargar subarchivos de rutas organizadas por módulo en routes/api/
require __DIR__ . '/api/staff.php';

// Registro de huéspedes
Route::post('/guests', [GuestController::class, 'store']);

// Habitaciones: catálogo de disponibilidad con filtros
Route::get('/rooms/available', [RoomController::class, 'available']);

// Reservas de habitaciones para huéspedes
Route::post('/bookings', [BookingController::class, 'store']);
Route::get('/bookings/{code}', [BookingController::class, 'showByCode']);

// ============================================================
// Módulo de Pagos y Checkout Seguro
// ============================================================

// Crear intención de pago (checkout)
Route::post('/payments/checkout-intent', [PaymentController::class, 'createCheckoutIntent']);

// Procesar pago simulado (solo disponible con gateway=simulation)
Route::post('/payments/process-mock', [PaymentController::class, 'processMockPayment']);

// Obtener comprobante de pago de una reserva confirmada
Route::get('/bookings/{code}/receipt', [PaymentController::class, 'getReceipt']);

// Webhook de la pasarela de pago (sin CSRF, sin auth)
Route::post('/webhooks/payment', [PaymentWebhookController::class, 'handleWebhook']);

// Ruta protegida de prueba para autenticación Sanctum
Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

