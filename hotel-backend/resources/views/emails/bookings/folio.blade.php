<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Folio de Cuenta - The Grand Ledger</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Space+Mono:wght@400;700&display=swap');
        
        body { 
            font-family: 'Space Mono', monospace; 
            color: #2d2d2a; 
            line-height: 1.6; 
            background-color: #dcdad5; 
            margin: 0; 
            padding: 40px 20px; 
        }
        .container { 
            max-width: 650px; 
            margin: 0 auto; 
            background-color: #fbf9f4; 
            padding: 0; 
            border: 1px solid #d1c5af;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1); 
        }
        .header { 
            text-align: center; 
            background-color: #1b1c19; 
            color: white;
            padding: 40px 20px; 
            border-bottom: 4px solid #c9a227;
        }
        .header h1 { 
            font-family: 'Playfair Display', serif; 
            color: white; 
            margin: 0 0 10px 0; 
            font-size: 32px; 
            letter-spacing: 1px;
        }
        .header p { 
            color: #a39f96; 
            font-size: 11px; 
            letter-spacing: 4px; 
            text-transform: uppercase; 
            margin: 0;
        }
        .content { 
            padding: 40px; 
        }
        .greeting {
            font-family: 'Playfair Display', serif;
            font-size: 18px;
            margin-bottom: 30px;
            color: #1b1c19;
        }
        .info-box {
            background-color: #f5f3ee;
            border: 1px solid #e4e2dd;
            padding: 20px;
            margin-bottom: 30px;
        }
        .info-box p {
            margin: 5px 0;
            font-size: 13px;
        }
        .info-box strong {
            color: #755b00;
            display: inline-block;
            width: 120px;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 1px;
        }
        .section-title {
            font-family: 'Playfair Display', serif;
            font-size: 20px;
            color: #755b00;
            border-bottom: 2px solid #e4e2dd;
            padding-bottom: 10px;
            margin-bottom: 20px;
            margin-top: 40px;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 30px; 
        }
        th, td { 
            border-bottom: 1px solid #e4e2dd; 
            padding: 12px 10px; 
            text-align: left; 
            font-size: 13px; 
        }
        th { 
            background-color: #f0eee9; 
            color: #755b00; 
            font-weight: bold; 
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 1px;
        }
        .text-right {
            text-align: right;
        }
        .totals-container {
            background-color: #1b1c19;
            color: white;
            padding: 30px;
            margin-top: 20px;
        }
        .totals-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 13px;
            color: #a39f96;
        }
        .totals-row.highlight {
            border-top: 1px solid #333;
            padding-top: 15px;
            margin-top: 15px;
            font-size: 16px;
            color: white;
            font-weight: bold;
        }
        .totals-row.highlight-gold {
            color: #c9a227;
            font-size: 20px;
        }
        .totals-row span:last-child {
            font-family: monospace;
        }
        .footer { 
            text-align: center; 
            padding: 30px; 
            font-size: 11px; 
            color: #78716c; 
            background-color: #eae8e3;
            border-top: 1px solid #d1c5af;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>The Grand Ledger</h1>
            <p>Estado de Cuenta Oficial</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                Estimado/a {{ $booking->guest->name }} {{ $booking->guest->surname }},
            </div>
            
            <p style="font-size: 13px; color: #4d4635; margin-bottom: 25px;">
                Agradecemos su preferencia por elegir The Grand Ledger. A continuación, le presentamos el detalle de su cuenta correspondiente a su reciente estadía con nosotros.
            </p>

            <div class="info-box">
                <p><strong>Reserva:</strong> {{ $booking->booking_code }}</p>
                <p><strong>Habitación:</strong> {{ $booking->room->room_number }} ({{ $booking->room->name }})</p>
                <p><strong>Check-in:</strong> {{ \Carbon\Carbon::parse($booking->check_in)->format('d M Y') }}</p>
                <p><strong>Check-out:</strong> {{ \Carbon\Carbon::parse($booking->check_out)->format('d M Y') }}</p>
            </div>
            
            <h2 class="section-title">Detalle de Consumos</h2>
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Concepto</th>
                        <th class="text-right">Cant.</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>{{ \Carbon\Carbon::parse($booking->check_in)->format('d/m/Y') }}</td>
                        <td><strong>Tarifa de Habitación</strong></td>
                        <td class="text-right">1</td>
                        <td class="text-right">S/ {{ number_format($booking->total_amount, 2) }}</td>
                    </tr>
                    @foreach($charges as $charge)
                    <tr>
                        <td>{{ \Carbon\Carbon::parse($charge->date)->format('d/m/Y') }}</td>
                        <td>{{ $charge->concept }}</td>
                        <td class="text-right">{{ $charge->quantity }}</td>
                        <td class="text-right">S/ {{ number_format($charge->total, 2) }}</td>
                    </tr>
                    @endforeach
                </tbody>
            </table>

            <div class="totals-container">
                <div class="totals-row">
                    <span>Subtotal</span>
                    <span>S/ {{ number_format($totals['subtotal'], 2) }}</span>
                </div>
                <div class="totals-row">
                    <span>IGV (18%)</span>
                    <span>S/ {{ number_format($totals['igv'], 2) }}</span>
                </div>
                <div class="totals-row highlight">
                    <span>Total de la Cuenta</span>
                    <span>S/ {{ number_format($totals['total'], 2) }}</span>
                </div>
                <div class="totals-row" style="color: #4caf50;">
                    <span>Pagos Realizados</span>
                    <span>- S/ {{ number_format($totals['pagado'], 2) }}</span>
                </div>
                <div class="totals-row highlight highlight-gold">
                    <span>Saldo Pendiente</span>
                    <span>S/ {{ number_format($totals['saldo'], 2) }}</span>
                </div>
            </div>
            
            <p style="margin-top: 40px; font-size: 13px; text-align: center; color: #4d4635; font-style: italic;">
                Si tiene alguna duda o discrepancia sobre este estado de cuenta, por favor contáctenos haciendo referencia a su número de reserva.
            </p>
        </div>
        
        <div class="footer">
            <p style="margin: 0;">&copy; {{ date('Y') }} THE GRAND LEDGER. TODOS LOS DERECHOS RESERVADOS.</p>
            <p style="margin: 5px 0 0 0; font-size: 9px; color: #a39f96;">Este es un documento informativo y no constituye un comprobante fiscal electrónico válido a menos que se indique lo contrario.</p>
        </div>
    </div>
</body>
</html>
