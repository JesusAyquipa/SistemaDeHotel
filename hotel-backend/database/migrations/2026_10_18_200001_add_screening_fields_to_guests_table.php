<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SHE-033: notas, preferencias, VIP y lista negra de huéspedes.
 * (`notes` ya existe en la tabla original; solo se crea si faltara.)
 */
return new class extends Migration
{
    public function up(): void
    {
        $hasNotes = Schema::hasColumn('guests', 'notes');

        Schema::table('guests', function (Blueprint $table) use ($hasNotes) {
            if (!$hasNotes) {
                $table->text('notes')->nullable();
            }
            $table->json('preferences')->nullable();
            $table->boolean('is_vip')->default(false)->index();
            $table->boolean('is_blacklisted')->default(false)->index();
            $table->string('blacklist_reason', 500)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            $table->dropIndex(['is_vip']);
            $table->dropIndex(['is_blacklisted']);
            $table->dropColumn(['preferences', 'is_vip', 'is_blacklisted', 'blacklist_reason']);
        });
    }
};
