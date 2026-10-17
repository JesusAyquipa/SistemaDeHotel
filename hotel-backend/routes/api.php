<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\PingController;
use App\Http\Controllers\Api\GuestController;
use App\Http\Controllers\Api\RoomController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PaymentWebhookController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\PublicRoomController;
use App\Http\Controllers\Api\RoomTypeController;
use App\Http\Controllers\Api\GuestPortalController;
use App\Http\Controllers\Api\ReviewController;

/*
|--------------------------------------------------------------------------
| Rutas públicas (sin autenticación) — siempre con rate limiting
|--------------------------------------------------------------------------
*/

// Autenticación
Route::middleware('throttle:10,1')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);
});

Route::middleware('throttle:5,1')->group(function () {
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});

// Validación pública de cupones
Route::post('/coupons/validate', [SettingsController::class, 'validateCoupon'])
    ->middleware('throttle:20,1');

// Endpoint de prueba de arquitectura /api/ping
Route::get('/ping', [PingController::class, 'ping']);

// Habitaciones: catálogo de disponibilidad con filtros
Route::middleware('throttle:60,1')->group(function () {
    Route::get('/rooms/available', [RoomController::class, 'available']);
    Route::get('/rooms/{id}/booked-dates', [RoomController::class, 'bookedDates'])->whereNumber('id');
    // Detalle público de una habitación (SHE-023)
    Route::get('/rooms/{id}', [PublicRoomController::class, 'show'])->whereNumber('id');
    // Tipos de habitación activos para filtros (SHE-034)
    Route::get('/room-types', [RoomTypeController::class, 'publicIndex']);
    // Reseñas publicadas de una habitación (SHE-037)
    Route::get('/rooms/{id}/reviews', [ReviewController::class, 'publicIndex'])->whereNumber('id');
});

// Checkout de huésped (autoservicio) y pago simulado
Route::middleware('throttle:20,1')->group(function () {
    // Crea SIEMPRE una reserva en estado pending_payment
    Route::post('/payments/checkout-intent', [PaymentController::class, 'createCheckoutIntent']);
    // Paga una reserva pendiente existente por booking_code
    Route::post('/payments/process-mock', [PaymentController::class, 'processMockPayment']);
    // Comprobante: dueño/staff autenticado o ?email= del huésped (validado en el controlador)
    Route::get('/bookings/{code}/receipt', [PaymentController::class, 'getReceipt']);
});

// Webhook de la pasarela de pago (firma HMAC obligatoria, validada en el controlador)
Route::post('/webhooks/payment', [PaymentWebhookController::class, 'handleWebhook'])
    ->middleware('throttle:60,1');

/*
|--------------------------------------------------------------------------
| Rutas autenticadas (cualquier rol). La propiedad de la reserva
| (dueño o staff) se valida en el controlador.
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/me/update', [AuthController::class, 'updateProfile'])->middleware('throttle:10,1');
    Route::get('/my-bookings', [BookingController::class, 'myBookings']);

    Route::get('/bookings/{code}', [BookingController::class, 'showByCode']);
    Route::put('/bookings/{code}', [BookingController::class, 'update']);
    Route::post('/bookings/{code}/cancel', [BookingController::class, 'cancel']);

    // Portal del cliente (SHE-036): folio y pre check-in (propiedad validada en el controlador)
    Route::get('/bookings/{code}/folio', [GuestPortalController::class, 'folio']);
    Route::get('/bookings/{code}/pre-check-in', [GuestPortalController::class, 'showPreCheckIn']);
    Route::post('/bookings/{code}/pre-check-in', [GuestPortalController::class, 'storePreCheckIn'])->middleware('throttle:20,1');

    // Reseñas (SHE-037): solo el dueño, reservas checked_out, una vez
    Route::get('/bookings/{code}/review', [ReviewController::class, 'showForBooking']);
    Route::post('/bookings/{code}/review', [ReviewController::class, 'store'])->middleware('throttle:10,1');

    /*
    |----------------------------------------------------------------------
    | Staff (admin | recepcionista)
    |----------------------------------------------------------------------
    */
    Route::middleware('role:admin|recepcionista')->group(function () {
        // Creación de reservas walk-in por recepción
        Route::post('/bookings', [BookingController::class, 'store']);

        // Huéspedes
        Route::get('/guests/search', [GuestController::class, 'search']);
        Route::post('/guests', [GuestController::class, 'store']);
        // Gestión e historial de huéspedes (SHE-024 / SHE-025)
        Route::get('/guests', [GuestController::class, 'index']);
        Route::get('/guests/{id}', [GuestController::class, 'show'])->whereNumber('id');
        Route::put('/guests/{id}', [GuestController::class, 'update'])->whereNumber('id');

        // Configuración (lectura)
        Route::get('/settings', [SettingsController::class, 'index']);
    });

    /*
    |----------------------------------------------------------------------
    | Solo admin: mutaciones de configuración (temporadas y cupones)
    |----------------------------------------------------------------------
    */
    // Solo admin: eliminación de huéspedes sin reservas (SHE-024)
    Route::delete('/guests/{id}', [GuestController::class, 'destroy'])
        ->middleware('role:admin')
        ->whereNumber('id');

    Route::middleware('role:admin')->prefix('settings')->group(function () {
        Route::post('/seasons', [SettingsController::class, 'storeSeason']);
        Route::put('/seasons/{id}', [SettingsController::class, 'updateSeason'])->whereNumber('id');
        Route::delete('/seasons/{id}', [SettingsController::class, 'destroySeason'])->whereNumber('id');

        Route::post('/coupons', [SettingsController::class, 'storeCoupon']);
        Route::put('/coupons/{id}', [SettingsController::class, 'updateCoupon'])->whereNumber('id');
        Route::delete('/coupons/{id}', [SettingsController::class, 'destroyCoupon'])->whereNumber('id');
    });
});

/*
|--------------------------------------------------------------------------
| Facturación (G1): política de cancelación (SHE-028) y comprobantes (SHE-027)
|--------------------------------------------------------------------------
*/
Route::get('/settings/cancellation-policy', [\App\Http\Controllers\Api\CancellationPolicyController::class, 'show'])
    ->middleware('throttle:60,1');

Route::middleware('auth:sanctum')->group(function () {
    // Comprobante vigente de la reserva (dueño o staff; validado en el controlador)
    Route::get('/bookings/{code}/invoice', [\App\Http\Controllers\Api\InvoiceController::class, 'showForBooking']);

    Route::put('/settings/cancellation-policy', [\App\Http\Controllers\Api\CancellationPolicyController::class, 'update'])
        ->middleware('role:admin');
});

// Rutas del panel de personal (/api/staff/*)
require __DIR__ . '/api/staff.php';
