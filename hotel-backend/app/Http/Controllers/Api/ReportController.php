<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\CashRegisterClosure;
use App\Models\Payment;
use App\Models\Room;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ReportController extends Controller
{
    /** Estados que representan ocupación real (o comprometida) de una habitación. */
    private const OCCUPANCY_STATUSES = [
        Booking::STATUS_CONFIRMED,
        Booking::STATUS_CHECKED_IN,
        Booking::STATUS_CHECKED_OUT,
    ];

    /**
     * Estadísticas del dashboard de reportes.
     * GET /api/staff/reports/dashboard
     */
    public function dashboard(Request $request): JsonResponse
    {
        $range = $request->query('dateRange', '30_days');
        $now = now();

        switch ($range) {
            case 'this_month':
                $startDate = $now->copy()->startOfMonth();
                $endDate = $now->copy()->endOfMonth();
                break;
            case 'last_month':
                $startDate = $now->copy()->subMonthNoOverflow()->startOfMonth();
                $endDate = $now->copy()->subMonthNoOverflow()->endOfMonth();
                break;
            case 'ytd':
                $startDate = $now->copy()->startOfYear();
                $endDate = $now->copy()->endOfYear();
                break;
            case '30_days':
            default:
                $range = '30_days';
                $startDate = $now->copy()->subDays(30)->startOfDay();
                $endDate = $now->copy()->endOfDay();
                break;
        }

        $startDay = $startDate->copy()->startOfDay();
        $endDay = $endDate->copy()->startOfDay();
        $endExclusive = $endDay->copy()->addDay();
        $daysInRange = max(1, (int) $startDay->diffInDays($endDay) + 1);

        // 1. Ingresos brutos (pagos completados positivos)
        $grossRevenue = Payment::whereBetween('created_at', [$startDate, $endDate])
            ->where('status', Payment::STATUS_COMPLETED)
            ->where('amount', '>', 0)
            ->sum('amount');

        // 2. Reservas creadas en el periodo
        $totalBookings = Booking::whereBetween('created_at', [$startDate, $endDate])->count();

        // 3. Ocupación: UNA sola consulta con todas las reservas que se cruzan con el rango
        //    (incluye las que lo abarcan completo: check_in < fin AND check_out > inicio).
        $totalRooms = Room::count();
        $bookingsInRange = Booking::whereIn('status', self::OCCUPANCY_STATUSES)
            ->overlapping($startDay, $endExclusive)
            ->get(['id', 'check_in', 'check_out']);

        // Mapa fecha => habitaciones ocupadas, calculado en memoria.
        $occupiedByDay = [];
        for ($d = $startDay->copy(); $d->lt($endExclusive); $d->addDay()) {
            $occupiedByDay[$d->toDateString()] = 0;
        }

        $occupiedNights = 0;
        foreach ($bookingsInRange as $booking) {
            $bStart = Carbon::parse($booking->check_in)->startOfDay();
            $bEnd = Carbon::parse($booking->check_out)->startOfDay();
            if ($bStart->lt($startDay)) {
                $bStart = $startDay->copy();
            }
            if ($bEnd->gt($endExclusive)) {
                $bEnd = $endExclusive->copy();
            }
            for ($d = $bStart->copy(); $d->lt($bEnd); $d->addDay()) {
                $key = $d->toDateString();
                if (isset($occupiedByDay[$key])) {
                    $occupiedByDay[$key]++;
                    $occupiedNights++;
                }
            }
        }

        $totalAvailableNights = $totalRooms * $daysInRange;
        $occupancyRate = $totalAvailableNights > 0
            ? round(($occupiedNights / $totalAvailableNights) * 100, 1)
            : 0;

        // 4. Datos del gráfico
        $chartData = [];
        foreach ($occupiedByDay as $date => $occupied) {
            $chartData[] = [
                'date'           => Carbon::parse($date)->format('d M'),
                'month'          => Carbon::parse($date)->format('M'),
                'occupancy'      => $totalRooms > 0 ? round(($occupied / $totalRooms) * 100, 1) : 0,
                'occupied_rooms' => $occupied,
            ];
        }

        if ($range === 'ytd' && count($chartData) > 31) {
            $monthly = [];
            foreach ($chartData as $point) {
                $monthly[$point['month']]['sum'] = ($monthly[$point['month']]['sum'] ?? 0) + $point['occupancy'];
                $monthly[$point['month']]['count'] = ($monthly[$point['month']]['count'] ?? 0) + 1;
            }
            $chartData = [];
            foreach ($monthly as $month => $stats) {
                $chartData[] = ['date' => $month, 'occupancy' => round($stats['sum'] / $stats['count'], 1)];
            }
        } else {
            $chartData = array_map(function ($p) {
                unset($p['month']);
                return $p;
            }, $chartData);
        }

        // 5. Transacciones
        $transactions = Payment::with(['booking:id,booking_code'])
            ->whereBetween('created_at', [$startDate, $endDate])
            ->orderBy('created_at', 'desc')
            ->take(50)
            ->get()
            ->map(function ($payment) {
                return [
                    'id'           => $payment->id,
                    'date'         => Carbon::parse($payment->created_at)->format('d M Y'),
                    'staff'        => $payment->gateway_provider === 'manual' ? 'Recepción' : 'Sistema / Online',
                    'amount'       => $payment->amount,
                    'status'       => $payment->status,
                    'booking_code' => $payment->booking ? $payment->booking->booking_code : 'N/A',
                ];
            });

        $unreconciledRevenue = Payment::where('is_reconciled', false)
            ->where('status', Payment::STATUS_COMPLETED)
            ->where('amount', '>', 0)
            ->sum('amount');

        return response()->json([
            'occupancy_rate'       => $occupancyRate,
            'gross_revenue'        => $grossRevenue,
            'unreconciled_revenue' => $unreconciledRevenue,
            'total_bookings'       => $totalBookings,
            'chart_data'           => $chartData,
            'transactions'         => $transactions,
            'startDate'            => $startDay->format('Y-m-d'),
            'endDate'              => $endDay->format('Y-m-d'),
        ]);
    }

    /**
     * Cierre de caja. Los totales se calculan en el servidor a partir de los pagos
     * completados no conciliados hasta el momento del cierre; solo esos pagos se concilian.
     * expected_amount / difference enviados por el cliente se ignoran.
     * POST /api/staff/reports/close-register
     */
    public function closeRegister(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cash_amount'    => 'required|numeric|min:0|max:10000000',
            'voucher_amount' => 'required|numeric|min:0|max:10000000',
            'notes'          => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $closedAt = now();

        $closure = DB::transaction(function () use ($validated, $user, $closedAt) {
            $payments = Payment::where('is_reconciled', false)
                ->where('status', Payment::STATUS_COMPLETED)
                ->where('amount', '>', 0)
                ->where('created_at', '<=', $closedAt)
                ->lockForUpdate()
                ->get(['id', 'amount', 'payment_method', 'created_at']);

            $byMethod = [];
            foreach ($payments as $p) {
                $byMethod[$p->payment_method] = round(($byMethod[$p->payment_method] ?? 0) + (float) $p->amount, 2);
            }

            $cashExpected = round($payments->whereIn('payment_method', Payment::CASH_METHODS)->sum('amount'), 2);
            $voucherExpected = round($payments->whereIn('payment_method', Payment::VOUCHER_METHODS)->sum('amount'), 2);
            $expected = round((float) $payments->sum('amount'), 2);
            $counted = round((float) $validated['cash_amount'] + (float) $validated['voucher_amount'], 2);

            $lastClosure = CashRegisterClosure::latest('closed_at')->first();
            $openedAt = $lastClosure?->closed_at ?? ($payments->min('created_at') ?? $closedAt);

            $closure = CashRegisterClosure::create([
                'user_id'         => $user->id,
                'opened_at'       => $openedAt,
                'closed_at'       => $closedAt,
                'totals'          => [
                    'payments_count'   => $payments->count(),
                    'by_method'        => $byMethod,
                    'cash_expected'    => $cashExpected,
                    'voucher_expected' => $voucherExpected,
                    'other_expected'   => round($expected - $cashExpected - $voucherExpected, 2),
                    'cash_counted'     => round((float) $validated['cash_amount'], 2),
                    'voucher_counted'  => round((float) $validated['voucher_amount'], 2),
                ],
                'expected_amount' => $expected,
                'counted_amount'  => $counted,
                'difference'      => round($counted - $expected, 2),
                'notes'           => $validated['notes'] ?? null,
            ]);

            if ($payments->isNotEmpty()) {
                Payment::whereIn('id', $payments->pluck('id'))
                    ->update(['is_reconciled' => true, 'cash_register_closure_id' => $closure->id]);
            }

            return $closure;
        });

        Log::info('Cierre de caja realizado', ['user_id' => $user->id, 'closure_id' => $closure->id]);

        return response()->json([
            'success'  => true,
            'message'  => 'Cierre de caja registrado exitosamente.',
            'closure'  => $closure,
            'receipt'  => [
                'closure_id'      => $closure->id,
                'date'            => $closedAt->format('Y-m-d H:i:s'),
                'staff'           => $user->name,
                'expected_amount' => (float) $closure->expected_amount,
                'counted_amount'  => (float) $closure->counted_amount,
                'difference'      => (float) $closure->difference,
            ],
        ]);
    }

    /**
     * Historial de cierres de caja con filtros por empleado y fechas (SHE-015).
     * GET /api/staff/reports/closures
     */
    public function closures(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id'   => 'nullable|integer|exists:users,id',
            'date_from' => 'nullable|date',
            'date_to'   => 'nullable|date',
            'status'    => 'nullable|in:all,balanced,discrepancy,surplus,deficit',
        ]);

        $query = CashRegisterClosure::with(['user:id,name,email'])
            ->orderBy('closed_at', 'desc');

        if (!empty($validated['user_id'])) {
            $query->where('user_id', $validated['user_id']);
        }

        if (!empty($validated['date_from'])) {
            $query->whereDate('closed_at', '>=', $validated['date_from']);
        }

        if (!empty($validated['date_to'])) {
            $query->whereDate('closed_at', '<=', $validated['date_to']);
        }

        if (!empty($validated['status'])) {
            if ($validated['status'] === 'balanced') {
                $query->where('difference', 0);
            } elseif ($validated['status'] === 'discrepancy') {
                $query->where('difference', '!=', 0);
            } elseif ($validated['status'] === 'surplus') {
                $query->where('difference', '>', 0);
            } elseif ($validated['status'] === 'deficit') {
                $query->where('difference', '<', 0);
            }
        }

        $closures = $query->paginate(20);

        // Transformar para respuesta legible
        $closures->getCollection()->transform(function ($c) {
            return [
                'id'              => $c->id,
                'user_id'         => $c->user_id,
                'staff_name'      => $c->user?->name ?? 'Usuario desconocido',
                'staff_email'     => $c->user?->email,
                'opened_at'       => $c->opened_at ? $c->opened_at->format('Y-m-d H:i') : null,
                'closed_at'       => $c->closed_at->format('Y-m-d H:i'),
                'expected_amount' => (float) $c->expected_amount,
                'counted_amount'  => (float) $c->counted_amount,
                'difference'      => (float) $c->difference,
                'status'          => abs((float) $c->difference) < 0.01 ? 'balanced' : ((float) $c->difference > 0 ? 'surplus' : 'deficit'),
                'notes'           => $c->notes,
                'totals'          => $c->totals,
                'created_at'      => $c->created_at->format('Y-m-d H:i'),
            ];
        });

        // Empleados disponibles para el selector de filtros
        $staffMembers = User::role(['admin', 'recepcionista'])
            ->select('id', 'name', 'email')
            ->orderBy('name')
            ->get();

        return response()->json([
            'closures'      => $closures,
            'staff_members' => $staffMembers,
        ]);
    }
}
