<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Season;
use App\Models\Coupon;

class SettingsController extends Controller
{
    public function index()
    {
        return response()->json([
            'seasons' => Season::all(),
            'coupons' => Coupon::all()
        ]);
    }

    public function storeSeason(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'rate_adjustment' => 'required|numeric',
        ]);
        $season = Season::create($validated);
        return response()->json($season);
    }
    
    public function updateSeason(Request $request, $id)
    {
        $season = Season::findOrFail($id);
        $season->update($request->all());
        return response()->json($season);
    }

    public function destroySeason($id)
    {
        Season::destroy($id);
        return response()->json(['success' => true]);
    }

    public function storeCoupon(Request $request)
    {
        $validated = $request->validate([
            'code' => 'required|string|unique:coupons,code',
            'discount_type' => 'required|in:percentage,fixed',
            'discount_value' => 'required|numeric',
            'expires_at' => 'required|date',
            'max_uses' => 'nullable|integer',
        ]);
        $coupon = Coupon::create($validated);
        return response()->json($coupon);
    }

    public function updateCoupon(Request $request, $id)
    {
        $coupon = Coupon::findOrFail($id);
        $coupon->update($request->all());
        return response()->json($coupon);
    }

    public function destroyCoupon($id)
    {
        Coupon::destroy($id);
        return response()->json(['success' => true]);
    }

    public function validateCoupon(Request $request)
    {
        $request->validate(['code' => 'required|string']);
        $coupon = Coupon::where('code', $request->code)->where('is_active', true)->first();
        
        if (!$coupon) {
            return response()->json(['error' => 'Cupón no válido o no encontrado'], 404);
        }
        
        if ($coupon->expires_at < now()) {
            return response()->json(['error' => 'El cupón ha expirado'], 400);
        }
        
        if ($coupon->max_uses && $coupon->current_uses >= $coupon->max_uses) {
            return response()->json(['error' => 'El cupón ha alcanzado su límite de uso'], 400);
        }
        
        return response()->json(['coupon' => $coupon]);
    }
}
