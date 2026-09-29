<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

\App\Models\Guest::where('email', 'arnie.7u7@gmail.com')->update(['email' => 'jesusayquipa789@gmail.com']);
\App\Models\User::where('email', 'arnie.7u7@gmail.com')->update(['email' => 'jesusayquipa789@gmail.com']);

echo 'OK';
