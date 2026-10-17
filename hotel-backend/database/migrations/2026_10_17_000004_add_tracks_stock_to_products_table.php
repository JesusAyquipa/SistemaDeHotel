<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Los servicios (spa, lavandería, comidas, transporte, late check-out) no tienen stock
 * físico: antes se simulaba con stock = 999. tracks_stock = false los excluye del control.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('tracks_stock')->default(true)->after('stock');
        });

        DB::table('products')
            ->whereIn('category', ['servicios_spa', 'lavanderia'])
            ->orWhere('stock', '>=', 999)
            ->update(['tracks_stock' => false]);
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('tracks_stock');
        });
    }
};
