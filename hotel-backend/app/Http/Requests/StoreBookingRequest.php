<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreBookingRequest extends FormRequest
{
    /**
     * Determina si el usuario está autorizado para hacer esta petición.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Reglas de validación para la creación de una reserva.
     */
    public function rules(): array
    {
        $documentRules = ['required', 'string', 'max:50'];

        if ($this->input('guest_document_type') === 'DNI' || $this->input('document_type') === 'DNI') {
            $documentRules[] = 'regex:/^[0-9]{8}$/';
        }

        return [
            'room_id'         => ['required', 'exists:rooms,id'],
            'check_in'        => ['required', 'date', 'after_or_equal:today'],
            'check_out'       => ['required', 'date', 'after:check_in'],
            'guest_name'      => ['required', 'string', 'max:255'],
            'guest_surname'   => ['required', 'string', 'max:255'],
            'guest_email'     => ['required', 'email', 'max:255'],
            'document_type'   => ['required', 'string', 'max:50'],
            'document_number' => $documentRules,
            'guest_phone'     => ['nullable', 'string', 'max:20'],
            'notes'           => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * Mensajes de error personalizados en español.
     */
    public function messages(): array
    {
        return [
            'room_id.required'         => 'Debe seleccionar una habitación válida.',
            'room_id.exists'           => 'La habitación seleccionada no existe.',
            'check_in.required'        => 'La fecha de check-in es obligatoria.',
            'check_in.after_or_equal'  => 'La fecha de check-in no puede ser anterior a hoy.',
            'check_out.required'       => 'La fecha de check-out es obligatoria.',
            'check_out.after'          => 'La fecha de check-out debe ser posterior a la de check-in.',
            'guest_name.required'      => 'El nombre del huésped es obligatorio.',
            'guest_surname.required'   => 'Los apellidos del huésped son obligatorios.',
            'guest_email.required'     => 'El correo electrónico es obligatorio.',
            'guest_email.email'        => 'Ingrese un correo electrónico válido.',
            'document_type.required'   => 'El tipo de documento es obligatorio.',
            'document_number.required' => 'El número de documento es obligatorio.',
            'document_number.regex'    => 'El DNI debe tener exactamente 8 dígitos numéricos.',
        ];
    }
}
