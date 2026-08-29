<?php

namespace App\Services\Payment;

/**
 * Interfaz unificada para pasarelas de pago.
 * Permite intercambiar entre Stripe, Mercado Pago, o el simulador
 * sin modificar la lógica de negocio del hotel (Patrón Strategy).
 */
interface PaymentGatewayInterface
{
    /**
     * Crea una intención de pago en la pasarela.
     *
     * @param float  $amount   Monto total a cobrar
     * @param string $currency Código de moneda ISO 4217 (ej: PEN, USD)
     * @param array  $metadata Datos adicionales (booking_code, guest_email, etc.)
     * @return array ['client_secret' => string, 'transaction_id' => string, 'provider' => string]
     */
    public function createPaymentIntent(float $amount, string $currency, array $metadata = []): array;

    /**
     * Verifica la firma de un webhook recibido de la pasarela.
     *
     * @param string $payload       Body raw del request
     * @param string $signatureHeader Valor del header de firma (ej: Stripe-Signature)
     * @return array Evento parseado y validado
     * @throws \Exception Si la firma no es válida
     */
    public function verifyWebhookSignature(string $payload, string $signatureHeader): array;

    /**
     * Retorna el nombre del proveedor de la pasarela.
     */
    public function getProviderName(): string;
}
