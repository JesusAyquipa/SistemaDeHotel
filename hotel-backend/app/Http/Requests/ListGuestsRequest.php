<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Parámetros del listado paginado de huéspedes (GET /api/guests).
 */
class ListGuestsRequest extends FormRequest
{
    public const SORTS = ['recent', 'name', 'stays'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:100'],
            'sort'   => ['nullable', 'string', 'in:' . implode(',', self::SORTS)],
            'page'   => ['nullable', 'integer', 'min:1'],
            // SHE-033: filtro por marca del huésped
            'flag'   => ['nullable', 'string', 'in:vip,blacklisted'],
        ];
    }

    public function messages(): array
    {
        return [
            'sort.in'      => 'El orden debe ser: recent, name o stays.',
            'search.max'   => 'La búsqueda no puede superar los 100 caracteres.',
            'page.integer' => 'La página debe ser un número entero.',
            'flag.in'      => 'El filtro debe ser: vip o blacklisted.',
        ];
    }
}
