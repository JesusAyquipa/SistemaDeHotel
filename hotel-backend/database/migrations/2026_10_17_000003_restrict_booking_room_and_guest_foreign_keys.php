<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Borrar una habitación o un huésped ya NO elimina en cascada su historial de reservas
 * (y con ello pagos y cargos). Ahora la FK es RESTRICT: eliminar una habitación/huésped
 * con reservas falla con error de integridad. payments/charges mantienen cascade sobre booking.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign(['room_id']);
            $table->dropForeign(['guest_id']);
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->foreign('room_id')->references('id')->on('rooms')->restrictOnDelete();
            $table->foreign('guest_id')->references('id')->on('guests')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign(['room_id']);
            $table->dropForeign(['guest_id']);
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->foreign('room_id')->references('id')->on('rooms')->cascadeOnDelete();
            $table->foreign('guest_id')->references('id')->on('guests')->cascadeOnDelete();
        });
    }
};
