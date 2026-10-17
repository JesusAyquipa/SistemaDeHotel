<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use App\Services\CancellationPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Política de cancelación y no-show (SHE-028).
 */
class CancellationPolicyController extends Controller
{
    /** GET /api/settings/cancellation-policy (público) */
    public function show(): JsonResponse
    {
        return response()->json(CancellationPolicy::current());
    }

    /** PUT /api/settings/cancellation-policy (admin) */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate(CancellationPolicy::RULES, [], [
            'free_cancellation_hours'          => 'horas de cancelación gratuita',
            'late_cancellation_penalty_nights' => 'noches de penalidad por cancelación tardía',
            'no_show_penalty_nights'           => 'noches de penalidad por no-show',
            'no_show_grace_hours'              => 'horas de gracia para no-show',
        ]);

        $old = CancellationPolicy::current();
        $policy = CancellationPolicy::update($validated);

        ActivityLogger::log(
            'policy_updated',
            'Política de cancelación actualizada',
            null,
            ['old' => $old, 'new' => $policy]
        );

        return response()->json($policy);
    }
}
