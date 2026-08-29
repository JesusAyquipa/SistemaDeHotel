<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Extiende la tabla payments con campos de pasarela de pago,
     * comprobante y detalles de transacción para el módulo de checkout.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            // ID de la transacción en la pasarela externa (ej: pi_xxx de Stripe)
            $table->string('transaction_id')->nullable()->after('status');
            // Proveedor de la pasarela utilizada
            $table->string('gateway_provider')->default('simulation')->after('transaction_id');
            // Moneda del pago (ISO 4217)
            $table->string('currency', 10)->default('PEN')->after('gateway_provider');
            // Número único de comprobante/recibo (ej: REC-202608-XXXX)
            $table->string('receipt_number')->unique()->nullable()->after('currency');
            // Detalles adicionales del pago en formato JSON
            // (últimos 4 dígitos, marca de tarjeta, fecha de autorización, etc.)
            $table->json('payment_details')->nullable()->after('receipt_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn([
                'transaction_id',
                'gateway_provider',
                'currency',
                'receipt_number',
                'payment_details',
            ]);
        });
    }
};
