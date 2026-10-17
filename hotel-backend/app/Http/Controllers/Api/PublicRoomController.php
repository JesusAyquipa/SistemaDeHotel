<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\Season;
use App\Services\BookingPricingService;
use Illuminate\Http\JsonResponse;

/**
 * Detalle público de una habitación (SHE-023).
 * Solo expone campos de catálogo; nunca reservas, huéspedes ni estados internos.
 */
class PublicRoomController extends Controller
{
    /**
     * Comodidades por defecto (claves de config/amenities.php) SOLO para habitaciones
     * sin tipo ni extras asignados (datos heredados). Las demás usan datos reales (SHE-035).
     */
    private const LEGACY_AMENITY_KEYS = [
        'individual' => ['wifi', 'tv', 'ac', 'bath', 'safe', 'room_service'],
        'doble'      => ['wifi', 'tv', 'ac', 'bath', 'safe', 'room_service', 'minibar'],
        'king'       => ['wifi', 'tv', 'ac', 'bath', 'safe', 'room_service', 'minibar', 'coffee', 'bathrobe'],
    ];

    private const TYPE_LABELS = [
        'individual' => 'Individual',
        'doble'      => 'Doble',
        'king'       => 'King',
    ];

    /** Máximo de temporadas próximas a devolver. */
    private const UPCOMING_SEASONS_LIMIT = 5;

    public function __construct(private readonly BookingPricingService $pricing)
    {
    }

    /**
     * GET /api/rooms/{id}
     */
    public function show(int $id): JsonResponse
    {
        $room = Room::query()
            ->whereNotIn('status', Room::UNBOOKABLE_STATUSES)
            ->with(['roomType', 'images'])
            ->find($id);

        if (!$room) {
            return response()->json(['message' => 'Habitación no encontrada.'], 404);
        }

        $today = now()->startOfDay();
        $quote = $this->pricing->quote($room, $today->toDateString(), $today->copy()->addDay()->toDateString());
        $tonight = $quote['nightly'][0] ?? null;

        // Precio efectivo (override ?? tarifa base del tipo): regla única en Room
        $basePrice = $room->effective_price;

        $upcomingSeasons = Season::query()
            ->where('is_active', true)
            ->forRoomType($room->room_type_id ? (int) $room->room_type_id : null)
            ->whereDate('end_date', '>=', $today->toDateString())
            ->orderBy('start_date')
            ->limit(self::UPCOMING_SEASONS_LIMIT)
            ->get()
            ->map(fn (Season $season) => [
                'name'               => $season->name,
                'start_date'         => $season->start_date?->toDateString(),
                'end_date'           => $season->end_date?->toDateString(),
                'adjustment_percent' => (float) $season->rate_adjustment,
                'price_per_night'    => max(0, round($basePrice * (1 + (float) $season->rate_adjustment / 100), 2)),
            ])
            ->values();

        // SHE-037: resumen de reseñas publicadas (una sola consulta agregada)
        $ratings = \App\Models\Review::where('room_id', $room->id)->published()
            ->selectRaw('AVG(rating) as rating_avg, COUNT(*) as reviews_count')
            ->first();

        return response()->json([
            'room' => [
                'id'                 => $room->id,
                'room_number'        => $room->room_number,
                'name'               => $room->name,
                'type'               => $room->roomType?->slug ?? $room->bed_type,
                'type_label'         => $room->roomType?->name ?? (self::TYPE_LABELS[$room->bed_type] ?? ucfirst((string) $room->bed_type)),
                'room_type'          => $room->roomType ? [
                    'id'          => $room->roomType->id,
                    'name'        => $room->roomType->name,
                    'slug'        => $room->roomType->slug,
                    'description' => $room->roomType->description,
                    'base_price'  => round((float) $room->roomType->base_price, 2),
                ] : null,
                'bed_type'           => $room->bed_type,
                'description'        => $room->description,
                'capacity'           => (int) $room->capacity,
                'size_m2'            => $room->size_m2 !== null ? (int) $room->size_m2 : null,
                'price_per_night'    => $basePrice,
                'season_price_today' => [
                    'date'               => $today->toDateString(),
                    'price'              => $tonight['price'] ?? $basePrice,
                    'season'             => $tonight['season'] ?? null,
                    'adjustment_percent' => (float) ($tonight['adjustment_percent'] ?? 0),
                ],
                'upcoming_seasons'   => $upcomingSeasons,
                'prices_include_igv' => true,
                'igv_rate'           => BookingPricingService::IGV_RATE,
                'currency'           => 'PEN',
                'amenities'          => $this->amenities($room),
                'images'             => $this->images($room),
                'is_bookable'        => true,
                'rating_avg'         => ($ratings->reviews_count ?? 0) > 0 ? round((float) $ratings->rating_avg, 1) : null,
                'reviews_count'      => (int) ($ratings->reviews_count ?? 0),
            ],
        ]);
    }

    private function amenities(Room $room): array
    {
        $keys = $room->amenityKeys();
        if (!$room->roomType && empty($keys)) {
            $keys = self::LEGACY_AMENITY_KEYS[$room->bed_type] ?? self::LEGACY_AMENITY_KEYS['individual'];
        }

        return RoomType::describeAmenities($keys);
    }

    /**
     * Galería (principal primero). Si no hay imágenes cargadas se usa rooms.image_url.
     */
    private function images(Room $room): array
    {
        $images = $room->images
            ->map(fn ($image) => [
                'id'         => $image->id,
                'url'        => $this->absoluteUrl($image->url),
                'alt'        => $room->name,
                'is_primary' => (bool) $image->is_primary,
            ])
            ->values()
            ->all();

        if (!empty($images) || empty($room->image_url)) {
            return $images;
        }

        return [['url' => $this->absoluteUrl((string) $room->image_url), 'alt' => $room->name, 'is_primary' => true]];
    }

    private function absoluteUrl(string $url): string
    {
        if (!preg_match('#^https?://#i', $url)) {
            $url = url('/' . ltrim($url, '/'));
        }

        return $url;
    }
}
