<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Recordatorio de Check-in</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1b1c19; background-color: #fbf9f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #d1c5af; }
        .header { text-align: center; border-bottom: 2px solid #d1c5af; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { color: #14213D; font-family: 'Georgia', serif; }
        .content { line-height: 1.6; }
        .alert-box { background-color: #c9a227; color: #14213D; padding: 15px; border-radius: 4px; text-align: center; font-weight: bold; margin: 20px 0; }
        .details-box { background-color: #f5f3ee; padding: 15px; border-radius: 4px; border-left: 4px solid #c9a227; margin: 20px 0; }
        .details-box p { margin: 5px 0; }
        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #4d4635; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>The Grand Ledger</h1>
            <p>Recordatorio de Estadía</p>
        </div>
        <div class="content">
            <div class="alert-box">
                ¡Tu estadía comienza mañana!
            </div>
            
            <p>Hola <strong>{{ $booking->guest->name }}</strong>,</p>
            <p>Te escribimos para recordarte que tu reserva en The Grand Ledger comienza el día de mañana. ¡Ya tenemos todo listo para tu llegada!</p>
            
            <div class="details-box">
                <p><strong>Código de Reserva:</strong> {{ $booking->booking_code }}</p>
                <p><strong>Fecha de Check-in:</strong> {{ \Carbon\Carbon::parse($booking->check_in)->format('d/m/Y') }}</p>
                <p><strong>Hora de Ingreso:</strong> A partir de las 15:00</p>
                <p><strong>Habitación:</strong> {{ $booking->room->room_number }}</p>
            </div>
            
            <p>Recuerda traer contigo una identificación válida para el registro. Si necesitas indicaciones para llegar o algún servicio especial, háznoslo saber.</p>
            <p>¡Esperamos que tengas un viaje seguro!</p>
        </div>
        <div class="footer">
            <p>&copy; {{ date('Y') }} The Grand Ledger. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
