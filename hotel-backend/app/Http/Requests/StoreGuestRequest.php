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
        return true;
    }

    /**
     * Reglas de validación estrictas para el registro de huéspedes.
     */
    public function rules(): array
    {
        $documentRules = ['required', 'string', 'max:50', 'unique:users,document_number'];

        // Validación según el tipo de documento seleccionado
        if ($this->input('document_type') === 'DNI') {
            $documentRules[] = 'regex:/^[0-9]{8}$/';
        } else {
            $documentRules[] = 'regex:/^[a-zA-Z0-9\-]+$/';
        }

        return [
            'name'            => ['required', 'string', 'max:255', 'regex:/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/'],
            'surname'         => ['required', 'string', 'max:255', 'regex:/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/'],
            'document_type'   => ['required', 'string', 'max:50'],
            'document_number' => $documentRules,
            'birth_date'      => ['nullable', 'date', 'before_or_equal:today'],
            'nationality'     => ['nullable', 'string', 'max:100', 'regex:/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$/'],
            'phone'           => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\s\-()]*$/'],
            'email'           => ['required', 'email', 'max:255', 'unique:users,email'],
            'address'         => ['nullable', 'string', 'max:255'],
            'notes'           => ['nullable', 'string'],
        ];
    }
    
    /**
     * Mensajes personalizados para cada regla de validación.
     */
    public function messages(): array
    {
        return [
            'name.required'             => 'El nombre es obligatorio.',
            'name.regex'                => 'El nombre solo debe contener letras y espacios.',
            'surname.required'          => 'Los apellidos son obligatorios.',
            'surname.regex'             => 'Los apellidos solo deben contener letras y espacios.',
            'document_number.required'  => 'El número de documento es obligatorio.',
            'document_number.unique'    => 'Este número de documento ya se encuentra registrado en el sistema.',
            'document_number.regex'     => $this->input('document_type') === 'DNI' 
                                           ? 'El DNI debe contener exactamente 8 dígitos numéricos.' 
                                           : 'El número de documento contiene caracteres no válidos.',
            'birth_date.before_or_equal'=> 'La fecha de nacimiento no puede ser una fecha futura.',
            'birth_date.date'           => 'La fecha de nacimiento debe tener un formato de fecha válido.',
            'nationality.regex'         => 'La nacionalidad solo debe contener letras.',
            'phone.regex'               => 'El número de teléfono solo debe contener números, +, - o espacios.',
            'email.required'            => 'El correo electrónico es obligatorio.',
            'email.email'               => 'Ingrese una dirección de correo electrónico válida.',
            'email.unique'              => 'Este correo electrónico ya está en uso por otro huésped.',
        ];
    }
}
