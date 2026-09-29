<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

\App\Models\User::query()->update(['password' => \Illuminate\Support\Facades\Hash::make('password')]);

echo 'OK';
