<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // SHE-026: máx. 3 códigos cada 10 minutos por correo + IP.
        RateLimiter::for('booking-verification-send', function (Request $request) {
            $email = mb_strtolower(trim((string) $request->input('email', '')));

            return Limit::perMinutes(10, 3)->by(hash('sha256', $email) . '|' . $request->ip());
        });
    }
}
