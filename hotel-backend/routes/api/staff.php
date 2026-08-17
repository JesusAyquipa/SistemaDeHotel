<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\StaffController;

// Administración de cuentas de personal.
// Solo usuarios autenticados con rol administrador.
Route::prefix('staff')
    ->middleware(['auth:sanctum', 'role:admin'])
    ->group(function () {
        Route::get('/', [StaffController::class, 'index']);
        Route::post('/', [StaffController::class, 'store']);
        Route::get('/{id}', [StaffController::class, 'show']);
        Route::put('/{id}', [StaffController::class, 'update']);
        Route::patch('/{id}/toggle-status', [StaffController::class, 'toggleStatus']);
    });