<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreGuestRequest extends FormRequest
{
    /**
     * Determina si el usuario está autorizado para hacer esta petición.
     */
    public function authorize(): bool
    {
        return true; // Permitir a cualquier usuario (o invitado) registrarse
    }

    /**
     * Reglas de validación estrictas para el registro de huéspedes.
     */
    public function rules(): array
    {
        return [
            'name'            => 'required|string|max:255',
            'surname'         => 'required|string|max:255',
            'document_type'   => 'required|string|max:50',
            'document_number' => 'required|string|max:50|unique:users,document_number',
            'birth_date'      => 'nullable|date',
            'nationality'     => 'nullable|string|max:100',
            'phone'           => 'nullable|string|max:50',
            'email'           => 'required|email|unique:users,email',
            'address'         => 'nullable|string|max:255',
            'notes'           => 'nullable|string',
        ];
    }
    
    /**
     * Mensajes personalizados (opcional).
     */
    public function messages(): array
    {
        return [
            'document_number.unique' => 'Este número de documento ya se encuentra registrado.',
            'document_number.required' => 'El número de documento es obligatorio.',
            'email.unique'           => 'Este correo electrónico ya está en uso.',
        ];
    }
}
