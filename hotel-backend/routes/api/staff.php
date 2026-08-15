<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\StaffController;

// Rutas de Cuentas de Personal (Recepcionistas, Administradores)
Route::prefix('staff')->group(function () {
    Route::get('/', [StaffController::class, 'index']);
    Route::post('/', [StaffController::class, 'store']);
    Route::get('/{id}', [StaffController::class, 'show']);
    Route::put('/{id}', [StaffController::class, 'update']);
    Route::patch('/{id}/toggle-status', [StaffController::class, 'toggleStatus']);
});
