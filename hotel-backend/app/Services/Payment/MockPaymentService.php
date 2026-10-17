<?php

namespace App\Services\Payment;

use Illuminate\Support\Str;

/**
 * Pasarela de pago simulada (el sistema es una demo y la usa también en producción).
 * Emula el comportamiento de Stripe PaymentIntents sin credenciales externas.
 *
 * Reglas: número Luhn-válido, vencimiento futuro y CVC de 3-4 dígitos.
 *
 * Tarjetas de prueba:
 *   - 4242 4242 4242 4242  → Visa aprobada
 *   - 5555 5555 5555 4444  → Mastercard aprobada
 *   - 4000 0000 0000 0002  → Tarjeta rechazada
 *   - 4000 0000 0000 9995  → Fondos insuficientes
 *   - Cualquier otra tarjeta Luhn-válida → aprobada
 *
 * Webhooks: header X-Signature = hex(hmac_sha256(raw body, services.payment.webhook_secret)).
 */
class MockPaymentService implements PaymentGatewayInterface
{
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
        return [
            'client_secret'  => 'sim_secret_' . strtolower(Str::random(24)),
            'transaction_id' => 'sim_pi_' . strtolower(Str::random(24)),
            'provider'       => $this->getProviderName(),
            'amount'         => $amount,
            'currency'       => $currency,
            'status'         => 'requires_payment_method',
            'metadata'       => $metadata,
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function processPayment(
        string $cardNumber,
        string $expiry,
        string $cvc,
        float $amount,
        string $currency,
        array $metadata = []
    ): array {
        $cleanCard = CardValidator::normalizeNumber($cardNumber);
        $transactionId = 'sim_pi_' . strtolower(Str::random(24));

        if (!CardValidator::luhnValid($cleanCard)) {
            return $this->failure($transactionId, 'invalid_number');
        }
        if (!CardValidator::expiryValid($expiry)) {
            return $this->failure($transactionId, 'expired_card');
        }
        if (!CardValidator::cvcValid($cvc)) {
            return $this->failure($transactionId, 'invalid_cvc');
        }
        if ($amount <= 0) {
            return $this->failure($transactionId, 'invalid_amount');
        }

        $testCard = self::TEST_CARDS[$cleanCard] ?? [
            'status'         => 'succeeded',
            'brand'          => $this->detectBrand($cleanCard),
            'decline_reason' => null,
        ];

        if ($testCard['status'] === 'failed') {
            return $this->failure($transactionId, $testCard['decline_reason']);
        }

        return [
            'success'         => true,
            'transaction_id'  => $transactionId,
            'provider'        => $this->getProviderName(),
            'status'          => 'succeeded',
            'amount'          => $amount,
            'currency'        => $currency,
            'decline_reason'  => null,
            'message'         => null,
            'payment_details' => [
                'brand'         => $testCard['brand'],
                'last4'         => substr($cleanCard, -4),
                'authorized_at' => now()->toIso8601String(),
            ],
        ];
    }

    /**
     * Verificación HMAC-SHA256 en tiempo constante. Sin secreto configurado -> false.
     */
    public function isValidWebhookSignature(string $payload, ?string $signature): bool
    {
        $secret = (string) config('services.payment.webhook_secret', '');
        if ($secret === '' || $signature === null || $signature === '') {
            return false;
        }

        $expected = hash_hmac('sha256', $payload, $secret);

        return hash_equals($expected, strtolower(trim($signature)));
    }

    /**
     * {@inheritdoc}
     */
    public function verifyWebhookSignature(string $payload, string $signatureHeader): array
    {
        if (!$this->isValidWebhookSignature($payload, $signatureHeader)) {
            throw new \RuntimeException('Firma de webhook inválida.');
        }

        $data = json_decode($payload, true);
        if (!is_array($data) || !isset($data['type'])) {
            throw new \RuntimeException('Payload de webhook inválido.');
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

    private function failure(string $transactionId, string $reason): array
    {
        return [
            'success'         => false,
            'transaction_id'  => $transactionId,
            'provider'        => $this->getProviderName(),
            'status'          => 'failed',
            'decline_reason'  => $reason,
            'message'         => $this->getDeclineMessage($reason),
            'payment_details' => [],
        ];
    }

    private function detectBrand(string $number): string
    {
        return match (true) {
            str_starts_with($number, '4')                    => 'Visa',
            (bool) preg_match('/^(5[1-5]|2[2-7])/', $number) => 'Mastercard',
            (bool) preg_match('/^3[47]/', $number)           => 'Amex',
            default                                          => 'Tarjeta',
        };
    }

    private function getDeclineMessage(string $reason): string
    {
        return match ($reason) {
            'card_declined'      => 'La tarjeta fue rechazada. Por favor, intenta con otra tarjeta.',
            'insufficient_funds' => 'Fondos insuficientes. Verifica tu saldo e intenta nuevamente.',
            'invalid_number'     => 'El número de tarjeta no es válido.',
            'expired_card'       => 'La tarjeta está vencida.',
            'invalid_cvc'        => 'El código de seguridad (CVC) no es válido.',
            default              => 'El pago no pudo ser procesado. Intenta con otro método de pago.',
        };
    }
}
