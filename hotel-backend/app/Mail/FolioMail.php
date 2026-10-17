<?php

namespace App\Mail;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class FolioMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $booking;
    public $charges;
    public $payments;
    public $totals;

    /**
     * Create a new message instance.
     */
    public function __construct(Booking $booking, $charges, $payments, $totals)
    {
        // Se envía por la cola y solo después de confirmar la transacción (SHE-038).
        $this->afterCommit();
        $this->booking = $booking;
        $this->charges = $charges;
        $this->payments = $payments;
        $this->totals = $totals;
    }

    /**
     * Build the message.
     */
    public function build()
    {
        return $this->subject('Folio de Cuenta - ' . config('hotel.name'))
                    ->view('emails.bookings.folio');
    }
}
