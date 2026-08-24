<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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

        $query = Room::where('status', '!=', 'mantenimiento');

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
}
