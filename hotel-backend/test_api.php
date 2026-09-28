<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$booking = \App\Models\Booking::find(1);
$charge = \App\Models\Charge::create([
    'booking_id' => $booking->id,
    'date' => '2026-09-28',
    'concept' => 'Frigobar - Agua',
    'quantity' => 1,
    'unit_price' => 5.00,
    'total' => 5.00
]);
echo "Charge Created: " . $charge->id . "\n";
echo "Charge Json: " . json_encode($charge) . "\n";

$charges = \App\Models\Charge::where('booking_id', 1)->get();
echo "Charges Count: " . $charges->count() . "\n";
