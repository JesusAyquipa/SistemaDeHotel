<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreRoomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Con multipart/form-data, extra_amenities puede llegar como JSON string.
     */
    protected function prepareForValidation(): void
    {
        $extra = $this->input('extra_amenities');
        if (is_string($extra)) {
            $decoded = json_decode($extra, true);
            $this->merge(['extra_amenities' => is_array($decoded) ? $decoded : []]);
        }
    }

    public function rules(): array
    {
        return [
            'room_number'     => 'required|string|max:20|unique:rooms,room_number',
            'name'            => 'required|string|max:150',
            'description'     => 'nullable|string|max:1000',
            // SHE-034: con tipo de habitación, bed_type se toma del tipo si no se envía
            'room_type_id'    => 'nullable|integer|exists:room_types,id',
            'bed_type'        => 'required_without:room_type_id|nullable|string|in:individual,doble,king,suite,familiar',
            'capacity'        => 'required|integer|min:1|max:10',
            'size_m2'         => 'nullable|numeric|min:1',
            // Override opcional: precio efectivo = override ?? tarifa base del tipo
            'price_per_night' => 'required_without:room_type_id|nullable|numeric|min:0',
            // SHE-035: comodidades extra de la habitación (claves de config/amenities.php)
            'extra_amenities'   => 'nullable|array',
            'extra_amenities.*' => ['string', \Illuminate\Validation\Rule::in(array_keys(config('amenities', [])))],
            'image_url'       => 'nullable|url:http,https|max:500',
            'image'           => 'nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
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
            'price_per_night.required_without' => 'Ingrese la tarifa por noche o seleccione un tipo de habitación.',
            'bed_type.required_without' => 'Seleccione el tipo de cama o un tipo de habitación.',
            'room_type_id.exists'  => 'El tipo de habitación seleccionado no existe.',
            'status.required'      => 'El estado de la habitación es obligatorio.',
        ];
    }
}
