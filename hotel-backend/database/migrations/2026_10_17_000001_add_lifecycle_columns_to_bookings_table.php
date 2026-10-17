<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Columnas de ciclo de vida/precio de reservas:
 *  - expires_at: vencimiento de la retención pending_payment (now()+30 min)
 *  - coupon_id / discount_amount / coupon_counted: cupón aplicado y si su uso ya se contabilizó
 *  - pricing_details: desglose de precios (noches, temporadas, cupón, IGV incluido)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->timestamp('expires_at')->nullable()->after('status');
            $table->foreignId('coupon_id')->nullable()->after('expires_at')
                ->constrained('coupons')->nullOnDelete();
            $table->decimal('discount_amount', 10, 2)->default(0)->after('coupon_id');
            $table->boolean('coupon_counted')->default(false)->after('discount_amount');
            $table->json('pricing_details')->nullable()->after('coupon_counted');

            $table->index(['room_id', 'status', 'check_in', 'check_out'], 'bookings_availability_idx');
            $table->index(['status', 'expires_at'], 'bookings_status_expires_idx');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex('bookings_availability_idx');
            $table->dropIndex('bookings_status_expires_idx');
            $table->dropConstrainedForeignId('coupon_id');
            $table->dropColumn(['expires_at', 'discount_amount', 'coupon_counted', 'pricing_details']);
        });
    }
};
