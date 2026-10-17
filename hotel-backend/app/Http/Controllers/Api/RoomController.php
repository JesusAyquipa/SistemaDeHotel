<?php

namespace App\Http\Controllers\Api;

use App\Events\RoomStatusUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRoomRequest;
use App\Http\Requests\UpdateRoomRequest;
use App\Models\Booking;
use App\Models\Room;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class RoomController extends Controller
{
    /** Estados que admite el cambio rápido de estado (se conserva `reservada` por compatibilidad). */
    private const QUICK_STATUSES = [
        Room::STATUS_AVAILABLE,
        Room::STATUS_OCCUPIED,
        Room::STATUS_CLEANING,
        Room::STATUS_MAINTENANCE,
        Room::STATUS_RESERVED,
    ];

    /**
     * Devuelve habitaciones disponibles con filtros opcionales de fechas, tipo de cama y capacidad.
     * GET /api/rooms/available
     */
    public function available(Request $request): JsonResponse
    {
        // Validar fechas si se proporcionan
        if ($request->filled('check_in') || $request->filled('check_out')) {
            $validator = Validator::make($request->all(), [
                'check_in'  => ['required', 'date', 'after_or_equal:today'],
                'check_out' => ['required', 'date', 'after:check_in'],
            ], [
                'check_in.required'        => 'La fecha de llegada es obligatoria.',
                'check_in.after_or_equal'  => 'La fecha de llegada no puede ser anterior a hoy.',
                'check_out.required'       => 'La fecha de salida es obligatoria.',
                'check_out.after'          => 'La fecha de salida debe ser posterior a la fecha de llegada.',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Fechas inválidas.',
                    'errors'  => $validator->errors(),
                ], 422);
            }
        }

        $query = Room::where('status', 'disponible')->with(['roomType', 'images']);

        // Filtrar habitaciones ocupadas en el rango de fechas indicado
        if ($request->filled('check_in') && $request->filled('check_out')) {
            $checkIn  = $request->query('check_in');
            $checkOut = $request->query('check_out');

            $query->whereDoesntHave('bookings', function ($q) use ($checkIn, $checkOut) {
                // Fuente única de verdad: Booking::scopeBlocking / scopeOverlapping
                $q->overlapping($checkIn, $checkOut)->blocking();
            });
        }

        // Filtro por tipo de cama / habitación
        if ($request->filled('bed_type') && $request->query('bed_type') !== 'todos') {
            $query->where('bed_type', $request->query('bed_type'));
        }

        // SHE-034: filtro por tipo de habitación (id o slug)
        if ($request->filled('room_type_id')) {
            $query->where('room_type_id', (int) $request->query('room_type_id'));
        } elseif ($request->filled('room_type') && $request->query('room_type') !== 'todos') {
            $slug = (string) $request->query('room_type');
            $query->whereHas('roomType', fn ($q) => $q->where('slug', $slug));
        }

        // Filtro por capacidad mínima
        if ($request->filled('capacity') && (int) $request->query('capacity') > 0) {
            $query->where('capacity', '>=', (int) $request->query('capacity'));
        }

        // Filtro por precio mínimo
        if ($request->filled('min_price')) {
            $query->whereEffectivePrice('>=', (float) $request->query('min_price'));
        }

        // Filtro por precio máximo
        if ($request->filled('max_price')) {
            $query->whereEffectivePrice('<=', (float) $request->query('max_price'));
        }

        // Búsqueda por palabra clave o nombre de habitación
        if ($request->filled('search')) {
            $searchTerm = '%' . $request->query('search') . '%';
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'like', $searchTerm)
                  ->orWhere('description', 'like', $searchTerm)
                  ->orWhere('room_number', 'like', $searchTerm);
            });
        }

        // Ordenamiento
        $sortBy = $request->query('sort_by', 'price_asc');
        switch ($sortBy) {
            case 'price_desc':
                $query->orderByRaw(Room::effectivePriceSql() . ' DESC');
                break;
            case 'capacity_desc':
                $query->orderByDesc('capacity');
                break;
            case 'size_desc':
                $query->orderByDesc('size_m2');
                break;
            case 'price_asc':
            default:
                $query->orderByRaw(Room::effectivePriceSql() . ' ASC');
                break;
        }

        // SHE-037: calificación promedio y nº de reseñas publicadas (subconsultas en la misma query)
        $published = fn ($q) => $q->where('status', \App\Models\Review::STATUS_PUBLISHED);
        $query->withAvg(['reviews as rating_avg' => $published], 'rating')
              ->withCount(['reviews as reviews_count' => $published]);

        $rooms = $query->get();
        $rooms->each(function ($room) {
            $room->rating_avg = $room->rating_avg !== null ? round((float) $room->rating_avg, 1) : null;
        });

        return response()->json($rooms);
    }

    /**
     * Devuelve TODAS las habitaciones para el panel de recepción/staff,
     * incluyendo métricas del estado del inventario.
     * GET /api/staff/rooms
     */
    public function indexStaff(Request $request): JsonResponse
    {
        $query = Room::query()->with(['roomType', 'images']);

        // SHE-034: filtro por tipo
        if ($request->filled('room_type_id')) {
            $query->where('room_type_id', (int) $request->query('room_type_id'));
        }

        // Filtro por estado
        if ($request->filled('status') && $request->query('status') !== 'todos') {
            $query->where('status', $request->query('status'));
        }

        // Búsqueda por término
        if ($request->filled('search')) {
            $searchTerm = '%' . $request->query('search') . '%';
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'like', $searchTerm)
                  ->orWhere('room_number', 'like', $searchTerm)
                  ->orWhere('bed_type', 'like', $searchTerm);
            });
        }

        // has_guest: hay una reserva con check-in activo (ayuda visual en el panel)
        $rooms = $query->withExists(['bookings as has_guest' => function ($q) {
            $q->where('status', Booking::STATUS_CHECKED_IN);
        }])->orderBy('room_number')->get();

        // Métricas de inventario
        $metrics = [
            'total'         => Room::count(),
            'disponible'    => Room::where('status', 'disponible')->count(),
            'ocupada'       => Room::where('status', 'ocupada')->count(),
            'mantenimiento' => Room::where('status', 'mantenimiento')->count(),
            'limpieza'      => Room::where('status', 'limpieza')->count(),
            'reservada'     => Room::where('status', 'reservada')->count(),
        ];

        return response()->json([
            'rooms'   => $rooms,
            'metrics' => $metrics,
        ]);
    }

    /**
     * Devuelve las fechas que ya se encuentran reservadas u ocupadas para una habitación.
     * GET /api/rooms/{id}/booked-dates
     */
    public function bookedDates(Request $request, int $id): JsonResponse
    {
        $room = Room::findOrFail($id);
        
        $query = $room->bookings()
            ->blocking()
            ->where('check_out', '>=', now()->toDateString());

        if ($request->filled('exclude_booking_id')) {
            $query->where('id', '!=', $request->query('exclude_booking_id'));
        }

        $bookings = $query->get(['check_in', 'check_out']);

        return response()->json(['booked_dates' => $bookings]);
    }

    /**
     * Registra una nueva habitación en el inventario.
     * POST /api/staff/rooms
     */
    public function store(StoreRoomRequest $request): JsonResponse
    {
        $validated = $this->withTypeDefaults($request->validated());

        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('rooms', 'public');
            $validated['image_url'] = url('storage/' . $path);
        }

        $room = Room::create($validated)->load(['roomType', 'images']);

        return response()->json([
            'message' => 'Habitación registrada correctamente.',
            'room'    => $room,
        ], 201);
    }

    /**
     * Muestra el detalle de una habitación específica.
     * GET /api/staff/rooms/{id}
     */
    public function show(int $id): JsonResponse
    {
        $room = Room::with(['bookings' => function ($q) {
            $q->latest('check_in')->limit(50);
        }, 'bookings.guest:id,name,surname,email,phone', 'roomType', 'images'])->findOrFail($id);

        return response()->json(['room' => $room]);
    }

    /**
     * Actualiza los datos de una habitación.
     * PUT /api/staff/rooms/{id}
     */
    public function update(UpdateRoomRequest $request, int $id): JsonResponse
    {
        $validated = $this->withTypeDefaults($request->validated());
        $reason = $request->filled('reason') ? trim((string) $request->input('reason')) : null;
        $force = $request->boolean('force');
        unset($validated['reason'], $validated['force']);

        // Reglas de SHE-017 si cambia el estado (mismas que el cambio rápido de estado)
        $statusError = DB::transaction(function () use ($id, $validated, $request, $reason, $force) {
            $room = Room::whereKey($id)->lockForUpdate()->firstOrFail();
            if (!isset($validated['status']) || $validated['status'] === $room->status) {
                return null;
            }

            return $this->statusTransitionError($room, $validated['status'], $request, $reason, $force);
        });

        if ($statusError) {
            return $statusError;
        }

        $room = Room::findOrFail($id);
        $oldStatus = $room->status;

        if ($request->hasFile('image')) {
            // Eliminar imagen anterior si es local
            if ($room->image_url && str_contains($room->image_url, url('storage/'))) {
                $oldPath = str_replace(url('storage/') . '/', '', $room->image_url);
                Storage::disk('public')->delete($oldPath);
            }
            $path = $request->file('image')->store('rooms', 'public');
            $validated['image_url'] = url('storage/' . $path);
        }

        $room->update($validated);
        $room->load(['roomType', 'images']);

        // Si cambió el estado, registrar en bitácora y emitir evento broadcast
        if ($oldStatus !== $room->status) {
            $this->logStatusChange($room, $oldStatus, $room->status, $reason, $force);
            event(new RoomStatusUpdated($room, $oldStatus, $room->status));
        }

        return response()->json([
            'message' => 'Habitación actualizada correctamente.',
            'room'    => $room,
        ]);
    }

    /**
     * Cambio rápido de estado de una habitación desde el panel de recepción (SHE-017).
     * PATCH /api/staff/rooms/{id}/status
     *
     * Reglas (el servidor es la fuente de verdad):
     *  - Mismo estado => 422.
     *  - Con huésped alojado (reserva checked_in) no se puede pasar a disponible ni mantenimiento => 409.
     *  - `ocupada` solo con una reserva checked_in (la ocupación la determina el check-in) => 409.
     *  - `mantenimiento` exige motivo; si hay reservas confirmadas en los próximos 7 días => 409
     *    con la lista de reservas afectadas, salvo `force=true` por un administrador.
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|string|in:' . implode(',', self::QUICK_STATUSES),
            'reason' => 'nullable|string|max:500',
            'force'  => 'nullable|boolean',
        ], [
            'status.required' => 'El nuevo estado es obligatorio.',
            'status.in'       => 'El estado debe ser: disponible, ocupada, mantenimiento, limpieza o reservada.',
            'reason.max'      => 'El motivo no puede superar los 500 caracteres.',
        ]);

        $newStatus = $request->input('status');
        $reason = $request->filled('reason') ? trim((string) $request->input('reason')) : null;
        $force = $request->boolean('force');

        $result = DB::transaction(function () use ($id, $newStatus, $request, $reason, $force) {
            $room = Room::whereKey($id)->lockForUpdate()->firstOrFail();
            $oldStatus = $room->status;

            if ($oldStatus === $newStatus) {
                return ['error' => response()->json([
                    'message' => "La habitación {$room->room_number} ya se encuentra en estado {$newStatus}.",
                ], 422)];
            }

            if ($error = $this->statusTransitionError($room, $newStatus, $request, $reason, $force)) {
                return ['error' => $error];
            }

            // Se registra explícitamente (con motivo) en lugar del log automático
            Room::withoutActivityLogging(fn () => $room->update(['status' => $newStatus]));

            return ['room' => $room, 'old_status' => $oldStatus];
        });

        if (isset($result['error'])) {
            return $result['error'];
        }

        $room = $result['room'];
        $oldStatus = $result['old_status'];

        $this->logStatusChange($room, $oldStatus, $newStatus, $reason, $force);

        // Transmitir evento broadcast en tiempo real
        event(new RoomStatusUpdated($room, $oldStatus, $newStatus));

        return response()->json([
            'message'    => "Estado de la habitación {$room->room_number} cambiado a {$newStatus}.",
            'room'       => $room,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
        ]);
    }

    /**
     * Reglas de transición de estado (SHE-017), compartidas por PATCH /status y PUT.
     * Debe llamarse dentro de una transacción con la habitación bloqueada y con
     * $newStatus distinto del estado actual. Devuelve la respuesta de error o null.
     *
     * @throws ValidationException si falta el motivo de mantenimiento
     */
    private function statusTransitionError(Room $room, string $newStatus, Request $request, ?string $reason, bool $force): ?JsonResponse
    {
        if ($force && !$request->user()?->hasRole('admin')) {
            return response()->json(['message' => 'Solo un administrador puede forzar el cambio de estado.'], 403);
        }

        if ($newStatus === Room::STATUS_MAINTENANCE && !$reason) {
            throw ValidationException::withMessages([
                'reason' => ['Debe indicar el motivo para poner la habitación en mantenimiento.'],
            ]);
        }

        $hasGuest = $room->bookings()->where('status', Booking::STATUS_CHECKED_IN)->exists();

        if ($hasGuest && in_array($newStatus, [Room::STATUS_AVAILABLE, Room::STATUS_MAINTENANCE], true)) {
            return response()->json([
                'message' => 'La habitación tiene un huésped alojado. Realice el check-out desde Recepción antes de cambiar su estado.',
            ], 409);
        }

        if ($newStatus === Room::STATUS_OCCUPIED && !$hasGuest) {
            return response()->json([
                'message' => 'La habitación solo puede marcarse como ocupada mediante el check-in de una reserva.',
            ], 409);
        }

        if ($newStatus === Room::STATUS_MAINTENANCE && !$force) {
            $affected = $room->bookings()
                ->with('guest:id,name,surname')
                ->where('status', '!=', Booking::STATUS_CHECKED_IN)
                ->blocking()
                ->overlapping(now()->toDateString(), now()->addDays(7)->toDateString())
                ->orderBy('check_in')
                ->get();

            if ($affected->isNotEmpty()) {
                return response()->json([
                    'message'           => 'La habitación tiene reservas confirmadas en los próximos 7 días: '
                        . $affected->pluck('booking_code')->implode(', ')
                        . '. Reasígnelas o fuerce el cambio (solo administrador).',
                    'requires_force'    => true,
                    'affected_bookings' => $affected->map(fn (Booking $b) => [
                        'id'           => $b->id,
                        'booking_code' => $b->booking_code,
                        'check_in'     => $b->check_in,
                        'check_out'    => $b->check_out,
                        'status'       => $b->status,
                        'guest_name'   => trim(($b->guest->name ?? '') . ' ' . ($b->guest->surname ?? '')),
                    ])->values(),
                ], 409);
            }
        }

        return null;
    }

    private function logStatusChange(Room $room, ?string $oldStatus, string $newStatus, ?string $reason, bool $force): void
    {
        ActivityLogger::log(
            'status_change',
            "Habitación {$room->room_number}: {$oldStatus} → {$newStatus}"
                . ($force ? ' (forzado por administrador)' : '')
                . ($reason ? ". Motivo: {$reason}" : ''),
            $room,
            [
                'old'    => ['status' => $oldStatus],
                'new'    => ['status' => $newStatus],
                'reason' => $reason,
                'forced' => $force,
            ]
        );
    }

    /**
     * SHE-034: si se asigna un tipo y no se envía tipo de cama, se toma del tipo.
     */
    private function withTypeDefaults(array $validated): array
    {
        if (!empty($validated['room_type_id']) && empty($validated['bed_type'])) {
            $type = \App\Models\RoomType::find($validated['room_type_id']);
            $validated['bed_type'] = $type?->bed_type ?: 'doble';
        }
        if (array_key_exists('bed_type', $validated) && $validated['bed_type'] === null) {
            unset($validated['bed_type']);
        }

        return $validated;
    }

    /**
     * Elimina una habitación del inventario.
     * DELETE /api/staff/rooms/{id}
     */
    public function destroy(int $id): JsonResponse
    {
        $room = Room::findOrFail($id);

        // Las reservas conservan su historial (FK restrict): una habitación con
        // reservas no se elimina, se pone en mantenimiento.
        if ($room->bookings()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar la habitación porque tiene reservas registradas. Cámbiala a "mantenimiento" para retirarla del inventario.',
            ], 409);
        }

        // SHE-035: borrar los archivos de la galería (las filas se eliminan en cascada)
        $paths = $room->images()->pluck('path')->all();
        $room->delete();
        if ($paths) {
            Storage::disk('public')->delete($paths);
        }

        return response()->json([
            'message' => 'Habitación eliminada del inventario correctamente.',
        ]);
    }
}

