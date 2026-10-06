<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Bienvenido a Sheraton Lima</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1b1c19; background-color: #fbf9f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #d1c5af; }
        .header { text-align: center; border-bottom: 2px solid #d1c5af; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { color: #14213D; font-family: 'Georgia', serif; }
        .content { line-height: 1.6; }
        .details-box { background-color: #f5f3ee; padding: 15px; border-radius: 4px; border-left: 4px solid #c9a227; margin: 20px 0; }
        .details-box p { margin: 5px 0; }
        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #4d4635; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Sheraton Lima</h1>
            <p>¡Cuenta Creada Exitosamente!</p>
        </div>
        <div class="content">
            <p>Hola <strong>{{ $user->name }}</strong>,</p>
            <p>Te damos la más cordial bienvenida a nuestro portal de reservas. Nos alegra mucho que te hayas registrado.</p>
            
            <div class="details-box">
                <p><strong>Tu usuario:</strong> {{ $user->email }}</p>
                <p>Ahora puedes iniciar sesión para reservar tus próximas estadías, consultar tu historial y acceder a beneficios exclusivos como huésped.</p>
            </div>
            
            <p>Si tienes alguna consulta adicional, no dudes en ponerte en contacto con nosotros.</p>
            <p>¡Esperamos tenerte pronto con nosotros!</p>
        </div>
        <div class="footer">
            <p>&copy; {{ date('Y') }} Sheraton Lima. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
