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
            $table->string('room_number')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('bed_type');           // individual, doble, king
            $table->integer('capacity');           // número de huéspedes
            $table->integer('size_m2')->nullable(); // metros cuadrados
            $table->decimal('price_per_night', 8, 2);
            $table->string('image_url')->nullable();
            $table->string('status')->default('disponible'); // disponible, mantenimiento, inactiva
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
