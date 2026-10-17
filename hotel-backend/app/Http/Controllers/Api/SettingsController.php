<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\Season;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class SettingsController extends Controller
{
    /** Mensaje genérico para cualquier cupón no utilizable (no revela el motivo). */
    private const INVALID_COUPON_MESSAGE = 'El cupón no es válido o ya no está disponible.';

    public function index(): JsonResponse
    {
        return response()->json([
            'seasons' => Season::with('roomType:id,name')->orderBy('start_date')->get(),
            'coupons' => Coupon::orderBy('code')->get(),
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    // Temporadas
    // ─────────────────────────────────────────────────────────────

    public function storeSeason(Request $request): JsonResponse
    {
        $season = Season::create($this->validatedSeasonData($request));

        return response()->json($season, 201);
    }

    public function updateSeason(Request $request, $id): JsonResponse
    {
        $season = Season::findOrFail($id);
        $season->update($this->validatedSeasonData($request, $season));

        return response()->json($season->fresh());
    }

    public function destroySeason($id): JsonResponse
    {
        Season::findOrFail($id)->delete();

        return response()->json(['success' => true]);
    }

    // ─────────────────────────────────────────────────────────────
    // Cupones
    // ─────────────────────────────────────────────────────────────

    public function storeCoupon(Request $request): JsonResponse
    {
        $coupon = Coupon::create($this->validatedCouponData($request));

        return response()->json($coupon, 201);
    }

    public function updateCoupon(Request $request, $id): JsonResponse
    {
        $coupon = Coupon::findOrFail($id);
        $coupon->update($this->validatedCouponData($request, $coupon));

        return response()->json($coupon->fresh());
    }

    public function destroyCoupon($id): JsonResponse
    {
        Coupon::findOrFail($id)->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Validación pública de un cupón (checkout). Un cupón es válido durante
     * todo el día de `expires_at`. Cualquier motivo de rechazo devuelve el
     * mismo mensaje genérico.
     *
     * Nota: el incremento de `current_uses` se hace al confirmar la reserva
     * (flujo de reservas/pagos), no aquí.
     */
    public function validateCoupon(Request $request): JsonResponse
    {
        $validated = $request->validate(['code' => 'required|string|max:50']);

        $coupon = Coupon::where('code', trim($validated['code']))->first();

        if (!$coupon || !self::couponIsUsable($coupon)) {
            return response()->json([
                'message' => self::INVALID_COUPON_MESSAGE,
                // Compatibilidad con el frontend actual, que lee `error`
                'error'   => self::INVALID_COUPON_MESSAGE,
            ], 422);
        }

        return response()->json([
            'coupon' => [
                'code'           => $coupon->code,
                'discount_type'  => $coupon->discount_type,
                'discount_value' => $coupon->discount_value,
                'expires_at'     => $coupon->expires_at?->toDateString(),
            ],
        ]);
    }

    /**
     * Un cupón es utilizable si está activo, no ha vencido (válido hasta el
     * final del día de expires_at) y no alcanzó su límite de usos.
     */
    public static function couponIsUsable(Coupon $coupon): bool
    {
        if (!$coupon->is_active) {
            return false;
        }

        if ($coupon->expires_at) {
            $expiresEndOfDay = Carbon::parse($coupon->expires_at)->endOfDay();
            if ($expiresEndOfDay->isPast()) {
                return false;
            }
        }

        if ($coupon->max_uses !== null && (int) $coupon->current_uses >= (int) $coupon->max_uses) {
            return false;
        }

        return true;
    }

    // ─────────────────────────────────────────────────────────────
    // Validadores
    // ─────────────────────────────────────────────────────────────

    private function validatedSeasonData(Request $request, ?Season $season = null): array
    {
        $required = $season ? 'sometimes' : 'required';

        $validated = $request->validate([
            'name'            => [$required, 'string', 'max:100'],
            'start_date'      => [$required, 'date'],
            'end_date'        => [$required, 'date'],
            'rate_adjustment' => [$required, 'numeric', 'min:-100', 'max:1000'],
            'is_active'       => ['sometimes', 'boolean'],
            // SHE-034: tipo de habitación al que aplica (null = todos)
            'room_type_id'    => ['sometimes', 'nullable', 'integer', 'exists:room_types,id'],
        ]);

        $start = $validated['start_date'] ?? $season?->start_date;
        $end = $validated['end_date'] ?? $season?->end_date;
        if ($start && $end && Carbon::parse($end)->lt(Carbon::parse($start))) {
            abort(response()->json([
                'message' => 'La fecha de fin debe ser igual o posterior a la fecha de inicio.',
                'errors'  => ['end_date' => ['La fecha de fin debe ser igual o posterior a la fecha de inicio.']],
            ], 422));
        }

        return $validated;
    }

    private function validatedCouponData(Request $request, ?Coupon $coupon = null): array
    {
        $required = $coupon ? 'sometimes' : 'required';

        $validated = $request->validate([
            'code'           => [$required, 'string', 'max:50', 'regex:/^[A-Za-z0-9_-]+$/', Rule::unique('coupons', 'code')->ignore($coupon?->id)],
            'discount_type'  => [$required, 'in:percentage,fixed'],
            'discount_value' => [$required, 'numeric', 'gt:0', 'max:100000'],
            'expires_at'     => [$required, 'date'],
            'max_uses'       => ['sometimes', 'nullable', 'integer', 'min:1'],
            'is_active'      => ['sometimes', 'boolean'],
        ], [
            'code.regex'         => 'El código solo puede contener letras, números, guiones y guiones bajos.',
            'discount_value.gt'  => 'El valor del descuento debe ser mayor que 0.',
        ]);

        if (isset($validated['code'])) {
            $validated['code'] = strtoupper($validated['code']);
        }

        $type = $validated['discount_type'] ?? $coupon?->discount_type;
        $value = $validated['discount_value'] ?? $coupon?->discount_value;
        if ($type === 'percentage' && $value !== null && (float) $value > 100) {
            abort(response()->json([
                'message' => 'Un descuento porcentual no puede superar el 100%.',
                'errors'  => ['discount_value' => ['Un descuento porcentual no puede superar el 100%.']],
            ], 422));
        }

        return $validated;
    }
}
