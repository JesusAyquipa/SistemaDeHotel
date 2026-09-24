<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Modificación de Reserva</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1b1c19; background-color: #fbf9f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #d1c5af; }
        .header { text-align: center; border-bottom: 2px solid #d1c5af; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { color: #14213D; font-family: 'Georgia', serif; }
        .content { line-height: 1.6; }
        .details-box { background-color: #f5f3ee; padding: 15px; border-radius: 4px; border-left: 4px solid #c9a227; margin: 20px 0; }
        .details-box p { margin: 5px 0; }
        .message-box { background-color: #e8f5e9; color: #1b5e20; padding: 15px; border-radius: 4px; border: 1px solid #c8e6c9; margin: 15px 0; font-size: 14px; }
        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #4d4635; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>The Grand Ledger</h1>
            <p>Actualización de Reserva</p>
        </div>
        <div class="content">
            <p>Hola <strong>{{ $booking->guest->name }} {{ $booking->guest->surname }}</strong>,</p>
            <p>Te escribimos para confirmar que tu reserva ha sido <strong>modificada con éxito</strong>.</p>
            
            @if($modMessage)
            <div class="message-box">
                {{ $modMessage }}
            </div>
            @endif

            <div class="details-box">
                <p><strong>Código de Reserva:</strong> {{ $booking->booking_code }}</p>
                <p><strong>Nuevas Fechas:</strong></p>
                <p><strong>Check-in:</strong> {{ \Carbon\Carbon::parse($booking->check_in)->format('d/m/Y') }} a partir de las 15:00</p>
                <p><strong>Check-out:</strong> {{ \Carbon\Carbon::parse($booking->check_out)->format('d/m/Y') }} hasta las 12:00</p>
                <p><strong>Habitación:</strong> {{ $booking->room->name }} - Hab. {{ $booking->room->room_number }} ({{ $booking->room->bed_type }})</p>
                <p><strong>Nuevo Monto Total:</strong> S/ {{ number_format($booking->total_amount, 2) }}</p>
            </div>
            
            <p>Si tienes alguna consulta adicional o necesitas realizar más cambios, no dudes en contactarnos mencionando tu código de reserva.</p>
            <p>¡Buen viaje y nos vemos pronto!</p>
        </div>
        <div class="footer">
            <p>&copy; {{ date('Y') }} The Grand Ledger. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
