<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_verifications', function (Blueprint $table) {
            $table->id();
            $table->string('email', 150)->index();
            $table->string('code_hash', 64)->nullable();            // HMAC del código de 6 dígitos
            $table->timestamp('code_expires_at')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->string('token_hash', 64)->nullable()->unique(); // SHA-256 del token
            $table->timestamp('token_expires_at')->nullable();
            $table->timestamp('consumed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_verifications');
    }
};
