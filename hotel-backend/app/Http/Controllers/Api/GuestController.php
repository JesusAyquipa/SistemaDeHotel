<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListGuestsRequest;
use App\Http\Requests\StoreGuestRequest;
use App\Http\Requests\UpdateGuestRequest;
use App\Models\Booking;
use App\Models\Guest;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GuestController extends Controller
{
    /**
     * Guarda un nuevo huésped (Ficha de información) en la base de datos `guests`.
     * 
     * @param StoreGuestRequest $request
     * @return JsonResponse
     */
    public function store(StoreGuestRequest $request): JsonResponse
    {
        $validatedData = $request->validated();

        // Crear el registro directamente en la tabla `guests` sin contraseña
        $guest = Guest::create([
            'name'            => $validatedData['name'],
            'surname'         => $validatedData['surname'],
            'document_type'   => $validatedData['document_type'],
            'document_number' => $validatedData['document_number'],
            'birth_date'      => $validatedData['birth_date'] ?? null,
            'nationality'     => $validatedData['nationality'] ?? null,
            'phone'           => $validatedData['phone'] ?? null,
            'email'           => $validatedData['email'],
            'address'         => $validatedData['address'] ?? null,
            'notes'           => $validatedData['notes'] ?? null,
        ]);

        return response()->json([
            'message' => 'Huésped registrado correctamente en el sistema.',
            'data'    => $guest
        ], 201);
    }

    /**
     * Busca huéspedes por número de documento, nombre, apellido o correo.
     * GET /api/guests/search?query=...   (solo staff)
     *
     * Requiere al menos 2 caracteres y devuelve como máximo 10 resultados con
     * los campos mínimos que necesita el panel de recepción.
     */
    public function search(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('query', ''));

        if (mb_strlen($query) < 2) {
            return response()->json([]);
        }

        $query = mb_substr($query, 0, 100);
        // Escapar comodines de LIKE para que no amplíen la búsqueda
        $like = '%' . addcslashes($query, '%_\\') . '%';

        $guests = Guest::query()
            ->where(function ($q) use ($like) {
                $q->where('document_number', 'LIKE', $like)
                  ->orWhere('name', 'LIKE', $like)
                  ->orWhere('surname', 'LIKE', $like)
                  ->orWhere('email', 'LIKE', $like);
            })
            ->orderBy('surname')
            ->limit(10)
            ->get(['id', 'name', 'surname', 'document_type', 'document_number', 'email', 'phone', 'is_vip', 'is_blacklisted']);

        return response()->json($guests);
    }

    // ------------------------------------------------------------------
    // Gestión e historial de huéspedes (SHE-024 / SHE-025)
    // ------------------------------------------------------------------

    /** Huéspedes por página en el listado del panel. */
    private const PER_PAGE = 20;

    /**
     * Listado paginado de huéspedes con búsqueda y orden.
     * GET /api/guests?search=&sort=recent|name|stays&page=
     */
    public function index(ListGuestsRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $search = trim((string) ($validated['search'] ?? ''));
        $sort = $validated['sort'] ?? 'recent';

        $query = Guest::query()
            ->select(['id', 'name', 'surname', 'document_type', 'document_number', 'email', 'phone', 'nationality', 'user_id', 'created_at', 'is_vip', 'is_blacklisted'])
            ->withCount([
                'bookings',
                'bookings as stays_count' => fn ($q) => $q->where('status', Booking::STATUS_CHECKED_OUT),
            ])
            ->withMax(['bookings as last_stay' => fn ($q) => $q->where('status', Booking::STATUS_CHECKED_OUT)], 'check_out');

        if ($search !== '') {
            $like = '%' . addcslashes(mb_substr($search, 0, 100), '%_\\') . '%';
            $query->where(function ($q) use ($like) {
                $q->where('name', 'LIKE', $like)
                  ->orWhere('surname', 'LIKE', $like)
                  ->orWhere('email', 'LIKE', $like)
                  ->orWhere('document_number', 'LIKE', $like);
            });
        }

        // SHE-033: filtro VIP / lista negra
        if (($validated['flag'] ?? null) === 'vip') {
            $query->where('is_vip', true);
        } elseif (($validated['flag'] ?? null) === 'blacklisted') {
            $query->where('is_blacklisted', true);
        }

        switch ($sort) {
            case 'name':
                $query->orderBy('surname')->orderBy('name');
                break;
            case 'stays':
                $query->orderByDesc('stays_count')->orderByDesc('id');
                break;
            case 'recent':
            default:
                $query->orderByDesc('created_at')->orderByDesc('id');
                break;
        }

        $page = $query->paginate(self::PER_PAGE)->withQueryString();

        return response()->json($page);
    }

    /**
     * Ficha del huésped con estadísticas e historial completo de estadías.
     * GET /api/guests/{id}
     */
    public function show(int $id): JsonResponse
    {
        $guest = Guest::find($id);
        if (!$guest) {
            return response()->json(['message' => 'Huésped no encontrado.'], 404);
        }

        $bookings = $guest->bookings()
            ->with('room:id,room_number,name,bed_type')
            ->orderByDesc('check_in')
            ->orderByDesc('id')
            ->get(['id', 'booking_code', 'guest_id', 'room_id', 'check_in', 'check_out', 'total_amount', 'status', 'created_at']);

        $bookingIds = $bookings->pluck('id');

        $paid = (float) Payment::whereIn('booking_id', $bookingIds)
            ->where('status', Payment::STATUS_COMPLETED)
            ->where('amount', '>', 0)
            ->sum('amount');

        $refunded = abs((float) Payment::whereIn('booking_id', $bookingIds)
            ->whereIn('status', [Payment::STATUS_REFUND_PENDING, Payment::STATUS_REFUNDED])
            ->sum('amount'));

        $today = now()->toDateString();
        $completed = $bookings->where('status', Booking::STATUS_CHECKED_OUT);
        $lastStay = $completed->sortByDesc(fn ($b) => (string) $b->check_out)->first();

        $history = $bookings->map(fn (Booking $b) => $this->bookingSummary($b))->values();

        $upcoming = $bookings
            ->filter(fn (Booking $b) => in_array($b->status, [Booking::STATUS_PENDING_PAYMENT, Booking::STATUS_CONFIRMED], true)
                && substr((string) $b->check_in, 0, 10) >= $today)
            ->sortBy(fn ($b) => (string) $b->check_in)
            ->map(fn (Booking $b) => $this->bookingSummary($b))
            ->values();

        return response()->json([
            'guest' => $guest,
            'stats' => [
                'total_bookings' => $bookings->count(),
                'total_stays'    => $completed->count(),
                'total_spent'    => round(max(0, $paid - $refunded), 2),
                'last_stay'      => $lastStay ? $this->bookingSummary($lastStay) : null,
                'upcoming_count' => $upcoming->count(),
                'cancelled'      => $bookings->where('status', Booking::STATUS_CANCELLED)->count(),
            ],
            'upcoming_bookings' => $upcoming,
            'bookings'          => $history,
        ]);
    }

    /**
     * Actualiza la ficha del huésped.
     * PUT /api/guests/{id}
     */
    public function update(UpdateGuestRequest $request, int $id): JsonResponse
    {
        $guest = Guest::find($id);
        if (!$guest) {
            return response()->json(['message' => 'Huésped no encontrado.'], 404);
        }

        $validated = $request->validated();
        $validated['email'] = mb_strtolower(trim($validated['email']));
        // SHE-033: al salir de la lista negra se descarta el motivo
        if (array_key_exists('is_blacklisted', $validated) && !$validated['is_blacklisted']) {
            $validated['blacklist_reason'] = null;
        }

        $guest->update($validated);

        return response()->json([
            'message' => 'Datos del huésped actualizados correctamente.',
            'data'    => $guest->fresh(),
        ]);
    }

    /**
     * Elimina un huésped sin reservas (solo admin).
     * DELETE /api/guests/{id}
     */
    public function destroy(int $id): JsonResponse
    {
        $guest = Guest::find($id);
        if (!$guest) {
            return response()->json(['message' => 'Huésped no encontrado.'], 404);
        }

        if ($guest->bookings()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar el huésped porque tiene reservas registradas en su historial.',
            ], 409);
        }

        $guest->delete();

        return response()->json(['message' => 'Huésped eliminado correctamente.']);
    }

    private function bookingSummary(Booking $booking): array
    {
        return [
            'id'           => $booking->id,
            'booking_code' => $booking->booking_code,
            'check_in'     => substr((string) $booking->check_in, 0, 10),
            'check_out'    => substr((string) $booking->check_out, 0, 10),
            'status'       => $booking->status,
            'total_amount' => round((float) $booking->total_amount, 2),
            'room'         => $booking->room ? [
                'id'          => $booking->room->id,
                'room_number' => $booking->room->room_number,
                'name'        => $booking->room->name,
                'bed_type'    => $booking->room->bed_type,
            ] : null,
        ];
    }
}
