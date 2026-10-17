<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RoomType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * SHE-034: tipos de habitación y tarifas por tipo.
 *  - GET    /api/room-types                 (público: tipos activos para filtros)
 *  - GET    /api/staff/room-types           (admin|recepcionista)
 *  - GET    /api/staff/room-types/{id}      (admin|recepcionista)
 *  - POST   /api/staff/room-types           (admin)
 *  - PUT    /api/staff/room-types/{id}      (admin)
 *  - DELETE /api/staff/room-types/{id}      (admin; 409 si tiene habitaciones)
 */
class RoomTypeController extends Controller
{
    public function publicIndex(): JsonResponse
    {
        $types = RoomType::query()
            ->where('active', true)
            ->withCount('rooms')
            ->orderBy('base_price')
            ->orderBy('name')
            ->get()
            ->map(fn (RoomType $type) => [
                'id'          => $type->id,
                'name'        => $type->name,
                'slug'        => $type->slug,
                'description' => $type->description,
                'base_price'  => round((float) $type->base_price, 2),
                'capacity'    => (int) $type->capacity,
                'bed_type'    => $type->bed_type,
                'amenities'   => RoomType::describeAmenities($type->amenities ?? []),
                'rooms_count' => (int) $type->rooms_count,
            ])
            ->values();

        return response()->json(['room_types' => $types]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = RoomType::query()->withCount('rooms')->orderBy('name');

        if ($request->filled('active')) {
            $query->where('active', $request->boolean('active'));
        }

        return response()->json([
            'room_types'       => $query->get(),
            'amenity_catalog'  => $this->amenityCatalog(),
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $type = RoomType::withCount('rooms')->findOrFail($id);

        return response()->json(['room_type' => $type]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['slug'] = $this->uniqueSlug($data['slug'] ?? $data['name']);

        $type = RoomType::create($data);

        return response()->json([
            'message'   => 'Tipo de habitación creado correctamente.',
            'room_type' => $type->loadCount('rooms'),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $type = RoomType::findOrFail($id);
        $data = $this->validated($request, $type);

        if (array_key_exists('slug', $data) || array_key_exists('name', $data)) {
            $source = $data['slug'] ?? (isset($data['name']) && $data['name'] !== $type->name ? $data['name'] : $type->slug);
            $data['slug'] = $this->uniqueSlug($source, $type->id);
        }

        $type->update($data);

        return response()->json([
            'message'   => 'Tipo de habitación actualizado correctamente.',
            'room_type' => $type->fresh()->loadCount('rooms'),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $type = RoomType::withCount('rooms')->findOrFail($id);

        if ($type->rooms_count > 0) {
            return response()->json([
                'message' => "No se puede eliminar el tipo \"{$type->name}\" porque tiene {$type->rooms_count} habitación(es) asignada(s). Reasígnelas o desactive el tipo.",
            ], 409);
        }

        $type->delete();

        return response()->json(['message' => 'Tipo de habitación eliminado correctamente.']);
    }

    private function validated(Request $request, ?RoomType $type = null): array
    {
        $required = $type ? 'sometimes' : 'required';

        return $request->validate([
            'name'        => [$required, 'string', 'max:100', Rule::unique('room_types', 'name')->ignore($type?->id)],
            'slug'        => ['sometimes', 'nullable', 'string', 'max:120', 'regex:/^[a-z0-9-]+$/'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'base_price'  => [$required, 'numeric', 'min:0', 'max:99999999'],
            'capacity'    => [$required, 'integer', 'min:1', 'max:20'],
            'bed_type'    => ['sometimes', 'nullable', 'string', 'max:50'],
            'amenities'   => ['sometimes', 'nullable', 'array'],
            'amenities.*' => ['string', Rule::in(array_keys(config('amenities', [])))],
            'active'      => ['sometimes', 'boolean'],
        ], [
            'name.required'       => 'El nombre del tipo es obligatorio.',
            'name.unique'         => 'Ya existe un tipo de habitación con ese nombre.',
            'base_price.required' => 'Ingrese la tarifa base.',
            'capacity.required'   => 'Ingrese la capacidad.',
            'amenities.*.in'      => 'Comodidad no válida.',
            'slug.regex'          => 'El identificador solo admite minúsculas, números y guiones.',
        ]);
    }

    private function uniqueSlug(string $source, ?int $ignoreId = null): string
    {
        $base = Str::slug($source) ?: 'tipo';
        $slug = $base;
        $i = 2;
        while (RoomType::where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }

    private function amenityCatalog(): array
    {
        return collect(config('amenities', []))
            ->map(fn ($a, $key) => ['key' => $key, 'label' => $a['label'], 'icon' => $a['icon']])
            ->values()
            ->all();
    }
}
