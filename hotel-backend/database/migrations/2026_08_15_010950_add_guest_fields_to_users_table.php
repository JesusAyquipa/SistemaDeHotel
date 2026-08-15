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
        Schema::table('users', function (Blueprint $table) {
            $table->string('surname')->nullable()->after('name');
            $table->string('document_type')->nullable()->after('surname');
            $table->string('document_number')->nullable()->after('document_type')->unique();
            $table->date('birth_date')->nullable()->after('document_number');
            $table->string('nationality')->nullable()->after('birth_date');
            $table->string('phone')->nullable()->after('nationality');
            $table->string('address')->nullable()->after('email');
            $table->text('notes')->nullable()->after('address');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'surname', 'document_type', 'document_number', 'birth_date', 
                'nationality', 'phone', 'address', 'notes'
            ]);
        });
    }
};
