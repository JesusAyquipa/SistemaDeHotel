<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$user = \App\Models\User::where('email', 'arnie.7u7@gmail.com')->first();
if ($user) {
    $user->assignRole('cliente');
    echo 'Role assigned';
}
