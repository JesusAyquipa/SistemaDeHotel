<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('app:send-checkin-reminders')->dailyAt('08:00');

// Libera habitaciones retenidas por reservas pending_payment vencidas (y sus cupones).
Schedule::command('app:expire-pending-bookings')->everyFiveMinutes()->withoutOverlapping();

// No-show (SHE-028): cada hora; marca las reservas confirmadas cuyo plazo de llegada
// (12:00 del día siguiente al check-in + no_show_grace_hours) ya venció.
Schedule::command('app:mark-no-shows')->hourly()->withoutOverlapping();
