<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reembolso procesado</title>
    <style>
        body { font-family: Arial, sans-serif; color: #1b1c19; background-color: #fbf9f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #d1c5af; padding: 30px; }
        .header { text-align: center; border-bottom: 2px solid #eae8e3; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { color: #14213d; font-size: 24px; margin: 0; }
        .content p { line-height: 1.6; margin-bottom: 15px; }
        .refund-info { background-color: #f5f3ee; padding: 15px; border-left: 4px solid #3F6B4F; margin-bottom: 20px; }
        .footer { text-align: center; font-size: 12px; color: #755b00; margin-top: 30px; border-top: 1px solid #eae8e3; padding-top: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{ config('hotel.name') }}</h1>
            <p>Reembolso procesado</p>
        </div>
        <div class="content">
            <p>Estimado/a <strong>{{ $booking->guest->name ?? '' }} {{ $booking->guest->surname ?? '' }}</strong>,</p>
            <p>Le informamos que el reembolso correspondiente a su reserva <strong>{{ $booking->booking_code }}</strong> ha sido aprobado y procesado.</p>

            <div class="refund-info">
                <p><strong>Monto reembolsado:</strong> S/ {{ number_format($amount, 2) }}</p>
                <p><strong>Método:</strong> {{ $methodLabel }}</p>
                @if($reference)
                    <p><strong>Referencia de la operación:</strong> {{ $reference }}</p>
                @endif
            </div>

            <p>Dependiendo de su entidad financiera, el abono puede tardar algunos días hábiles en reflejarse.</p>
            <p>Atentamente,<br>El equipo de {{ config('hotel.name') }}</p>
        </div>
        <div class="footer">
            <p>© {{ date('Y') }} {{ config('hotel.name') }}. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
