<?php

namespace App\Services\Payment;

/**
 * Implementación de la pasarela Stripe.
 *
 * Requiere el paquete stripe/stripe-php (composer require stripe/stripe-php) y
 * STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET. Si el SDK no está instalado se lanza
 * una excepción explícita: NO se hace fallback silencioso al simulador.
 */
class StripePaymentService implements PaymentGatewayInterface
{
    private string $secretKey;
    private string $webhookSecret;

    public function __construct()
    {
        if (!class_exists('\Stripe\Stripe')) {
            throw new \RuntimeException(
                'PAYMENT_GATEWAY=stripe pero el paquete stripe/stripe-php no está instalado. Ejecuta: composer require stripe/stripe-php'
            );
        }

        $this->secretKey = (string) config('services.stripe.secret', '');
        $this->webhookSecret = (string) config('services.stripe.webhook_secret', '');

        if ($this->secretKey === '') {
            throw new \RuntimeException('PAYMENT_GATEWAY=stripe requiere STRIPE_SECRET_KEY configurado.');
        }
    }

    /**
     * {@inheritdoc}
     */
    public function createPaymentIntent(float $amount, string $currency, array $metadata = []): array
    {
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
     * Stripe no permite (ni es PCI-compliant) enviar el PAN desde nuestro servidor:
     * el cobro debe completarse en el cliente con Stripe Elements + PaymentIntent.
     */
    public function processPayment(
        string $cardNumber,
        string $expiry,
        string $cvc,
        float $amount,
        string $currency,
        array $metadata = []
    ): array {
        throw new \RuntimeException('El cobro directo con tarjeta no está soportado con Stripe; use PaymentIntents desde el cliente.');
    }

    /**
     * {@inheritdoc}
     */
    public function verifyWebhookSignature(string $payload, string $signatureHeader): array
    {
        if ($this->webhookSecret === '') {
            throw new \RuntimeException('STRIPE_WEBHOOK_SECRET no configurado.');
        }

        try {
            $event = \Stripe\Webhook::constructEvent($payload, $signatureHeader, $this->webhookSecret);
        } catch (\Throwable $e) {
            throw new \RuntimeException('Firma de webhook de Stripe inválida.');
        }

        return [
            'type' => $event->type,
            'data' => $event->data->object->toArray(),
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function getProviderName(): string
    {
        return 'stripe';
    }
}
