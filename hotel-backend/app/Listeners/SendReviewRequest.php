<?php

namespace App\Listeners;

use App\Events\BookingCheckedOut;
use App\Mail\ReviewRequestMail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Tras el check-out, invita al huésped a dejar una reseña (SHE-037).
 */
class SendReviewRequest
{
    public function handle(BookingCheckedOut $event): void
    {
        $booking = $event->booking->loadMissing(['guest', 'room']);
        $email = $booking->guest->email ?? null;

        if (empty($email) || $booking->review()->exists()) {
            return;
        }

        try {
            Mail::to($email)->send(new ReviewRequestMail($booking));
        } catch (\Throwable $e) {
            Log::error('No se pudo enviar la invitación a reseña', ['booking_id' => $booking->id, 'error' => get_class($e)]);
        }
    }
}
