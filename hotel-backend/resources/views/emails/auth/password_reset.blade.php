<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Restablecer Contraseña - Sheraton Lima Hotel</title>
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
            max-width: 600px; 
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
            text-align: center;
        }
        .content h2 {
            font-family: 'Playfair Display', serif;
            font-size: 24px;
            color: #755b00;
            margin-bottom: 20px;
        }
        .content p {
            font-size: 14px;
            color: #4d4635;
            margin-bottom: 30px;
        }
        .button {
            display: inline-block;
            background-color: #c9a227;
            color: #14213d;
            font-weight: bold;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 2px;
            padding: 15px 30px;
            text-decoration: none;
            border: 1px solid #a68a4d;
            margin-bottom: 30px;
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
            <h1>Sheraton Lima Hotel</h1>
            <p>Seguridad de Cuenta</p>
        </div>
        
        <div class="content">
            <h2>Restablecer su Contraseña</h2>
            <p>
                Hemos recibido una solicitud para restablecer la contraseña de su cuenta en Sheraton Lima Hotel. 
                Si usted no realizó esta solicitud, puede ignorar este correo de forma segura.
            </p>
            
            <a href="http://localhost:5173/reset-password?token={{ $token }}&email={{ urlencode($email) }}" class="button">
                Restablecer Contraseña
            </a>
            
            <p style="font-size: 12px; color: #a39f96; margin-top: 30px;">
                Este enlace expirará en 60 minutos por razones de seguridad.
            </p>
        </div>
        
        <div class="footer">
            <p style="margin: 0;">&copy; {{ date('Y') }} Sheraton Lima Hotel. TODOS LOS DERECHOS RESERVADOS.</p>
        </div>
    </div>
</body>
</html>
