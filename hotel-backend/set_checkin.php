<?php
$booking = App\Models\Booking::with('room')->where('status','confirmed')->first();
if ($booking) {
    $booking->update(['status' => 'checked_in']);
    $booking->room->update(['status' => 'ocupada']);
    echo 'OK: Booking ID=' . $booking->id . ' Room=' . $booking->room->room_number . ' ahora en checked_in/ocupada';
} else {
    echo 'No hay reservas confirmadas';
}
