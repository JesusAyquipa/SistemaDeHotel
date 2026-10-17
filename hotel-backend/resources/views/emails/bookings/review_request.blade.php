<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Cuéntanos tu experiencia</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1b1c19; background-color: #fbf9f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #d1c5af; }
        .header { text-align: center; border-bottom: 2px solid #d1c5af; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { color: #14213D; font-family: 'Georgia', serif; }
        .content { line-height: 1.6; }
        .stars { text-align: center; font-size: 28px; color: #c9a227; letter-spacing: 6px; margin: 20px 0; }
        .btn { display: inline-block; background-color: #14213D; color: #ffffff !important; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold; }
        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #4d4635; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{ config('hotel.name') }}</h1>
            <p>Gracias por hospedarte con nosotros</p>
        </div>
        <div class="content">
            <p>Hola <strong>{{ $booking->guest->name }}</strong>,</p>
            <p>Esperamos que hayas disfrutado tu estadía en {{ $booking->room->name ?? 'nuestro hotel' }} (reserva <strong>{{ $booking->booking_code }}</strong>). Tu opinión nos ayuda a mejorar y orienta a otros viajeros.</p>
            <div class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
            <p style="text-align: center;">
                <a class="btn" href="{{ $reviewUrl }}">Dejar mi reseña</a>
            </p>
            <p style="font-size: 12px; color: #4d4635;">Si el botón no funciona, copia este enlace en tu navegador: {{ $reviewUrl }}</p>
        </div>
        <div class="footer">
            <p>&copy; {{ date('Y') }} {{ config('hotel.name') }}. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
