<?php

namespace App\Http\Controllers\Api;

use App\Events\RoomStatusUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRoomRequest;
use App\Http\Requests\UpdateRoomRequest;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class RoomController extends Controller
{
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

        $query = Room::where('status', 'disponible');

        // Filtrar habitaciones ocupadas en el rango de fechas indicado
        if ($request->filled('check_in') && $request->filled('check_out')) {
            $checkIn  = $request->query('check_in');
            $checkOut = $request->query('check_out');

            $query->whereDoesntHave('bookings', function ($q) use ($checkIn, $checkOut) {
                $q->where('check_in', '<', $checkOut)
                  ->where('check_out', '>', $checkIn)
                  ->whereIn('status', ['confirmed', 'confirmada', 'reservada', 'checked_in']);
            });
        }

        // Filtro por tipo de cama / habitación
        if ($request->filled('bed_type') && $request->query('bed_type') !== 'todos') {
            $query->where('bed_type', $request->query('bed_type'));
        }

        // Filtro por capacidad mínima
        if ($request->filled('capacity') && (int) $request->query('capacity') > 0) {
            $query->where('capacity', '>=', (int) $request->query('capacity'));
        }

        // Filtro por precio mínimo
        if ($request->filled('min_price')) {
            $query->where('price_per_night', '>=', (float) $request->query('min_price'));
        }

        // Filtro por precio máximo
        if ($request->filled('max_price')) {
            $query->where('price_per_night', '<=', (float) $request->query('max_price'));
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
                $query->orderByDesc('price_per_night');
                break;
            case 'capacity_desc':
                $query->orderByDesc('capacity');
                break;
            case 'size_desc':
                $query->orderByDesc('size_m2');
                break;
            case 'price_asc':
            default:
                $query->orderBy('price_per_night');
                break;
        }

        $rooms = $query->get();

        return response()->json($rooms);
    }

    /**
     * Devuelve TODAS las habitaciones para el panel de recepción/staff,
     * incluyendo métricas del estado del inventario.
     * GET /api/staff/rooms
     */
    public function indexStaff(Request $request): JsonResponse
    {
        $query = Room::query();

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

        $rooms = $query->orderBy('room_number')->get();

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
    public function bookedDates(int $id): JsonResponse
    {
        $room = Room::findOrFail($id);
        $bookings = $room->bookings()
            ->whereIn('status', ['confirmed', 'checked_in', 'pending_payment'])
            ->where('check_out', '>=', now()->toDateString())
            ->get(['check_in', 'check_out']);

        return response()->json(['booked_dates' => $bookings]);
    }

    /**
     * Registra una nueva habitación en el inventario.
     * POST /api/staff/rooms
     */
    public function store(StoreRoomRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $room = Room::create($validated);

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
        $room = Room::with('bookings.guest')->findOrFail($id);

        return response()->json(['room' => $room]);
    }

    /**
     * Actualiza los datos de una habitación.
     * PUT /api/staff/rooms/{id}
     */
    public function update(UpdateRoomRequest $request, int $id): JsonResponse
    {
        $room = Room::findOrFail($id);
        $oldStatus = $room->status;

        $validated = $request->validated();
        $room->update($validated);

        // Si cambió el estado, emitir evento broadcast
        if ($oldStatus !== $room->status) {
            event(new RoomStatusUpdated($room, $oldStatus, $room->status));
        }

        return response()->json([
            'message' => 'Habitación actualizada correctamente.',
            'room'    => $room,
        ]);
    }

    /**
     * Cambio rápido de estado de una habitación desde el panel de recepción.
     * PATCH /api/staff/rooms/{id}/status
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|string|in:disponible,ocupada,mantenimiento,limpieza,reservada',
        ], [
            'status.required' => 'El nuevo estado es obligatorio.',
            'status.in'       => 'El estado debe ser: disponible, ocupada, mantenimiento, limpieza o reservada.',
        ]);

        $room = Room::findOrFail($id);
        $oldStatus = $room->status;
        $newStatus = $request->input('status');

        $room->update(['status' => $newStatus]);

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
     * Elimina una habitación del inventario.
     * DELETE /api/staff/rooms/{id}
     */
    public function destroy(int $id): JsonResponse
    {
        $room = Room::findOrFail($id);

        // Verificar si tiene reservas activas
        $hasActiveBookings = $room->bookings()
            ->whereIn('status', ['confirmed', 'confirmada', 'reservada', 'checked_in', 'pending_payment'])
            ->exists();

        if ($hasActiveBookings) {
            return response()->json([
                'message' => 'No se puede eliminar la habitación porque tiene reservas vigentes asociadas.',
            ], 422);
        }

        $room->delete();

        return response()->json([
            'message' => 'Habitación eliminada del inventario correctamente.',
        ]);
    }
}

