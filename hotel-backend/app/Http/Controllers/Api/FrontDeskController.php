<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingPrecheck;
use App\Models\Payment;
use App\Models\Room;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

/**
 * Recepción (front desk): rack de ocupación (SHE-030) y panel del día (SHE-031).
 */
class FrontDeskController extends Controller
{
    public const DEFAULT_DAYS = 14;
    public const MAX_DAYS = 31;

    /** Campos del huésped que necesita recepción (sin datos sensibles adicionales). */
    private const GUEST_COLUMNS = 'guest:id,name,surname,document_type,document_number,email,phone,is_vip,is_blacklisted,blacklist_reason,notes,preferences';

    /**
     * Rack de ocupación: habitaciones (ordenadas por piso/número) con las reservas
     * que se cruzan con [start, start + days).
     * GET /api/staff/front-desk/rack?start=YYYY-MM-DD&days=14
     */
    public function rack(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'start' => ['nullable', 'date_format:Y-m-d'],
            'days'  => ['nullable', 'integer', 'min:1', 'max:' . self::MAX_DAYS],
        ], [
            'start.date_format' => 'La fecha de inicio debe tener el formato AAAA-MM-DD.',
            'days.max'          => 'El rack admite como máximo ' . self::MAX_DAYS . ' días.',
            'days.min'          => 'El rack debe mostrar al menos un día.',
        ]);

        $start = isset($validated['start']) ? Carbon::parse($validated['start'])->startOfDay() : now()->startOfDay();
        $days = (int) ($validated['days'] ?? self::DEFAULT_DAYS);
        $end = $start->copy()->addDays($days);

        // Una sola consulta para todas las reservas del rango.
        $bookings = Booking::query()
            ->with('guest:id,name,surname,is_vip,is_blacklisted')
            ->where(function (Builder $q) {
                $q->blocking()->orWhere('status', Booking::STATUS_CHECKED_OUT);
            })
            ->overlapping($start->toDateString(), $end->toDateString())
            ->orderBy('check_in')
            ->get(['id', 'booking_code', 'guest_id', 'room_id', 'check_in', 'check_out', 'status', 'total_amount', 'expires_at'])
            ->groupBy('room_id');

        $rooms = Room::query()
            ->get(['id', 'room_number', 'name', 'bed_type', 'capacity', 'price_per_night', 'status'])
            ->sort(fn (Room $a, Room $b) => [self::floorOf($a->room_number), self::numericNumber($a->room_number), $a->room_number]
                <=> [self::floorOf($b->room_number), self::numericNumber($b->room_number), $b->room_number])
            ->values()
            ->map(fn (Room $room) => [
                'id'              => $room->id,
                'room_number'     => $room->room_number,
                'name'            => $room->name,
                'bed_type'        => $room->bed_type,
                'capacity'        => $room->capacity,
                'price_per_night' => $room->price_per_night,
                'status'          => $room->status,
                'floor'           => self::floorOf($room->room_number),
                'bookings'        => ($bookings->get($room->id) ?? collect())
                    ->map(fn (Booking $b) => $this->rackBooking($b))
                    ->values(),
            ]);

        return response()->json([
            'start' => $start->toDateString(),
            'end'   => $end->toDateString(),
            'days'  => $days,
            'today' => now()->toDateString(),
            'rooms' => $rooms,
        ]);
    }

    /**
     * Panel del día: llegadas, salidas, huéspedes en casa y posibles no-show.
     * GET /api/staff/front-desk/today
     */
    public function today(): JsonResponse
    {
        $today = now()->toDateString();

        // Llegadas de hoy (incluye las que ya hicieron check-in hoy, para seguimiento).
        $arrivals = $this->bookingQuery()
            ->whereDate('check_in', $today)
            ->where(function (Builder $q) {
                $q->blocking();
            })
            ->orderBy('check_in')
            ->get();

        // Huéspedes alojados (todos los check-in activos).
        $inHouse = $this->bookingQuery()
            ->where('status', Booking::STATUS_CHECKED_IN)
            ->orderBy('check_out')
            ->get();

        // Salidas: alojados cuya fecha de salida es hoy (o ya pasó).
        $departures = $inHouse->filter(fn (Booking $b) => substr((string) $b->check_out, 0, 10) <= $today)->values();

        // Posibles no-show: confirmadas cuyo check-in ya pasó y no se presentaron.
        $noShows = $this->bookingQuery()
            ->where('status', Booking::STATUS_CONFIRMED)
            ->whereDate('check_in', '<', $today)
            ->orderBy('check_in')
            ->get();

        $all = $arrivals->concat($inHouse)->concat($noShows);
        $prechecks = $this->prechecksFor($all->pluck('id')->unique()->all());

        $map = fn (Collection|\Illuminate\Support\Collection $items) => $items
            ->map(fn (Booking $b) => $this->todayBooking($b, $prechecks[$b->id] ?? null))
            ->values();

        $pendingArrivals = $arrivals->whereIn('status', [Booking::STATUS_CONFIRMED, Booking::STATUS_PENDING_PAYMENT])->count();

        return response()->json([
            'date'               => $today,
            'arrivals'           => $map($arrivals),
            'departures'         => $map($departures),
            'in_house'           => $map($inHouse),
            'no_show_candidates' => $map($noShows),
            'counts'             => [
                'arrivals'           => $arrivals->count(),
                'arrivals_pending'   => $pendingArrivals,
                'departures'         => $departures->count(),
                'in_house'           => $inHouse->count(),
                'no_show_candidates' => $noShows->count(),
            ],
        ]);
    }

    // ------------------------------------------------------------------

    private function bookingQuery(): Builder
    {
        return Booking::query()
            ->with([self::GUEST_COLUMNS, 'room:id,room_number,name,bed_type,status'])
            ->withCount('companions')
            ->withSum('charges as charges_sum', 'total')
            ->withSum(['payments as paid_sum' => function ($q) {
                $q->where('status', Payment::STATUS_COMPLETED)->where('amount', '>', 0);
            }], 'amount');
    }

    private function rackBooking(Booking $b): array
    {
        return [
            'id'           => $b->id,
            'code'         => $b->booking_code,
            'booking_code' => $b->booking_code,
            'guest_id'     => $b->guest_id,
            'guest_name'   => $b->guest ? trim($b->guest->name . ' ' . $b->guest->surname) : null,
            'check_in'     => substr((string) $b->check_in, 0, 10),
            'check_out'    => substr((string) $b->check_out, 0, 10),
            'status'       => $b->status,
            'total_amount' => round((float) $b->total_amount, 2),
            'vip'          => (bool) ($b->guest->is_vip ?? false),
            'blacklisted'  => (bool) ($b->guest->is_blacklisted ?? false),
        ];
    }

    private function todayBooking(Booking $b, ?array $precheck): array
    {
        $balance = round((float) $b->total_amount + (float) ($b->charges_sum ?? 0) - (float) ($b->paid_sum ?? 0), 2);

        return [
            'id'               => $b->id,
            'booking_code'     => $b->booking_code,
            'status'           => $b->status,
            'check_in'         => substr((string) $b->check_in, 0, 10),
            'check_out'        => substr((string) $b->check_out, 0, 10),
            'total_amount'     => round((float) $b->total_amount, 2),
            'balance'          => $balance,
            'companions_count' => (int) ($b->companions_count ?? 0),
            'room'             => $b->room ? [
                'id'          => $b->room->id,
                'room_number' => $b->room->room_number,
                'name'        => $b->room->name,
                'bed_type'    => $b->room->bed_type,
                'status'      => $b->room->status,
            ] : null,
            'guest'            => $b->guest ? [
                'id'               => $b->guest->id,
                'name'             => $b->guest->name,
                'surname'          => $b->guest->surname,
                'document_type'    => $b->guest->document_type,
                'document_number'  => $b->guest->document_number,
                'email'            => $b->guest->email,
                'phone'            => $b->guest->phone,
                'notes'            => $b->guest->notes,
                'preferences'      => $b->guest->preferences ?? [],
                'is_vip'           => (bool) $b->guest->is_vip,
                'is_blacklisted'   => (bool) $b->guest->is_blacklisted,
                'blacklist_reason' => $b->guest->blacklist_reason,
            ] : null,
            'pre_check_in'     => $precheck,
        ];
    }

    /**
     * Datos de pre check-in (SHE-036, otro equipo) si la tabla existe.
     *
     * @return array<int, array>
     */
    private function prechecksFor(array $bookingIds): array
    {
        if (empty($bookingIds) || !class_exists(BookingPrecheck::class) || !Schema::hasTable('booking_prechecks')) {
            return [];
        }

        return BookingPrecheck::whereIn('booking_id', $bookingIds)
            ->get()
            ->keyBy('booking_id')
            ->map(fn ($p) => $p->toArray())
            ->all();
    }

    /** Piso derivado del número de habitación (101 → 1, 1203 → 12, "A12" → 0). */
    public static function floorOf(?string $roomNumber): int
    {
        $digits = preg_replace('/\D/', '', (string) $roomNumber);
        if ($digits === '') {
            return 0;
        }

        return strlen($digits) >= 3 ? (int) substr($digits, 0, strlen($digits) - 2) : 0;
    }

    private static function numericNumber(?string $roomNumber): int
    {
        $digits = preg_replace('/\D/', '', (string) $roomNumber);

        return $digits === '' ? PHP_INT_MAX : (int) $digits;
    }
}
