<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Cancelación de Reserva</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            color: #1b1c19;
            background-color: #fbf9f4;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #d1c5af;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #eae8e3;
            padding-bottom: 20px;
            margin-bottom: 20px;
        }
        .header h1 {
            color: #14213d;
            font-size: 24px;
            margin: 0;
        }
        .content p {
            line-height: 1.6;
            margin-bottom: 15px;
        }
        .booking-details {
            background-color: #f5f3ee;
            padding: 15px;
            border-left: 4px solid #ba1a1a;
            margin-bottom: 20px;
        }
        .refund-info {
            background-color: #eae8e3;
            padding: 15px;
            border: 1px solid #d1c5af;
            margin-bottom: 20px;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #755b00;
            margin-top: 30px;
            border-top: 1px solid #eae8e3;
            padding-top: 15px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>The Grand Ledger</h1>
            <p>Confirmación de Cancelación</p>
        </div>
        <div class="content">
            <p>Estimado/a <strong>{{ $booking->guest->name }} {{ $booking->guest->surname }}</strong>,</p>
            <p>Le confirmamos que su reserva ha sido cancelada exitosamente según su solicitud.</p>
            
            <div class="booking-details">
                <p><strong>Código de Reserva:</strong> {{ $booking->booking_code }}</p>
                <p><strong>Fechas de Estancia:</strong> {{ \Carbon\Carbon::parse($booking->check_in)->format('d/m/Y') }} al {{ \Carbon\Carbon::parse($booking->check_out)->format('d/m/Y') }}</p>
            </div>

            <div class="refund-info">
                <h3>Detalles del Reembolso</h3>
                <p><strong>Porcentaje Aplicado:</strong> {{ $refundPercentage }}%</p>
                <p><strong>Monto a Devolver:</strong> S/ {{ number_format($refundAmount, 2) }}</p>
                
                @if($paymentMethod === 'Efectivo')
                    <p style="color: #93000a; font-weight: bold;">
                        Dado que el pago se realizó en efectivo, por favor acérquese a la recepción del hotel con su documento de identidad para realizar el reembolso.
                    </p>
                @else
                    <p style="color: #1b5e20; font-weight: bold;">
                        El reembolso se está procesando a su tarjeta o método de pago original y puede tardar de 5 a 10 días hábiles en reflejarse.
                    </p>
                @endif
            </div>

            <p>Esperamos poder recibirlo en otra oportunidad.</p>
            <p>Atentamente,<br>El equipo de The Grand Ledger</p>
        </div>
        <div class="footer">
            <p>© {{ date('Y') }} The Grand Ledger. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
