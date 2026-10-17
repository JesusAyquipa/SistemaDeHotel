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

            // Sin fallback silencioso: un valor desconocido es un error de configuración.
            return match ($gateway) {
                'stripe'                => new StripePaymentService(),
                'simulation', 'mock'    => new MockPaymentService(),
                default => throw new \RuntimeException(
                    "PAYMENT_GATEWAY='{$gateway}' no es válido. Valores permitidos: simulation, stripe."
                ),
            };
        });
    }

    public function boot(): void
    {
        //
    }
}
