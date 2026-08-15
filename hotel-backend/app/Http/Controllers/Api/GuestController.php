<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreGuestRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class GuestController extends Controller
{
    /**
     * Guarda un nuevo huésped en la base de datos.
     * 
     * @param StoreGuestRequest $request (La validación ocurre aquí automáticamente)
     * @return JsonResponse
     */
    public function store(StoreGuestRequest $request): JsonResponse
    {
        // Si el flujo llega a este punto, los datos ya pasaron la validación del DNI y Email.
        $validatedData = $request->validated();

        // Crear el registro de usuario
        $user = User::create([
            'name'            => $validatedData['name'],
            'surname'         => $validatedData['surname'],
            'document_type'   => $validatedData['document_type'],
            'document_number' => $validatedData['document_number'],
            'birth_date'      => $validatedData['birth_date'] ?? null,
            'nationality'     => $validatedData['nationality'] ?? null,
            'phone'           => $validatedData['phone'] ?? null,
            'email'           => $validatedData['email'],
            'address'         => $validatedData['address'] ?? null,
            'notes'           => $validatedData['notes'] ?? null,
            // Generar una contraseña aleatoria o usar el documento temporalmente
            'password'        => Hash::make($validatedData['document_number']),
        ]);

        // Retornar respuesta exitosa
        return response()->json([
            'message' => 'Huésped registrado correctamente.',
            'data'    => $user
        ], 201); // 201 Created
    }
}
