<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('cash_register_session_id')
                ->nullable()
                ->after('cash_register_closure_id')
                ->constrained('cash_register_sessions')
                ->nullOnDelete();
            $table->index('cash_register_session_id');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['cash_register_session_id']);
            $table->dropIndex(['cash_register_session_id']);
            $table->dropColumn('cash_register_session_id');
        });
    }
};
