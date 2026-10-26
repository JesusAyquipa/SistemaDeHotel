<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashRegisterSession;
use App\Models\Payment;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\CashSessionService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Sesiones de caja (SHE-014) e historial de cierres (SHE-015).
 */
class CashSessionController extends Controller
{
    public function __construct(private CashSessionService $sessions)
    {
    }

    /**
     * POST /api/staff/cash-sessions/open (admin | recepcionista)
     */
    public function open(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'opening_amount' => ['required', 'numeric', 'min:0', 'max:10000000'],
            'notes'          => ['nullable', 'string', 'max:500'],
        ]);

        $userId = $request->user()->id;

        $session = DB::transaction(function () use ($validated, $userId) {
            // Bloquea la fila del usuario para serializar aperturas concurrentes (una caja abierta por usuario).
            User::whereKey($userId)->lockForUpdate()->first();

            $alreadyOpen = CashRegisterSession::where('user_id', $userId)->open()->exists();
            if ($alreadyOpen) {
                return null;
            }

            return CashRegisterSession::create([
                'user_id'        => $userId,
                'opened_at'      => now(),
                'opening_amount' => round((float) $validated['opening_amount'], 2),
                'status'         => CashRegisterSession::STATUS_OPEN,
                'notes'          => $validated['notes'] ?? null,
            ]);
        });

        if (!$session) {
            return response()->json(['message' => 'Ya tienes una caja abierta'], 409);
        }

        ActivityLogger::log(
            'cash_open',
            'Apertura de caja con monto inicial ' . number_format((float) $session->opening_amount, 2, '.', ''),
            $session,
            ['opening_amount' => (float) $session->opening_amount]
        );

        return response()->json(['session' => $session], 201);
    }

    /**
     * GET /api/staff/cash-sessions/current (admin | recepcionista)
     */
    public function current(Request $request): JsonResponse
    {
        $session = CashRegisterSession::where('user_id', $request->user()->id)->open()->latest('id')->first();

        return response()->json([
            'session' => $session,
            'summary' => $session ? $this->sessions->summary($session) : [
                'opening_amount' => 0.0,
                'cash_payments'  => 0.0,
                'card_payments'  => 0.0,
                'other_payments' => 0.0,
                'expected_cash'  => 0.0,
                'online_payments' => 0.0,
            ],
        ]);
    }

    /**
     * GET /api/staff/cash-sessions (solo admin): historial paginado con totales.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to'   => ['nullable', 'date', 'after_or_equal:date_from'],
            'user_id'   => ['nullable', 'integer', 'min:1'],
            'status'    => ['nullable', 'in:open,closed'],
        ]);

        $filtered = fn (): Builder => CashRegisterSession::query()
            ->when($filters['date_from'] ?? null, fn ($q, $v) => $q->whereDate('cash_register_sessions.opened_at', '>=', $v))
            ->when($filters['date_to'] ?? null, fn ($q, $v) => $q->whereDate('cash_register_sessions.opened_at', '<=', $v))
            ->when($filters['user_id'] ?? null, fn ($q, $v) => $q->where('cash_register_sessions.user_id', (int) $v))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('cash_register_sessions.status', $v));

        $page = $filtered()
            ->with(['user:id,name', 'closure'])
            ->orderByDesc('cash_register_sessions.opened_at')
            ->orderByDesc('cash_register_sessions.id')
            ->paginate(20);

        $sums = $filtered()
            ->join('cash_register_closures as c', 'c.id', '=', 'cash_register_sessions.cash_register_closure_id')
            ->selectRaw('COALESCE(SUM(c.expected_amount), 0) as expected, COALESCE(SUM(c.counted_amount), 0) as counted, COALESCE(SUM(c.difference), 0) as difference')
            ->first();

        return response()->json([
            'data' => $page->getCollection()->map(fn (CashRegisterSession $s) => $this->present($s))->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
                'per_page'     => $page->perPage(),
                'total'        => $page->total(),
                'from'         => $page->firstItem(),
                'to'           => $page->lastItem(),
                'totals'       => [
                    'expected_amount' => round((float) $sums->expected, 2),
                    'counted_amount'  => round((float) $sums->counted, 2),
                    'difference'      => round((float) $sums->difference, 2),
                ],
            ],
        ]);
    }

    /**
     * GET /api/staff/cash-sessions/{id} (solo admin): detalle con los pagos de la sesión.
     */
    public function show(int $id): JsonResponse
    {
        $session = CashRegisterSession::with(['user:id,name', 'closure'])->findOrFail($id);

        $payments = $session->closure
            ? Payment::where('cash_register_closure_id', $session->closure->id)
            : CashSessionService::sessionPaymentsQuery($session);

        $payments = $payments->with('booking:id,booking_code')
            ->orderBy('created_at')
            ->get()
            ->map(fn (Payment $p) => [
                'id'             => $p->id,
                'booking_code'   => $p->booking?->booking_code,
                'amount'         => (float) $p->amount,
                'payment_method' => $p->payment_method,
                'status'         => $p->status,
                'created_at'     => $p->created_at?->toIso8601String(),
            ])
            ->values();

        return response()->json([
            'session'  => $this->present($session) + [
                'totals' => $session->closure?->totals,
            ],
            'payments' => $payments,
        ]);
    }

    private function present(CashRegisterSession $s): array
    {
        $closure = $s->closure;

        return [
            'id'              => $s->id,
            'user'            => $s->user ? ['id' => $s->user->id, 'name' => $s->user->name] : null,
            'opened_at'       => $s->opened_at?->toIso8601String(),
            'closed_at'       => $s->closed_at?->toIso8601String(),
            'status'          => $s->status,
            'opening_amount'  => (float) $s->opening_amount,
            'expected_amount' => $closure ? (float) $closure->expected_amount : null,
            'counted_amount'  => $closure ? (float) $closure->counted_amount : null,
            'difference'      => $closure ? (float) $closure->difference : null,
            'notes'           => $closure?->notes ?? $s->notes,
        ];
    }
}
