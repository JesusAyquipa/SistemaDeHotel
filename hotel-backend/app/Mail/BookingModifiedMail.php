<?php

namespace App\Mail;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BookingModifiedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $booking;
    public $modMessage;
    public $amountDifference;

    /**
     * Create a new message instance.
     */
    public function __construct(Booking $booking, string $modMessage = '', float $amountDifference = 0)
    {
        // Se envía por la cola y solo después de confirmar la transacción (SHE-038).
        $this->afterCommit();
        $this->booking = $booking;
        $this->modMessage = $modMessage;
        $this->amountDifference = $amountDifference;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Modificación de Reserva - ' . config('hotel.name'),
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.bookings.modified',
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
