<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Room;
use Carbon\Carbon;

class ReportController extends Controller
{
    /**
     * Dashboard statistics for reports
     */
    public function dashboard(Request $request): JsonResponse
    {
        $range = $request->query('dateRange', '30_days');
        $now = Carbon::now();

        switch ($range) {
            case 'this_month':
                $startDate = $now->copy()->startOfMonth();
                $endDate = $now->copy()->endOfMonth();
                break;
            case 'last_month':
                $startDate = $now->copy()->subMonth()->startOfMonth();
                $endDate = $now->copy()->subMonth()->endOfMonth();
                break;
            case 'ytd':
                $startDate = $now->copy()->startOfYear();
                $endDate = $now->copy()->endOfYear();
                break;
            case '30_days':
            default:
                $startDate = $now->copy()->subDays(30);
                $endDate = $now->copy();
                break;
        }

        $daysInRange = $startDate->diffInDays($endDate) + 1;
        if ($daysInRange <= 0) $daysInRange = 1;

        // 1. Gross Revenue
        $grossRevenue = Payment::whereBetween('created_at', [$startDate, $endDate])
                                ->where('status', 'completed')
                                ->sum('amount');

        // 2. Total Bookings
        $totalBookings = Booking::whereBetween('created_at', [$startDate, $endDate])->count();

        // 3. Occupancy Rate
        $totalRooms = Room::count();
        $totalAvailableNights = $totalRooms * $daysInRange;
        
        // Sum nights of bookings that overlap with the date range
        // For simplicity, we just count the bookings created in the range
        // or actually calculate check_in and check_out difference.
        $bookingsInRange = Booking::where(function($q) use ($startDate, $endDate) {
            $q->whereBetween('check_in', [$startDate, $endDate])
              ->orWhereBetween('check_out', [$startDate, $endDate]);
        })->whereNotIn('status', ['cancelled'])->get();

        $occupiedNights = 0;
        foreach ($bookingsInRange as $booking) {
            $bStart = Carbon::parse($booking->check_in);
            $bEnd = Carbon::parse($booking->check_out);
            
            // Limit to the selected range
            if ($bStart->lt($startDate)) $bStart = $startDate->copy();
            if ($bEnd->gt($endDate)) $bEnd = $endDate->copy();
            
            if ($bEnd->gt($bStart)) {
                $occupiedNights += $bStart->diffInDays($bEnd);
            }
        }

        $occupancyRate = $totalAvailableNights > 0 
            ? round(($occupiedNights / $totalAvailableNights) * 100, 1) 
            : 0;

        // 4. Occupancy Chart Data
        $chartData = [];
        $current = $startDate->copy();
        while ($current->lte($endDate)) {
            $dateStr = $current->format('Y-m-d');
            
            // Count rooms occupied on this specific day
            $occupiedToday = Booking::where('check_in', '<=', $dateStr)
                                    ->where('check_out', '>', $dateStr)
                                    ->whereNotIn('status', ['cancelled'])
                                    ->count();
                                    
            $chartData[] = [
                'date' => $current->format('d M'),
                'occupancy' => $totalRooms > 0 ? round(($occupiedToday / $totalRooms) * 100, 1) : 0,
                'occupied_rooms' => $occupiedToday
            ];
            $current->addDay();
        }

        // Reduce chart data points if it's a large range to avoid heavy payloads
        if (count($chartData) > 31) {
            // Group by week or month depending on size
            // For YTD, group by month
            if ($range === 'ytd') {
                $monthlyData = [];
                foreach ($chartData as $data) {
                    // $data['date'] is "d M", e.g., "01 Jan"
                    $month = explode(' ', $data['date'])[1];
                    if (!isset($monthlyData[$month])) {
                        $monthlyData[$month] = ['count' => 0, 'sum' => 0];
                    }
                    $monthlyData[$month]['count']++;
                    $monthlyData[$month]['sum'] += $data['occupancy'];
                }
                $chartData = [];
                foreach ($monthlyData as $month => $stats) {
                    $chartData[] = [
                        'date' => $month,
                        'occupancy' => round($stats['sum'] / $stats['count'], 1)
                    ];
                }
            }
        }

        // 5. Transactions for the table
        $transactions = Payment::with(['booking'])
                                ->whereBetween('created_at', [$startDate, $endDate])
                                ->orderBy('created_at', 'desc')
                                ->take(50)
                                ->get()
                                ->map(function($payment) {
                                    return [
                                        'id' => $payment->id,
                                        'date' => Carbon::parse($payment->created_at)->format('d M Y'),
                                        'staff' => 'Sistema / Online', // In a real app, this could be the logged-in staff ID if manual
                                        'amount' => $payment->amount,
                                        'status' => $payment->status,
                                        'booking_code' => $payment->booking ? $payment->booking->booking_code : 'N/A'
                                    ];
                                });

        return response()->json([
            'occupancy_rate' => $occupancyRate,
            'gross_revenue' => $grossRevenue,
            'total_bookings' => $totalBookings,
            'chart_data' => $chartData,
            'transactions' => $transactions,
            'startDate' => $startDate->format('Y-m-d'),
            'endDate' => $endDate->format('Y-m-d')
        ]);
    }

    /**
     * Close Register logic
     */
    public function closeRegister(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cash_amount' => 'required|numeric',
            'voucher_amount' => 'required|numeric',
            'expected_amount' => 'required|numeric',
            'difference' => 'required|numeric'
        ]);

        // In a real application, you would save this to a `CashRegisters` or `Shifts` table.
        // For this task, we will simulate the successful operation.
        
        // Log the register close
        \Log::info('Cierre de caja realizado', [
            'user_id' => $request->user()->id,
            'data' => $validated
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cierre de caja registrado exitosamente.',
            'receipt' => [
                'date' => Carbon::now()->format('Y-m-d H:i:s'),
                'staff' => $request->user()->name,
                'difference' => $validated['difference']
            ]
        ]);
    }
}
