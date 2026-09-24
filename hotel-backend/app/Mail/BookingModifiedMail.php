<?php

namespace App\Mail;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BookingModifiedMail extends Mailable
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
            subject: 'Modificación de Reserva - The Grand Ledger',
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
