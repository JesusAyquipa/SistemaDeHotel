<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\RoomController;
use App\Http\Controllers\Api\RoomTypeController;
use App\Http\Controllers\Api\RoomImageController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ReportStatsController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\ReviewController;

/*
|--------------------------------------------------------------------------
| Panel de personal: /api/staff/*
|--------------------------------------------------------------------------
| Todas las rutas requieren token Sanctum. Por defecto se permite a
| admin y recepcionista; las operaciones de administración (CRUD de
| habitaciones, catálogo de productos y cuentas de personal) son solo admin.
|
| IMPORTANTE: las rutas con prefijo fijo (rooms, bookings, reports, products)
| se declaran ANTES que las de cuentas de personal (/{id}), y {id} está
| restringido a números para que no "trague" otras rutas.
*/
Route::prefix('staff')->middleware('auth:sanctum')->group(function () {

    // ── admin | recepcionista ───────────────────────────────────────────
    Route::middleware('role:admin|recepcionista')->group(function () {
        // Inventario y estado de habitaciones (lectura + cambio rápido de estado)
        Route::get('/rooms', [RoomController::class, 'indexStaff']);
        Route::get('/rooms/{id}', [RoomController::class, 'show'])->whereNumber('id');
        Route::patch('/rooms/{id}/status', [RoomController::class, 'updateStatus'])->whereNumber('id');
        // Tipos de habitación (lectura) e imágenes (SHE-034 / SHE-035)
        Route::get('/room-types', [RoomTypeController::class, 'index']);
        Route::get('/room-types/{id}', [RoomTypeController::class, 'show'])->whereNumber('id');
        Route::get('/rooms/{id}/images', [RoomImageController::class, 'index'])->whereNumber('id');

        // Gestión de reservas
        Route::get('/bookings', [BookingController::class, 'indexStaff']);
        Route::get('/bookings/{id}/charges', [BookingController::class, 'getCharges']);
        Route::post('/bookings/{id}/charges', [BookingController::class, 'addCharge']);
        Route::post('/bookings/{id}/pay', [BookingController::class, 'processPayment']);
        Route::post('/bookings/{id}/email-folio', [BookingController::class, 'emailFolio']);
        Route::post('/bookings/{code}/check-in', [BookingController::class, 'checkIn']);
        Route::post('/bookings/{code}/check-out', [BookingController::class, 'checkOut']);

        // Reportes y caja
        Route::get('/reports/dashboard', [ReportController::class, 'dashboard']);
        Route::get('/reports/stats', [ReportStatsController::class, 'stats']);
        Route::post('/reports/close-register', [ReportController::class, 'closeRegister']);

        // Catálogo de productos (lectura)
        Route::get('/products', [ProductController::class, 'index']);
        Route::get('/products/{id}', [ProductController::class, 'show'])->whereNumber('id');
    });

    // ── solo admin ──────────────────────────────────────────────────────
    Route::middleware('role:admin')->group(function () {
        // CRUD de habitaciones
        Route::post('/rooms', [RoomController::class, 'store']);
        Route::put('/rooms/{id}', [RoomController::class, 'update'])->whereNumber('id');
        Route::delete('/rooms/{id}', [RoomController::class, 'destroy'])->whereNumber('id');

        // Tipos de habitación (SHE-034)
        Route::post('/room-types', [RoomTypeController::class, 'store']);
        Route::put('/room-types/{id}', [RoomTypeController::class, 'update'])->whereNumber('id');
        Route::delete('/room-types/{id}', [RoomTypeController::class, 'destroy'])->whereNumber('id');

        // Galería de imágenes de habitaciones (SHE-035)
        Route::post('/rooms/{id}/images', [RoomImageController::class, 'store'])->whereNumber('id');
        Route::patch('/rooms/{id}/images/reorder', [RoomImageController::class, 'reorder'])->whereNumber('id');
        Route::patch('/rooms/{id}/images/{imageId}/primary', [RoomImageController::class, 'setPrimary'])->whereNumber(['id', 'imageId']);
        Route::delete('/rooms/{id}/images/{imageId}', [RoomImageController::class, 'destroy'])->whereNumber(['id', 'imageId']);

        // CRUD del catálogo de productos
        Route::post('/products', [ProductController::class, 'store']);
        Route::put('/products/{id}', [ProductController::class, 'update'])->whereNumber('id');
        Route::delete('/products/{id}', [ProductController::class, 'destroy'])->whereNumber('id');

        // Bitácora de auditoría (SHE-021)
        Route::get('/activity-logs', [ActivityLogController::class, 'index']);
        Route::get('/activity-logs/export', [ActivityLogController::class, 'export']);

        // Moderación de reseñas (SHE-037)
        Route::get('/reviews', [ReviewController::class, 'staffIndex']);
        Route::post('/reviews/{id}/publish', [ReviewController::class, 'publish'])->whereNumber('id');
        Route::post('/reviews/{id}/hide', [ReviewController::class, 'hide'])->whereNumber('id');
        Route::put('/reviews/{id}/reply', [ReviewController::class, 'reply'])->whereNumber('id');

        // Gestión de cuentas de personal (siempre al final)
        Route::get('/', [StaffController::class, 'index']);
        Route::post('/', [StaffController::class, 'store']);
        Route::get('/{id}', [StaffController::class, 'show'])->whereNumber('id');
        Route::put('/{id}', [StaffController::class, 'update'])->whereNumber('id');
        Route::patch('/{id}/toggle-status', [StaffController::class, 'toggleStatus'])->whereNumber('id');
    });
});

/*
|--------------------------------------------------------------------------
| Recepción (front desk) y housekeeping — G2 (SHE-030 / SHE-031 / SHE-032)
|--------------------------------------------------------------------------
*/
Route::prefix('staff')->middleware(['auth:sanctum', 'role:admin|recepcionista'])->group(function () {
    Route::get('/front-desk/rack', [\App\Http\Controllers\Api\FrontDeskController::class, 'rack']);
    Route::get('/front-desk/today', [\App\Http\Controllers\Api\FrontDeskController::class, 'today']);

    Route::prefix('housekeeping')->controller(\App\Http\Controllers\Api\HousekeepingController::class)->group(function () {
        Route::get('/tasks', 'index');
        Route::post('/tasks', 'store');
        Route::patch('/tasks/{id}/assign', 'assign')->whereNumber('id');
        Route::post('/tasks/{id}/start', 'start')->whereNumber('id');
        Route::post('/tasks/{id}/finish', 'finish')->whereNumber('id');
        Route::post('/tasks/{id}/inspect', 'inspect')->whereNumber('id');
    });
});

/*
|--------------------------------------------------------------------------
| Facturación (G1): no-show (SHE-028), comprobantes (SHE-027), reembolsos (SHE-029)
|--------------------------------------------------------------------------
*/
Route::prefix('staff')->middleware('auth:sanctum')->group(function () {
    Route::middleware('role:admin|recepcionista')->group(function () {
        Route::post('/bookings/{code}/no-show', \App\Http\Controllers\Api\NoShowController::class);
        Route::post('/bookings/{id}/invoice', [\App\Http\Controllers\Api\InvoiceController::class, 'store'])->whereNumber('id');
        Route::get('/invoices', [\App\Http\Controllers\Api\InvoiceController::class, 'index']);
    });

    Route::middleware('role:admin')->group(function () {
        Route::post('/invoices/{id}/void', [\App\Http\Controllers\Api\InvoiceController::class, 'void'])->whereNumber('id');

        Route::get('/refunds', [\App\Http\Controllers\Api\RefundController::class, 'index']);
        Route::post('/refunds/{paymentId}/approve', [\App\Http\Controllers\Api\RefundController::class, 'approve'])->whereNumber('paymentId');
        Route::post('/refunds/{paymentId}/reject', [\App\Http\Controllers\Api\RefundController::class, 'reject'])->whereNumber('paymentId');
    });
});
