<?php

namespace App\Mail;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Invitación a dejar una reseña tras el check-out (SHE-037).
 */
class ReviewRequestMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public Booking $booking;
    public string $reviewUrl;

    public function __construct(Booking $booking)
    {
        // Se envía por la cola y solo después de confirmar la transacción (SHE-038).
        $this->afterCommit();
        $this->booking = $booking;
        $this->reviewUrl = config('app.frontend_url') . '/cliente/mis-reservas/' . rawurlencode($booking->booking_code) . '#resena';
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '¿Cómo fue tu estadía? - ' . config('hotel.name'),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.bookings.review_request',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
