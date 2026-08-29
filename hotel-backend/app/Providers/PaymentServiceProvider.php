<?php

namespace App\Providers;

use App\Services\Payment\MockPaymentService;
use App\Services\Payment\PaymentGatewayInterface;
use App\Services\Payment\StripePaymentService;
use Illuminate\Support\ServiceProvider;

/**
 * Registra la implementación de pasarela de pago según la configuración.
 * Permite alternar entre Stripe y el simulador mediante la variable de entorno PAYMENT_GATEWAY.
 */
class PaymentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PaymentGatewayInterface::class, function ($app) {
            $gateway = config('services.payment_gateway', 'simulation');

            return match ($gateway) {
                'stripe' => new StripePaymentService(),
                default  => new MockPaymentService(),
            };
        });
    }

    public function boot(): void
    {
        //
    }
}
