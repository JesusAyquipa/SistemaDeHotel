<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Services\NoShowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * POST /api/staff/bookings/{code}/no-show (admin | recepcionista) — SHE-028.
 */
class NoShowController extends Controller
{
    public function __invoke(Request $request, string $code, NoShowService $noShows): JsonResponse
    {
        $booking = Booking::where('booking_code', $code)->first();
        if (!$booking) {
            return response()->json(['message' => 'Reserva no encontrada.'], 404);
        }

        $outcome = $noShows->mark($booking, $request->user());

        return response()->json([
            'message'        => 'Reserva marcada como no-show.',
            'booking'        => $outcome['booking']->fresh(['room', 'guest']),
            'penalty_amount' => $outcome['penalty_amount'],
            'refund_amount'  => $outcome['refund_amount'],
            'refund'         => $outcome['refund'],
        ]);
    }
}
