<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Código de verificación de correo para reservas sin cuenta (SHE-026).
 */
class BookingVerificationCodeMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public string $code, public int $minutes = 10)
    {
        // Se envía por la cola y solo después de confirmar la transacción.
        $this->afterCommit();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Tu código de verificación - ' . config('hotel.name'),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.bookings.verification_code',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
