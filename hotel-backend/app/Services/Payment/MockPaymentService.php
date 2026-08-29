<?php

namespace App\Services\Payment;

use Illuminate\Support\Str;

/**
 * Pasarela de pago simulada para desarrollo y testing.
 * Emula el comportamiento de Stripe PaymentIntents sin necesidad de
 * credenciales externas ni conexión a servicios de terceros.
 *
 * Tarjetas de prueba:
 *   - 4242 4242 4242 4242  → Visa aprobada
 *   - 5555 5555 5555 4444  → Mastercard aprobada
 *   - 4000 0000 0000 0002  → Tarjeta rechazada
 *   - 4000 0000 0000 9995  → Fondos insuficientes
 */
class MockPaymentService implements PaymentGatewayInterface
{
    /**
     * Tarjetas de prueba con sus comportamientos predefinidos.
     */
    private const TEST_CARDS = [
        '4242424242424242' => ['status' => 'succeeded', 'brand' => 'Visa',       'decline_reason' => null],
        '5555555555554444' => ['status' => 'succeeded', 'brand' => 'Mastercard', 'decline_reason' => null],
        '4000000000000002' => ['status' => 'failed',    'brand' => 'Visa',       'decline_reason' => 'card_declined'],
        '4000000000009995' => ['status' => 'failed',    'brand' => 'Visa',       'decline_reason' => 'insufficient_funds'],
    ];

    /**
     * {@inheritdoc}
     */
    public function createPaymentIntent(float $amount, string $currency, array $metadata = []): array
    {
        $transactionId = 'sim_pi_' . strtolower(Str::random(24));

        return [
            'client_secret'  => 'sim_secret_' . strtolower(Str::random(24)),
            'transaction_id' => $transactionId,
            'provider'       => $this->getProviderName(),
            'amount'         => $amount,
            'currency'       => $currency,
            'status'         => 'requires_payment_method',
            'metadata'       => $metadata,
        ];
    }

    /**
     * Procesa un pago simulado con una tarjeta de prueba.
     *
     * @param string $cardNumber  Número de tarjeta (sin espacios ni guiones)
     * @param string $expiry      Fecha de vencimiento (MM/YY)
     * @param string $cvc         Código de seguridad (3 o 4 dígitos)
     * @param float  $amount      Monto a cobrar
     * @param string $currency    Moneda ISO 4217
     * @param array  $metadata    Datos adicionales
     * @return array Resultado del pago simulado
     */
    public function processPayment(
        string $cardNumber,
        string $expiry,
        string $cvc,
        float $amount,
        string $currency,
        array $metadata = []
    ): array {
        // Limpiar número de tarjeta (remover espacios y guiones)
        $cleanCard = preg_replace('/[\s\-]/', '', $cardNumber);

        // Buscar comportamiento predefinido de la tarjeta
        $testCard = self::TEST_CARDS[$cleanCard] ?? null;

        // Si no es una tarjeta de test conocida, aprobar por defecto en modo simulación
        if (!$testCard) {
            $testCard = ['status' => 'succeeded', 'brand' => 'Visa', 'decline_reason' => null];
        }

        $transactionId = 'sim_pi_' . strtolower(Str::random(24));
        $last4 = substr($cleanCard, -4);

        if ($testCard['status'] === 'failed') {
            return [
                'success'        => false,
                'transaction_id' => $transactionId,
                'provider'       => $this->getProviderName(),
                'status'         => 'failed',
                'decline_reason' => $testCard['decline_reason'],
                'message'        => $this->getDeclineMessage($testCard['decline_reason']),
            ];
        }

        return [
            'success'        => true,
            'transaction_id' => $transactionId,
            'provider'       => $this->getProviderName(),
            'status'         => 'succeeded',
            'amount'         => $amount,
            'currency'       => $currency,
            'payment_details' => [
                'brand'          => $testCard['brand'],
                'last4'          => $last4,
                'exp_month'      => substr($expiry, 0, 2),
                'exp_year'       => '20' . substr($expiry, -2),
                'authorized_at'  => now()->toIso8601String(),
            ],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function verifyWebhookSignature(string $payload, string $signatureHeader): array
    {
        // En modo simulación, siempre valida la firma (no hay verificación criptográfica real)
        $data = json_decode($payload, true);

        if (!$data || !isset($data['type'])) {
            throw new \Exception('Payload de webhook simulado inválido.');
        }

        return $data;
    }

    /**
     * {@inheritdoc}
     */
    public function getProviderName(): string
    {
        return 'simulation';
    }

    /**
     * Traduce razones de rechazo a mensajes legibles en español.
     */
    private function getDeclineMessage(string $reason): string
    {
        return match ($reason) {
            'card_declined'      => 'La tarjeta fue rechazada. Por favor, intenta con otra tarjeta.',
            'insufficient_funds' => 'Fondos insuficientes. Verifica tu saldo e intenta nuevamente.',
            default              => 'El pago no pudo ser procesado. Intenta con otro método de pago.',
        };
    }
}
