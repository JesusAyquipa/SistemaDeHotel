<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Booking;
use Carbon\Carbon;
use Illuminate\Support\Facades\Mail;
use App\Mail\CheckInReminderMail;
use Illuminate\Support\Facades\Log;

class SendCheckInReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:send-checkin-reminders';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Envía correos electrónicos de recordatorio a los huéspedes con check-in programado para mañana.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Iniciando el envío de recordatorios de check-in...');
        
        $tomorrowDate = Carbon::tomorrow()->toDateString();
        
        // Buscar reservas confirmadas cuyo check_in sea exactamente mañana
        $bookings = Booking::with(['guest', 'room'])
            ->whereDate('check_in', $tomorrowDate)
            ->where('status', 'confirmed')
            ->get();
            
        if ($bookings->isEmpty()) {
            $this->info("No hay reservas confirmadas para check-in mañana ({$tomorrowDate}).");
            return 0;
        }
        
        $count = 0;
        
        foreach ($bookings as $booking) {
            try {
                Mail::to($booking->guest->email)->send(new CheckInReminderMail($booking));
                $count++;
                $this->line("Recordatorio enviado a {$booking->guest->email} (Reserva: {$booking->booking_code})");
            } catch (\Exception $e) {
                Log::error("Error al enviar recordatorio a {$booking->guest->email}: " . $e->getMessage());
                $this->error("Fallo al enviar a {$booking->guest->email}.");
            }
        }
        
        $this->info("Proceso completado. Se enviaron {$count} recordatorios.");
        return 0;
    }
}
