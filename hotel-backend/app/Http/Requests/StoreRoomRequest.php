<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreRoomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'room_number'     => 'required|string|max:20|unique:rooms,room_number',
            'name'            => 'required|string|max:150',
            'description'     => 'nullable|string|max:1000',
            'bed_type'        => 'required|string|in:individual,doble,king,suite,familiar',
            'capacity'        => 'required|integer|min:1|max:10',
            'size_m2'         => 'nullable|numeric|min:1',
            'price_per_night' => 'required|numeric|min:0',
            'image_url'       => 'nullable|url|max:500',
            'status'          => 'required|string|in:disponible,ocupada,mantenimiento,limpieza,reservada',
        ];
    }

    public function messages(): array
    {
        return [
            'room_number.required' => 'El número de habitación es obligatorio.',
            'room_number.unique'   => 'Ya existe una habitación registrada con este número.',
            'name.required'        => 'El nombre de la habitación es obligatorio.',
            'bed_type.required'    => 'Seleccione el tipo de cama.',
            'capacity.required'    => 'Ingrese la capacidad de huéspedes.',
            'price_per_night.required' => 'Ingrese la tarifa por noche.',
            'status.required'      => 'El estado de la habitación es obligatorio.',
        ];
    }
}
