<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * SHE-034 / SHE-035: rooms.room_type_id, comodidades extra por habitación y
 * price_per_night pasa a ser un override opcional (precio efectivo =
 * override ?? tarifa base del tipo, ver Room::effective_price).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->foreignId('room_type_id')->nullable()->after('id')
                ->constrained('room_types')->restrictOnDelete();
            $table->json('extra_amenities')->nullable()->after('image_url');
        });

        Schema::table('rooms', function (Blueprint $table) {
            $table->decimal('price_per_night', 8, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        // Antes de volver a NOT NULL se materializa el precio efectivo.
        DB::statement('UPDATE rooms SET price_per_night = COALESCE(price_per_night, (SELECT base_price FROM room_types WHERE room_types.id = rooms.room_type_id), 0)');

        Schema::table('rooms', function (Blueprint $table) {
            $table->decimal('price_per_night', 8, 2)->nullable(false)->change();
        });

        Schema::table('rooms', function (Blueprint $table) {
            $table->dropConstrainedForeignId('room_type_id');
            $table->dropColumn('extra_amenities');
        });
    }
};
