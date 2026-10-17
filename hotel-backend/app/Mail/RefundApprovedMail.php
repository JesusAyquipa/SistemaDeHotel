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
 * Aviso al huésped de que su reembolso fue aprobado y procesado (SHE-029).
 */
class RefundApprovedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Booking $booking,
        public float $amount,
        public string $methodLabel,
        public ?string $reference = null,
    ) {
        // Se envía por la cola y solo después de confirmar la transacción (SHE-038).
        $this->afterCommit();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reembolso procesado - ' . $this->booking->booking_code,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.bookings.refund_approved',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
