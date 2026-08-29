<?php

namespace App\Services\Payment;

/**
 * Implementación de la pasarela Stripe.
 * Utiliza la API de Stripe para crear PaymentIntents y verificar webhooks.
 *
 * NOTA: Esta implementación requiere el paquete stripe/stripe-php
 * y las siguientes variables de entorno:
 *   - STRIPE_SECRET_KEY
 *   - STRIPE_WEBHOOK_SECRET
 *
 * Para instalar: composer require stripe/stripe-php
 *
 * IMPORTANTE: Esta clase está preparada para producción pero actualmente
 * el sistema opera con MockPaymentService (simulador) por defecto.
 * Para activar Stripe, cambiar PAYMENT_GATEWAY=stripe en el .env
 * e instalar las dependencias correspondientes.
 */
class StripePaymentService implements PaymentGatewayInterface
{
    private string $secretKey;
    private string $webhookSecret;

    public function __construct()
    {
        $this->secretKey = config('services.stripe.secret', '');
        $this->webhookSecret = config('services.stripe.webhook_secret', '');
    }

    /**
     * {@inheritdoc}
     */
    public function createPaymentIntent(float $amount, string $currency, array $metadata = []): array
    {
        // Verificar que Stripe SDK esté disponible
        if (!class_exists('\Stripe\Stripe')) {
            throw new \RuntimeException(
                'El paquete stripe/stripe-php no está instalado. Ejecuta: composer require stripe/stripe-php'
            );
        }

        \Stripe\Stripe::setApiKey($this->secretKey);

        $paymentIntent = \Stripe\PaymentIntent::create([
            'amount'   => (int) round($amount * 100), // Stripe trabaja en centavos
            'currency' => strtolower($currency),
            'metadata' => $metadata,
            'payment_method_types' => ['card'],
        ]);

        return [
            'client_secret'  => $paymentIntent->client_secret,
            'transaction_id' => $paymentIntent->id,
            'provider'       => $this->getProviderName(),
            'amount'         => $amount,
            'currency'       => $currency,
            'status'         => $paymentIntent->status,
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function verifyWebhookSignature(string $payload, string $signatureHeader): array
    {
        if (!class_exists('\Stripe\Webhook')) {
            throw new \RuntimeException('Stripe SDK no disponible para verificación de webhooks.');
        }

        try {
            $event = \Stripe\Webhook::constructEvent(
                $payload,
                $signatureHeader,
                $this->webhookSecret
            );

            return [
                'type' => $event->type,
                'data' => $event->data->object->toArray(),
            ];
        } catch (\Stripe\Exception\SignatureVerificationException $e) {
            throw new \Exception('Firma de webhook de Stripe inválida: ' . $e->getMessage());
        }
    }

    /**
     * {@inheritdoc}
     */
    public function getProviderName(): string
    {
        return 'stripe';
    }
}
