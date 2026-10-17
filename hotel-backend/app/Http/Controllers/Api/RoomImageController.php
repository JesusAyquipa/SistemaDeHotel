<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\RoomImage;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * SHE-035: galería de imágenes por habitación (disco `public`, nombres aleatorios).
 *  - GET    /api/staff/rooms/{id}/images                     (admin|recepcionista)
 *  - POST   /api/staff/rooms/{id}/images                     (admin) images[] o image
 *  - PATCH  /api/staff/rooms/{id}/images/reorder             (admin) {order: [imageId...]}
 *  - PATCH  /api/staff/rooms/{id}/images/{imageId}/primary   (admin)
 *  - DELETE /api/staff/rooms/{id}/images/{imageId}           (admin)
 *
 * rooms.image_url se sincroniza con la imagen principal (compatibilidad).
 */
class RoomImageController extends Controller
{
    public const MAX_IMAGES = 20;

    /** Prefijo de las rutas gestionadas por la galería (para no pisar URLs externas). */
    private const GALLERY_PREFIX = '/storage/rooms/';

    public function index(int $id): JsonResponse
    {
        $room = Room::findOrFail($id);

        return response()->json(['images' => $room->images()->get()]);
    }

    public function store(Request $request, int $id): JsonResponse
    {
        $room = Room::findOrFail($id);

        $request->validate([
            'images'   => ['required_without:image', 'array', 'max:10'],
            'images.*' => ['file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'image'    => ['required_without:images', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ], [
            'images.required_without' => 'Seleccione al menos una imagen.',
            'image.required_without'  => 'Seleccione al menos una imagen.',
            'images.*.mimes'          => 'Formato no permitido (jpg, jpeg, png o webp).',
            'images.*.max'            => 'Cada imagen debe pesar como máximo 4 MB.',
            'image.mimes'             => 'Formato no permitido (jpg, jpeg, png o webp).',
            'image.max'               => 'La imagen debe pesar como máximo 4 MB.',
        ]);

        $files = $request->file('images') ?: [$request->file('image')];
        $files = array_values(array_filter($files));

        $existing = $room->images()->count();
        if ($existing + count($files) > self::MAX_IMAGES) {
            return response()->json([
                'message' => 'Se permite un máximo de ' . self::MAX_IMAGES . ' imágenes por habitación.',
            ], 422);
        }

        $nextOrder = (int) RoomImage::where('room_id', $room->id)->max('sort_order') + 1;
        $created = [];
        foreach ($files as $file) {
            // store() genera un nombre aleatorio (hash), nunca el nombre original
            $path = $file->store('rooms', 'public');
            $created[] = RoomImage::create([
                'room_id'    => $room->id,
                'path'       => $path,
                'sort_order' => $nextOrder++,
                'is_primary' => false,
            ]);
        }

        $this->syncPrimary($room);

        ActivityLogger::log('updated', "Habitación {$room->room_number}: " . count($created) . ' imagen(es) agregada(s)', $room);

        return response()->json([
            'message' => count($created) === 1 ? 'Imagen subida correctamente.' : 'Imágenes subidas correctamente.',
            'images'  => $room->images()->get(),
        ], 201);
    }

    public function reorder(Request $request, int $id): JsonResponse
    {
        $room = Room::findOrFail($id);

        $validated = $request->validate([
            'order'   => ['required', 'array', 'min:1'],
            'order.*' => ['integer', 'distinct'],
        ], [
            'order.required' => 'Indique el nuevo orden de las imágenes.',
        ]);

        $ids = array_map('intval', $validated['order']);
        $owned = RoomImage::where('room_id', $room->id)->pluck('id')->all();
        sort($owned);
        $sorted = $ids;
        sort($sorted);

        if ($sorted !== $owned) {
            return response()->json([
                'message' => 'El orden debe incluir exactamente las imágenes de la habitación.',
            ], 422);
        }

        DB::transaction(function () use ($ids) {
            foreach ($ids as $position => $imageId) {
                RoomImage::whereKey($imageId)->update(['sort_order' => $position + 1]);
            }
        });

        return response()->json([
            'message' => 'Orden de imágenes actualizado.',
            'images'  => $room->images()->get(),
        ]);
    }

    public function setPrimary(int $id, int $imageId): JsonResponse
    {
        $room = Room::findOrFail($id);
        $image = RoomImage::where('room_id', $room->id)->findOrFail($imageId);

        DB::transaction(function () use ($room, $image) {
            RoomImage::where('room_id', $room->id)->update(['is_primary' => false]);
            $image->update(['is_primary' => true]);
        });

        $this->syncPrimary($room);

        return response()->json([
            'message' => 'Imagen principal actualizada.',
            'images'  => $room->images()->get(),
        ]);
    }

    public function destroy(int $id, int $imageId): JsonResponse
    {
        $room = Room::findOrFail($id);
        $image = RoomImage::where('room_id', $room->id)->findOrFail($imageId);

        Storage::disk('public')->delete($image->path);
        $image->delete();

        $this->syncPrimary($room);

        ActivityLogger::log('updated', "Habitación {$room->room_number}: imagen eliminada", $room);

        return response()->json([
            'message' => 'Imagen eliminada.',
            'images'  => $room->images()->get(),
        ]);
    }

    /**
     * Garantiza una única imagen principal y refleja su ruta en rooms.image_url.
     */
    private function syncPrimary(Room $room): void
    {
        $images = RoomImage::where('room_id', $room->id)->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id')->get();
        $room->refresh();

        if ($images->isEmpty()) {
            if ($room->image_url && str_starts_with($room->image_url, self::GALLERY_PREFIX)) {
                Room::withoutActivityLogging(fn () => $room->update(['image_url' => null]));
            }

            return;
        }

        $primary = $images->first();
        if (!$primary->is_primary) {
            $primary->update(['is_primary' => true]);
        }
        RoomImage::where('room_id', $room->id)->whereKeyNot($primary->id)->where('is_primary', true)->update(['is_primary' => false]);

        if ($room->image_url !== $primary->url) {
            Room::withoutActivityLogging(fn () => $room->update(['image_url' => $primary->url]));
        }
    }
}
