<?php

namespace App\Mail;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CheckInReminderMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $booking;

    /** Enlace al pre check-in online del portal del cliente (SHE-036). */
    public string $preCheckInUrl;

    /**
     * Create a new message instance.
     */
    public function __construct(Booking $booking)
    {
        // Se envía por la cola y solo después de confirmar la transacción (SHE-038).
        $this->afterCommit();
        $this->booking = $booking;
        $this->preCheckInUrl = config('app.frontend_url') . '/cliente/mis-reservas/' . rawurlencode((string) $booking->booking_code) . '#pre-check-in';
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Recordatorio de Check-in - ' . config('hotel.name'),
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.bookings.reminder',
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
