<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Actualización de la ficha de un huésped (PUT /api/guests/{id}).
 * Email y documento deben ser únicos excluyendo al propio huésped.
 */
class UpdateGuestRequest extends FormRequest
{
    /** Campos de lista negra: solo el administrador puede modificarlos (SHE-033). */
    public const BLACKLIST_FIELDS = ['is_blacklisted', 'blacklist_reason'];

    public function authorize(): bool
    {
        foreach (self::BLACKLIST_FIELDS as $field) {
            if ($this->has($field) && !$this->user()?->hasRole('admin')) {
                return false;
            }
        }

        return true;
    }

    protected function failedAuthorization(): void
    {
        throw new \Illuminate\Auth\Access\AuthorizationException('Solo un administrador puede modificar la lista negra.');
    }

    public function rules(): array
    {
        $guestId = (int) $this->route('id');
        $isDni = $this->input('document_type') === 'DNI';

        return [
            'name'            => ['required', 'string', 'max:255', 'regex:/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/'],
            'surname'         => ['required', 'string', 'max:255', 'regex:/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/'],
            'document_type'   => ['required', 'string', 'max:50'],
            'document_number' => [
                'required', 'string', 'max:50',
                $isDni ? 'regex:/^[0-9]{8}$/' : 'regex:/^[a-zA-Z0-9\-]+$/',
                Rule::unique('guests', 'document_number')->ignore($guestId),
            ],
            'birth_date'      => ['nullable', 'date', 'before_or_equal:today'],
            'nationality'     => ['nullable', 'string', 'max:100', 'regex:/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]*$/'],
            'phone'           => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\s\-()]*$/'],
            'email'           => ['required', 'email', 'max:255', Rule::unique('guests', 'email')->ignore($guestId)],
            'address'         => ['nullable', 'string', 'max:255'],
            'notes'           => ['nullable', 'string', 'max:2000'],
            // SHE-033
            'preferences'     => ['nullable', 'array', 'max:30'],
            'preferences.*'   => ['nullable', 'string', 'max:100'],
            'is_vip'          => ['sometimes', 'boolean'],
            'is_blacklisted'  => ['sometimes', 'boolean'],
            'blacklist_reason' => ['nullable', 'string', 'max:500', 'required_if:is_blacklisted,true,1'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'              => 'El nombre es obligatorio.',
            'name.regex'                 => 'El nombre solo debe contener letras y espacios.',
            'surname.required'           => 'Los apellidos son obligatorios.',
            'surname.regex'              => 'Los apellidos solo deben contener letras y espacios.',
            'document_type.required'     => 'El tipo de documento es obligatorio.',
            'document_number.required'   => 'El número de documento es obligatorio.',
            'document_number.unique'     => 'Este número de documento ya pertenece a otro huésped.',
            'document_number.regex'      => $this->input('document_type') === 'DNI'
                                            ? 'El DNI debe contener exactamente 8 dígitos numéricos.'
                                            : 'El número de documento contiene caracteres no válidos.',
            'birth_date.before_or_equal' => 'La fecha de nacimiento no puede ser una fecha futura.',
            'birth_date.date'            => 'La fecha de nacimiento debe tener un formato de fecha válido.',
            'nationality.regex'          => 'La nacionalidad solo debe contener letras.',
            'phone.regex'                => 'El número de teléfono solo debe contener números, +, - o espacios.',
            'email.required'             => 'El correo electrónico es obligatorio.',
            'email.email'                => 'Ingrese una dirección de correo electrónico válida.',
            'email.unique'               => 'Este correo electrónico ya está en uso por otro huésped.',
            'preferences.array'          => 'Las preferencias deben enviarse como una lista.',
            'preferences.*.max'          => 'Cada preferencia no puede superar los 100 caracteres.',
            'blacklist_reason.required_if' => 'Debe indicar el motivo para incluir al huésped en la lista negra.',
            'blacklist_reason.max'       => 'El motivo no puede superar los 500 caracteres.',
        ];
    }
}
