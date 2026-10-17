<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pre check-in online del huésped (SHE-036).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_prechecks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained('bookings')->cascadeOnDelete();
            $table->string('arrival_time', 5)->nullable();
            $table->string('document_type', 50);
            $table->string('document_number', 50);
            $table->string('nationality', 100)->nullable();
            $table->string('address', 255)->nullable();
            $table->json('companions')->nullable();
            $table->text('special_requests')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_prechecks');
    }
};
