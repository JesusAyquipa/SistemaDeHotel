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

        $query = Room::where('status', 'disponible');

        // Filtrar habitaciones ocupadas en el rango de fechas indicado
        if ($request->filled('check_in') && $request->filled('check_out')) {
            $checkIn  = $request->query('check_in');
            $checkOut = $request->query('check_out');

            $query->whereDoesntHave('bookings', function ($q) use ($checkIn, $checkOut) {
                $q->where('check_in', '<', $checkOut)
                  ->where('check_out', '>', $checkIn)
                  ->where('status', 'confirmada');
            });
        }

        // Filtro por tipo de cama
        if ($request->filled('bed_type')) {
            $query->where('bed_type', $request->query('bed_type'));
        }

        // Filtro por capacidad mínima
        if ($request->filled('capacity')) {
            $query->where('capacity', '>=', (int) $request->query('capacity'));
        }

        $rooms = $query->orderBy('price_per_night')->get();

        return response()->json($rooms);
    }
}
