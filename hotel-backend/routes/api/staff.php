<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\RoomController;

// Rutas de Cuentas de Personal y Gestión de Inventario
Route::prefix('staff')->group(function () {
    // Gestión de Inventario y Estado de Habitaciones (Recepcionista/Admin)
    Route::get('/rooms', [RoomController::class, 'indexStaff']);
    Route::post('/rooms', [RoomController::class, 'store']);
    Route::get('/rooms/{id}', [RoomController::class, 'show']);
    Route::put('/rooms/{id}', [RoomController::class, 'update']);
    Route::patch('/rooms/{id}/status', [RoomController::class, 'updateStatus']);
    Route::delete('/rooms/{id}', [RoomController::class, 'destroy']);

    // Gestión de Cuentas de Personal
    Route::get('/', [StaffController::class, 'index']);
    Route::post('/', [StaffController::class, 'store']);
    Route::get('/{id}', [StaffController::class, 'show']);
    Route::put('/{id}', [StaffController::class, 'update']);
    Route::patch('/{id}/toggle-status', [StaffController::class, 'toggleStatus']);
});


