<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\RoomController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ProductController;

// Rutas de Cuentas de Personal y Gestión de Inventario
Route::prefix('staff')->middleware('auth:sanctum')->group(function () {
    // Gestión de Inventario y Estado de Habitaciones (Recepcionista/Admin)
    Route::get('/rooms', [RoomController::class, 'indexStaff']);
    Route::post('/rooms', [RoomController::class, 'store']);
    Route::get('/rooms/{id}', [RoomController::class, 'show']);
    Route::put('/rooms/{id}', [RoomController::class, 'update']);
    Route::patch('/rooms/{id}/status', [RoomController::class, 'updateStatus']);
    Route::delete('/rooms/{id}', [RoomController::class, 'destroy']);

    // Gestión de Reservas
    Route::get('/bookings', [BookingController::class, 'indexStaff']);
    Route::get('/bookings/{id}/charges', [BookingController::class, 'getCharges']);
    Route::post('/bookings/{id}/charges', [BookingController::class, 'addCharge']);
    Route::post('/bookings/{id}/pay', [BookingController::class, 'processPayment']);
    Route::post('/bookings/{id}/email-folio', [BookingController::class, 'emailFolio']);
    Route::post('/bookings/{code}/check-in', [BookingController::class, 'checkIn']);
    Route::post('/bookings/{code}/check-out', [BookingController::class, 'checkOut']);

    // Gestión de Reportes y Caja
    Route::get('/reports/dashboard', [ReportController::class, 'dashboard']);
    Route::post('/reports/close-register', [ReportController::class, 'closeRegister']);

    // Catálogo de Productos y Servicios Extra (Admin / Staff)
    Route::get('/products', [ProductController::class, 'index'])->middleware('role:admin|recepcionista');
    Route::post('/products', [ProductController::class, 'store'])->middleware('role:admin|recepcionista');
    Route::get('/products/{id}', [ProductController::class, 'show'])->middleware('role:admin|recepcionista');
    Route::put('/products/{id}', [ProductController::class, 'update'])->middleware('role:admin|recepcionista');
    Route::delete('/products/{id}', [ProductController::class, 'destroy'])->middleware('role:admin|recepcionista');

    // Gestión de Cuentas de Personal
    Route::get('/', [StaffController::class, 'index']);
    Route::post('/', [StaffController::class, 'store']);
    Route::get('/{id}', [StaffController::class, 'show']);
    Route::put('/{id}', [StaffController::class, 'update']);
    Route::patch('/{id}/toggle-status', [StaffController::class, 'toggleStatus']);
});


