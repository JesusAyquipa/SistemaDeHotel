<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            // Estructura base inicial (los campos se agregarán en los siguientes Sprints)
            $table->string('room_number')->unique();
            $table->string('room_type'); // ej: Simple, Doble, Suite
            $table->decimal('price_per_night', 10, 2);
            $table->string('status')->default('available'); // available, occupied, maintenance
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rooms');
    }
};
