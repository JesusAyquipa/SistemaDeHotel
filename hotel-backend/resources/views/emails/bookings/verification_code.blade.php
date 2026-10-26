<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Código de verificación</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1b1c19; background-color: #fbf9f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #d1c5af; }
        .header { text-align: center; border-bottom: 2px solid #d1c5af; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { color: #14213D; font-family: 'Georgia', serif; }
        .code { text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold; background-color: #f5f3ee; padding: 15px; border-radius: 4px; border-left: 4px solid #c9a227; margin: 20px 0; }
        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #4d4635; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{ config('hotel.name') }}</h1>
            <p>Verificación de correo</p>
        </div>
        <p>Usa este código para continuar con tu reserva:</p>
        <div class="code">{{ $code }}</div>
        <p>El código vence en {{ $minutes }} minutos. Si no lo solicitaste, ignora este mensaje.</p>
        <div class="footer">
            <p>&copy; {{ date('Y') }} {{ config('hotel.name') }}.</p>
        </div>
    </div>
</body>
</html>
