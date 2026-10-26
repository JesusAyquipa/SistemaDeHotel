<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_register_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->timestamp('opened_at');
            $table->decimal('opening_amount', 12, 2)->default(0);
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('cash_register_closure_id')->nullable()->constrained('cash_register_closures')->nullOnDelete();
            $table->enum('status', ['open', 'closed'])->default('open');
            $table->string('notes', 500)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index('opened_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_register_sessions');
    }
};
