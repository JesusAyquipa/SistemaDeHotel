<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SHE-034: temporadas por tipo de habitación (null = todos los tipos).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seasons', function (Blueprint $table) {
            $table->foreignId('room_type_id')->nullable()->after('rate_adjustment')
                ->constrained('room_types')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('seasons', function (Blueprint $table) {
            $table->dropConstrainedForeignId('room_type_id');
        });
    }
};
