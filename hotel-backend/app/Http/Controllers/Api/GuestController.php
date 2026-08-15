<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreGuestRequest;
use App\Models\Guest;
use Illuminate\Http\JsonResponse;

class GuestController extends Controller
{
    /**
     * Guarda un nuevo huésped (Ficha de información) en la base de datos `guests`.
     * 
     * @param StoreGuestRequest $request
     * @return JsonResponse
     */
    public function store(StoreGuestRequest $request): JsonResponse
    {
        $validatedData = $request->validated();

        // Crear el registro directamente en la tabla `guests` sin contraseña
        $guest = Guest::create([
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
        ]);

        return response()->json([
            'message' => 'Huésped registrado correctamente en el sistema.',
            'data'    => $guest
        ], 201);
    }
}
