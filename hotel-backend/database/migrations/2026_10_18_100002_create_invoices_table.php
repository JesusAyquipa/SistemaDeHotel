<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Comprobantes internos (boleta/factura) — SHE-027. NO se envían a SUNAT.
 * invoice_series guarda el correlativo de cada serie (fila bloqueada al emitir).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_series', function (Blueprint $table) {
            $table->string('series', 4)->primary();
            $table->unsignedInteger('last_number')->default(0);
            $table->timestamps();
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->restrictOnDelete();
            $table->string('type', 10);                 // boleta | factura
            $table->string('series', 4);                // B001 | F001
            $table->unsignedInteger('number');          // correlativo por serie
            $table->string('customer_doc_type', 3);     // DNI | RUC | CE | PAS
            $table->string('customer_doc_number', 20);
            $table->string('customer_name', 200);
            $table->string('customer_address', 255)->nullable();
            $table->decimal('subtotal', 10, 2);         // base imponible
            $table->decimal('igv', 10, 2);
            $table->decimal('total', 10, 2);
            $table->json('items');
            $table->timestamp('issued_at');
            $table->string('status', 10)->default('issued'); // issued | voided
            $table->string('voided_reason', 255)->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['series', 'number']);
            $table->index(['booking_id', 'status']);
            $table->index('issued_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('invoice_series');
    }
};
