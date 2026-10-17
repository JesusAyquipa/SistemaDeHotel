<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Registro persistente de cierres de caja y vínculo de cada pago conciliado con su cierre.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_register_closures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('closed_at');
            $table->json('totals');
            $table->decimal('expected_amount', 12, 2)->default(0);
            $table->decimal('counted_amount', 12, 2)->default(0);
            $table->decimal('difference', 12, 2)->default(0);
            $table->string('notes', 500)->nullable();
            $table->timestamps();

            $table->index('closed_at');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('cash_register_closure_id')->nullable()->after('is_reconciled')
                ->constrained('cash_register_closures')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cash_register_closure_id');
        });

        Schema::dropIfExists('cash_register_closures');
    }
};
