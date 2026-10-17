<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Review;
use App\Models\Room;
use App\Services\ActivityLogger;
use App\Services\ReviewModeration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Reseñas de huéspedes (SHE-037).
 */
class ReviewController extends Controller
{
    /**
     * Reseña de la reserva (dueño o personal). 404 si no existe.
     * GET /api/bookings/{code}/review
     */
    public function showForBooking(Request $request, string $code): JsonResponse
    {
        $booking = Booking::with(['guest', 'review'])->where('booking_code', $code)->first();
        if (!$booking || !$booking->isAccessibleBy($request->user()) || !$booking->review) {
            return response()->json(['message' => 'Reseña no encontrada.'], 404);
        }

        return response()->json(['review' => $this->ownerPayload($booking->review)]);
    }

    /**
     * El huésped deja una reseña: solo el dueño, solo reservas checked_out, una vez.
     * POST /api/bookings/{code}/review
     */
    public function store(Request $request, string $code): JsonResponse
    {
        $booking = Booking::with(['guest', 'review'])->where('booking_code', $code)->first();

        if (!$booking || !$booking->isOwnedBy($request->user())) {
            return response()->json(['message' => 'Reserva no encontrada con el código proporcionado.'], 404);
        }

        if ($booking->status !== Booking::STATUS_CHECKED_OUT) {
            return response()->json(['message' => 'Solo puedes dejar una reseña después de finalizar tu estadía.'], 422);
        }

        if ($booking->review) {
            return response()->json(['message' => 'Ya dejaste una reseña para esta reserva.'], 409);
        }

        $validated = $request->validate([
            'rating'  => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['required', 'string', 'min:10', 'max:1000'],
        ], [
            'rating.required'  => 'La calificación es obligatoria.',
            'rating.min'       => 'La calificación debe estar entre 1 y 5 estrellas.',
            'rating.max'       => 'La calificación debe estar entre 1 y 5 estrellas.',
            'comment.required' => 'El comentario es obligatorio.',
            'comment.min'      => 'El comentario debe tener al menos 10 caracteres.',
            'comment.max'      => 'El comentario no puede superar los 1000 caracteres.',
        ]);

        $comment = trim(strip_tags($validated['comment']));
        if (mb_strlen($comment) < 10) {
            throw ValidationException::withMessages(['comment' => ['El comentario debe tener al menos 10 caracteres.']]);
        }
        if (ReviewModeration::containsProfanity($comment)) {
            throw ValidationException::withMessages(['comment' => ['El comentario contiene lenguaje inapropiado. Por favor, reformúlalo.']]);
        }

        try {
            $review = Review::create([
                'booking_id' => $booking->id,
                'room_id'    => $booking->room_id,
                'guest_id'   => $booking->guest_id,
                'rating'     => (int) $validated['rating'],
                'comment'    => $comment,
                'status'     => Review::STATUS_PENDING,
            ]);
        } catch (\Illuminate\Database\UniqueConstraintViolationException) {
            return response()->json(['message' => 'Ya dejaste una reseña para esta reserva.'], 409);
        }

        return response()->json([
            'message' => '¡Gracias por tu reseña! Será publicada tras ser revisada por el hotel.',
            'review'  => $this->ownerPayload($review),
        ], 201);
    }

    /**
     * Reseñas publicadas de una habitación (público, paginado) con resumen.
     * GET /api/rooms/{id}/reviews
     */
    public function publicIndex(Request $request, int $id): JsonResponse
    {
        $room = Room::find($id);
        if (!$room) {
            return response()->json(['message' => 'Habitación no encontrada.'], 404);
        }

        $perPage = min(max((int) $request->query('per_page', 5), 1), 20);

        $paginator = Review::with('guest:id,name,surname')
            ->where('room_id', $room->id)
            ->published()
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        $agg = Review::where('room_id', $room->id)->published()
            ->selectRaw('AVG(rating) as avg_rating, COUNT(*) as total')
            ->first();

        $distribution = Review::where('room_id', $room->id)->published()
            ->selectRaw('rating, COUNT(*) as total')
            ->groupBy('rating')
            ->pluck('total', 'rating');

        return response()->json([
            'summary' => [
                'average'      => $agg && $agg->total > 0 ? round((float) $agg->avg_rating, 1) : null,
                'count'        => (int) ($agg->total ?? 0),
                'distribution' => collect([5, 4, 3, 2, 1])->mapWithKeys(fn ($r) => [$r => (int) ($distribution[$r] ?? 0)]),
            ],
            'data' => collect($paginator->items())->map(fn (Review $r) => [
                'id'          => $r->id,
                'rating'      => $r->rating,
                'comment'     => $r->comment,
                'author'      => $r->authorDisplayName(),
                'staff_reply' => $r->staff_reply,
                'replied_at'  => $r->replied_at?->toIso8601String(),
                'date'        => ($r->published_at ?? $r->created_at)?->toIso8601String(),
            ])->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ],
        ]);
    }

    /**
     * Listado para moderación (admin). Filtros: status, rating, search.
     * GET /api/staff/reviews
     */
    public function staffIndex(Request $request): JsonResponse
    {
        $query = Review::with(['guest:id,name,surname,email', 'room:id,name,room_number', 'booking:id,booking_code,check_in,check_out']);

        if ($request->filled('status') && in_array($request->query('status'), Review::STATUSES, true)) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('rating') && (int) $request->query('rating') >= 1 && (int) $request->query('rating') <= 5) {
            $query->where('rating', (int) $request->query('rating'));
        }

        if ($request->filled('search')) {
            $term = '%' . $request->query('search') . '%';
            $query->where(function ($q) use ($term) {
                $q->where('comment', 'like', $term)
                  ->orWhereHas('booking', fn ($b) => $b->where('booking_code', 'like', $term))
                  ->orWhereHas('guest', fn ($g) => $g->where('name', 'like', $term)->orWhere('surname', 'like', $term));
            });
        }

        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $paginator = $query->orderByDesc('created_at')->orderByDesc('id')->paginate($perPage);

        $counts = Review::selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ],
            'counts' => [
                'pending'   => (int) ($counts[Review::STATUS_PENDING] ?? 0),
                'published' => (int) ($counts[Review::STATUS_PUBLISHED] ?? 0),
                'hidden'    => (int) ($counts[Review::STATUS_HIDDEN] ?? 0),
            ],
        ]);
    }

    /** POST /api/staff/reviews/{id}/publish */
    public function publish(int $id): JsonResponse
    {
        return $this->changeStatus($id, Review::STATUS_PUBLISHED);
    }

    /** POST /api/staff/reviews/{id}/hide */
    public function hide(int $id): JsonResponse
    {
        return $this->changeStatus($id, Review::STATUS_HIDDEN);
    }

    /**
     * Respuesta del hotel a una reseña (vacío elimina la respuesta).
     * PUT /api/staff/reviews/{id}/reply
     */
    public function reply(Request $request, int $id): JsonResponse
    {
        $review = Review::find($id);
        if (!$review) {
            return response()->json(['message' => 'Reseña no encontrada.'], 404);
        }

        $validated = $request->validate([
            'reply' => ['nullable', 'string', 'max:1000'],
        ], [
            'reply.max' => 'La respuesta no puede superar los 1000 caracteres.',
        ]);

        $reply = trim(strip_tags((string) ($validated['reply'] ?? '')));

        $review->update([
            'staff_reply' => $reply !== '' ? $reply : null,
            'replied_at'  => $reply !== '' ? now() : null,
            'replied_by'  => $reply !== '' ? $request->user()->id : null,
        ]);

        return response()->json([
            'message' => $reply !== '' ? 'Respuesta guardada.' : 'Respuesta eliminada.',
            'review'  => $review->fresh(['guest:id,name,surname,email', 'room:id,name,room_number', 'booking:id,booking_code,check_in,check_out']),
        ]);
    }

    private function changeStatus(int $id, string $status): JsonResponse
    {
        $review = Review::find($id);
        if (!$review) {
            return response()->json(['message' => 'Reseña no encontrada.'], 404);
        }

        $review->update([
            'status'       => $status,
            'published_at' => $status === Review::STATUS_PUBLISHED ? ($review->published_at ?? now()) : $review->published_at,
        ]);

        ActivityLogger::log(
            'review_' . $status,
            'Reseña #' . $review->id . ($status === Review::STATUS_PUBLISHED ? ' publicada' : ' ocultada'),
            $review
        );

        return response()->json([
            'message' => $status === Review::STATUS_PUBLISHED ? 'Reseña publicada.' : 'Reseña ocultada.',
            'review'  => $review->fresh(['guest:id,name,surname,email', 'room:id,name,room_number', 'booking:id,booking_code,check_in,check_out']),
        ]);
    }

    private function ownerPayload(Review $review): array
    {
        return [
            'id'          => $review->id,
            'rating'      => $review->rating,
            'comment'     => $review->comment,
            'status'      => $review->status,
            'staff_reply' => $review->staff_reply,
            'created_at'  => $review->created_at?->toIso8601String(),
        ];
    }
}
