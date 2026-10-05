<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$user = \App\Models\User::firstOrCreate(
    ['email' => 'arnie.7u7@gmail.com'],
    [
        'name' => 'arnie adriano',
        'password' => \Illuminate\Support\Facades\Hash::make('password'),
        'is_active' => true,
    ]
);

\App\Models\Guest::where('id', 2)->update(['user_id' => $user->id]);
echo 'User arnie created and linked';
