<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Room;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Estadísticas agregadas para los gráficos del dashboard (SHE-020).
 * GET /api/staff/reports/stats?dateRange=30_days|this_month|last_month|ytd
 *   o ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD (máx. 366 días)
 *
 * Todas las series se calculan con consultas agrupadas (GROUP BY) y SQL portable
 * entre MySQL y SQLite (DATE(), sin DATE_FORMAT).
 */
class ReportStatsController extends Controller
{
    /** Estados que cuentan como noche vendida (ocupación real o comprometida). */
    private const OCCUPANCY_STATUSES = [
        Booking::STATUS_CONFIRMED,
        Booking::STATUS_CHECKED_IN,
        Booking::STATUS_CHECKED_OUT,
    ];

    private const MAX_DAYS = 366;

    /** Normalización de métodos de pago heredados a una etiqueta común. */
    private const METHOD_LABELS = [
        'efectivo'      => 'Efectivo',
        'cash'          => 'Efectivo',
        'tarjeta'       => 'Tarjeta',
        'card'          => 'Tarjeta',
        'credit_card'   => 'Tarjeta',
        'transferencia' => 'Transferencia',
        'transfer'      => 'Transferencia',
        'yape'          => 'Yape / Plin',
        'plin'          => 'Yape / Plin',
    ];

    public function stats(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'dateRange'  => 'nullable|string|in:30_days,this_month,last_month,ytd',
            'start_date' => 'nullable|date_format:Y-m-d|required_with:end_date',
            'end_date'   => 'nullable|date_format:Y-m-d|required_with:start_date|after_or_equal:start_date',
        ]);

        [$start, $end, $range] = $this->resolveRange($validated);

        if ($start->diffInDays($end) + 1 > self::MAX_DAYS) {
            return response()->json(['message' => 'El rango máximo permitido es de 366 días.'], 422);
        }

        $days = [];
        for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
            $days[] = $d->toDateString();
        }

        $startStr = $start->toDateString();
        $endStr = $end->toDateString();
        $fromTs = $start->copy()->startOfDay();
        $toTs = $end->copy()->endOfDay();

        $totalRooms = Room::count();

        // 1. Ingresos por día (pagos completados positivos), agrupados por DATE(created_at)
        $revenueRows = Payment::query()
            ->selectRaw('DATE(created_at) as day, SUM(amount) as revenue, COUNT(*) as payments')
            ->where('status', Payment::STATUS_COMPLETED)
            ->where('amount', '>', 0)
            ->whereBetween('created_at', [$fromTs, $toTs])
            ->groupByRaw('DATE(created_at)')
            ->get()
            ->keyBy(fn ($r) => substr((string) $r->day, 0, 10));

        // Reembolsos del periodo (montos negativos registrados)
        $refunds = abs((float) Payment::query()
            ->whereIn('status', [Payment::STATUS_REFUND_PENDING, Payment::STATUS_REFUNDED])
            ->whereBetween('created_at', [$fromTs, $toTs])
            ->sum('amount'));

        // 2. Ocupación por día + ingreso de habitación prorrateado por noche, en UNA consulta
        //    agrupada: calendario (UNION ALL de fechas) LEFT JOIN reservas que cubren cada noche.
        $nights = $this->nightsExpression('b.check_in', 'b.check_out');
        $calendarSql = implode(' UNION ALL ', array_fill(0, count($days), 'SELECT ? AS day'));
        $statusPlaceholders = implode(',', array_fill(0, count(self::OCCUPANCY_STATUSES), '?'));

        $occupancyRows = collect(DB::select(
            "SELECT cal.day AS day,
                    COUNT(DISTINCT b.room_id) AS occupied_rooms,
                    COUNT(b.id) AS room_nights,
                    COALESCE(SUM(b.total_amount * 1.0 / NULLIF({$nights}, 0)), 0) AS room_revenue
             FROM ({$calendarSql}) cal
             LEFT JOIN bookings b
               ON DATE(b.check_in) <= cal.day
              AND DATE(b.check_out) > cal.day
              AND b.status IN ({$statusPlaceholders})
             GROUP BY cal.day
             ORDER BY cal.day",
            array_merge($days, self::OCCUPANCY_STATUSES)
        ))->keyBy(fn ($r) => substr((string) $r->day, 0, 10));

        $revenueByDay = [];
        $occupancyByDay = [];
        $grossRevenue = 0.0;
        $roomRevenue = 0.0;
        $roomNightsSold = 0;

        foreach ($days as $day) {
            $rev = round((float) ($revenueRows[$day]->revenue ?? 0), 2);
            $grossRevenue += $rev;
            $revenueByDay[] = ['date' => $day, 'revenue' => $rev];

            $row = $occupancyRows[$day] ?? null;
            $occupied = (int) ($row->occupied_rooms ?? 0);
            $roomNightsSold += (int) ($row->room_nights ?? 0);
            $roomRevenue += (float) ($row->room_revenue ?? 0);
            $occupancyByDay[] = [
                'date'           => $day,
                'occupied_rooms' => $occupied,
                'occupancy'      => $totalRooms > 0 ? round($occupied / $totalRooms * 100, 1) : 0,
            ];
        }

        $availableRoomNights = $totalRooms * count($days);
        $roomRevenue = round($roomRevenue, 2);

        // 3. Reservas por estado (creadas en el periodo)
        $bookingsByStatus = Booking::query()
            ->selectRaw('status, COUNT(*) as total')
            ->whereBetween('created_at', [$fromTs, $toTs])
            ->groupBy('status')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($r) => ['status' => $r->status, 'count' => (int) $r->total])
            ->values();

        // 4. Ingresos por tipo de habitación
        $revenueByRoomType = DB::table('payments as p')
            ->join('bookings as b', 'b.id', '=', 'p.booking_id')
            ->join('rooms as r', 'r.id', '=', 'b.room_id')
            // SHE-034: agrupa por nombre del tipo; habitaciones sin tipo usan bed_type
            ->leftJoin('room_types as rt', 'rt.id', '=', 'r.room_type_id')
            ->selectRaw('COALESCE(rt.name, r.bed_type) as room_type, SUM(p.amount) as revenue, COUNT(DISTINCT b.id) as bookings')
            ->where('p.status', Payment::STATUS_COMPLETED)
            ->where('p.amount', '>', 0)
            ->whereBetween('p.created_at', [$fromTs, $toTs])
            ->groupByRaw('COALESCE(rt.name, r.bed_type)')
            ->orderByDesc('revenue')
            ->get()
            ->map(fn ($r) => [
                'room_type' => $r->room_type,
                'revenue'   => round((float) $r->revenue, 2),
                'bookings'  => (int) $r->bookings,
            ])
            ->values();

        // 5. Métodos de pago
        $methods = [];
        Payment::query()
            ->selectRaw('payment_method, SUM(amount) as total, COUNT(*) as payments')
            ->where('status', Payment::STATUS_COMPLETED)
            ->where('amount', '>', 0)
            ->whereBetween('created_at', [$fromTs, $toTs])
            ->groupBy('payment_method')
            ->get()
            ->each(function ($r) use (&$methods) {
                $raw = (string) $r->payment_method;
                $label = self::METHOD_LABELS[mb_strtolower(trim($raw))] ?? ($raw !== '' ? $raw : 'Otro');
                $methods[$label]['method'] = $label;
                $methods[$label]['total'] = round(($methods[$label]['total'] ?? 0) + (float) $r->total, 2);
                $methods[$label]['count'] = ($methods[$label]['count'] ?? 0) + (int) $r->payments;
            });
        $paymentMethods = collect($methods)->sortByDesc('total')->values();

        // 6. Top 5 productos consumidos (cargos del periodo)
        $topProducts = DB::table('charges as c')
            ->leftJoin('products as pr', 'pr.id', '=', 'c.product_id')
            ->selectRaw("COALESCE(pr.name, c.concept, 'Sin nombre') as name, SUM(c.quantity) as quantity, SUM(c.total) as revenue")
            ->whereBetween(DB::raw('DATE(c.date)'), [$startStr, $endStr])
            ->groupByRaw("COALESCE(pr.name, c.concept, 'Sin nombre')")
            ->orderByDesc('quantity')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get()
            ->map(fn ($r) => [
                'name'     => $r->name,
                'quantity' => (int) $r->quantity,
                'revenue'  => round((float) $r->revenue, 2),
            ])
            ->values();

        $grossRevenue = round($grossRevenue, 2);

        return response()->json([
            'range' => [
                'key'        => $range,
                'start_date' => $startStr,
                'end_date'   => $endStr,
                'days'       => count($days),
            ],
            'kpis' => [
                'gross_revenue'         => $grossRevenue,
                'refunds'               => round($refunds, 2),
                'net_revenue'           => round($grossRevenue - $refunds, 2),
                'room_revenue'          => $roomRevenue,
                'room_nights_sold'      => $roomNightsSold,
                'available_room_nights' => $availableRoomNights,
                'total_rooms'           => $totalRooms,
                'occupancy_rate'        => $availableRoomNights > 0 ? round($roomNightsSold / $availableRoomNights * 100, 1) : 0,
                'adr'                   => $roomNightsSold > 0 ? round($roomRevenue / $roomNightsSold, 2) : 0,
                'revpar'                => $availableRoomNights > 0 ? round($roomRevenue / $availableRoomNights, 2) : 0,
                'total_bookings'        => (int) $bookingsByStatus->sum('count'),
            ],
            'revenue_by_day'       => $revenueByDay,
            'occupancy_by_day'     => $occupancyByDay,
            'bookings_by_status'   => $bookingsByStatus,
            'revenue_by_room_type' => $revenueByRoomType,
            'payment_methods'      => $paymentMethods,
            'top_products'         => $topProducts,
        ]);
    }

    /**
     * @return array{0: Carbon, 1: Carbon, 2: string}
     */
    private function resolveRange(array $validated): array
    {
        if (!empty($validated['start_date']) && !empty($validated['end_date'])) {
            return [
                Carbon::parse($validated['start_date'])->startOfDay(),
                Carbon::parse($validated['end_date'])->startOfDay(),
                'custom',
            ];
        }

        $now = now();
        $range = $validated['dateRange'] ?? '30_days';

        return match ($range) {
            'this_month' => [$now->copy()->startOfMonth(), $now->copy()->endOfMonth()->startOfDay(), $range],
            'last_month' => [
                $now->copy()->subMonthNoOverflow()->startOfMonth(),
                $now->copy()->subMonthNoOverflow()->endOfMonth()->startOfDay(),
                $range,
            ],
            'ytd'        => [$now->copy()->startOfYear(), $now->copy()->startOfDay(), $range],
            default      => [$now->copy()->subDays(30)->startOfDay(), $now->copy()->startOfDay(), '30_days'],
        };
    }

    /**
     * Noches entre dos columnas de fecha según el motor de BD.
     */
    private function nightsExpression(string $in, string $out): string
    {
        return match (DB::connection()->getDriverName()) {
            'sqlite' => "CAST(julianday(DATE({$out})) - julianday(DATE({$in})) AS INTEGER)",
            'pgsql'  => "(DATE({$out}) - DATE({$in}))",
            'sqlsrv' => "DATEDIFF(day, {$in}, {$out})",
            default  => "DATEDIFF({$out}, {$in})",
        };
    }
}
