# Sistema de Gestión de Reservas de Hotel

Monorepo con una **API REST en Laravel 11** y una **SPA en React (Vite + Tailwind)** para reservas online, recepción (check-in / check-out, consumos, caja) y administración (habitaciones, personal, temporadas y cupones).

Proyecto académico desarrollado con Scrum. Es una **demo**: la pasarela de pago es simulada.

---

## Arquitectura

```text
SistemaDeHotel/
├── hotel-backend/     API REST · Laravel 11 · PHP 8.2+ · Sanctum · Spatie Permission · Reverb
├── hotel-frontend/    SPA · React · Vite · Tailwind CSS v4 · Axios · Laravel Echo
├── docs/              Diagrama entidad-relación (Mermaid)
├── docker-compose.yml Entorno local completo (MySQL + backend + frontend)
└── .github/workflows  CI: tests del backend + lint/build del frontend
```

| Capa | Desarrollo local | Producción |
|------|------------------|------------|
| Frontend | Vite en `http://localhost:5173` | Vercel |
| Backend | `php artisan serve` en `http://localhost:8000` | Render (Docker, `hotel-backend/Dockerfile`) |
| Base de datos | MySQL 8 (local o contenedor) | TiDB Cloud (MySQL compatible, TLS con `isrgrootx1.pem`) |

- **Autenticación**: token Bearer de Sanctum (header `Authorization`), con expiración configurable (`SANCTUM_TOKEN_EXPIRATION`, 7 días por defecto).
- **Autorización**: roles de Spatie aplicados en las rutas (`routes/api.php`, `routes/api/staff.php`); la propiedad de cada reserva se valida en los controladores.
- **Errores de la API**: siempre JSON `{ "message": "..." }` con el código HTTP correspondiente (401/403/404/409/422/402).
- **Pagos**: gateway simulado (`PAYMENT_GATEWAY=simulation`). El webhook `/api/webhooks/payment` exige firma HMAC-SHA256 en `X-Signature` usando `PAYMENT_WEBHOOK_SECRET`.

### Roles

| Rol | Acceso |
|-----|--------|
| `cliente` | Registro/login, perfil, sus propias reservas (ver, modificar, cancelar, comprobante). |
| `recepcionista` | Panel de recepción: reservas walk-in, búsqueda/alta de huéspedes, check-in/out, consumos, pagos, cierre de caja, cambio de estado de habitaciones, lectura de configuración y catálogo. |
| `admin` | Todo lo anterior + CRUD de habitaciones, catálogo de productos, cuentas de personal, temporadas y cupones. |

---

## Inicio rápido con Docker (recomendado)

Requisitos: Docker Desktop.

```bash
docker compose up --build
```

- Frontend: http://localhost:5173 · API: http://localhost:8000/api/ping
- MySQL usa un usuario sin privilegios de root (`hotel` / `hotel_local` por defecto, configurable con `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`).
- El entrypoint del backend **reescribe `hotel-backend/.env`** con las variables del contenedor.
- Si vienes de una versión anterior del compose (usuario `root`/`root`), recrea el volumen: `docker compose down -v`.

Cargar datos demo (habitaciones, catálogo, cupones y cuentas de personal):

```bash
docker compose exec backend php artisan db:seed
```

---

## Instalación manual

Requisitos: PHP 8.2+ (extensiones `pdo_mysql`, `mbstring`, `bcmath`, `gd`, `zip`), Composer 2, Node.js 20+ y MySQL 8.

### Backend

```bash
cd hotel-backend
cp .env.example .env          # valores por defecto pensados para MySQL local (root sin contraseña)
composer install
php artisan key:generate
# Crear la base de datos "hotel_reservas" en MySQL y luego:
php artisan migrate --seed
php artisan storage:link      # fotos de perfil y de habitaciones
php artisan serve             # http://localhost:8000
```

`db:seed` crea las cuentas `admin@hotel.com` y `recepcion@hotel.com` (o las definidas en `SEED_ADMIN_EMAIL` / `SEED_RECEPCION_EMAIL`). Si no defines `SEED_ADMIN_PASSWORD` / `SEED_RECEPCION_PASSWORD`, se genera una contraseña aleatoria y **se muestra una sola vez en la consola**.

### Frontend

```bash
cd hotel-frontend
npm install
npm run dev                   # http://localhost:5173
```

Variable del frontend: `VITE_API_BASE_URL` (por defecto `http://localhost:8000`).

---

## Variables de entorno del backend

| Variable | Descripción | Local (`.env.example`) | Producción |
|----------|-------------|------------------------|------------|
| `APP_KEY` | Clave de cifrado. **Obligatoria en producción** (`php artisan key:generate --show`). Si falta, el contenedor genera una temporal y avisa en el log. | vacía → `key:generate` | definir |
| `APP_ENV` / `APP_DEBUG` | Entorno y modo debug. | `local` / `true` | `production` / `false` (por defecto en Docker) |
| `APP_URL` | URL pública de la API. | `http://localhost:8000` | URL de Render |
| `APP_TIMEZONE` | Zona horaria. | `America/Lima` | `America/Lima` |
| `LOG_LEVEL` | Nivel de log. | `debug` | `warning` (por defecto en Docker) |
| `FRONTEND_URL` | URL de la SPA: enlaces de correo (reset de contraseña) y origen CORS. | `http://localhost:5173` | URL de Vercel |
| `CORS_ALLOWED_ORIGINS` | Orígenes extra separados por comas. | vacío | opcional |
| `CORS_ALLOWED_ORIGIN_PATTERNS` | Regex de orígenes separadas por comas (p. ej. previews de Vercel). | vacío | opcional |
| `SANCTUM_TOKEN_EXPIRATION` | Minutos de vida de los tokens. | `10080` | `10080` |
| `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | Conexión MySQL/TiDB. | MySQL local | credenciales TiDB |
| `MYSQL_ATTR_SSL_CA` | Ruta del CA para TLS. | vacío | `/var/www/html/isrgrootx1.pem` |
| `MAIL_*` | SMTP para correos (bienvenida, reservas, reset). | `MAIL_MAILER=log` | SMTP real |
| `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`, `REVERB_HOST`, `REVERB_PORT`, `REVERB_SCHEME` | WebSockets (Laravel Reverb). Generar valores propios. | vacíos | definir |
| `PAYMENT_GATEWAY` | `simulation` o `stripe`. | `simulation` | `simulation` |
| `PAYMENT_WEBHOOK_SECRET` | Secreto HMAC del webhook de pagos. Vacío = webhook rechaza todo (401). | vacío | definir |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_RECEPCION_EMAIL`, `SEED_RECEPCION_PASSWORD` | Cuentas demo creadas por `db:seed`. | ver `.env.example` | definir si se siembra |

En Render, el entrypoint (`hotel-backend/docker/entrypoint.sh`) genera el `.env` a partir de estas variables, ejecuta `storage:link`, `config:cache`, `route:cache` y `migrate --force`, y arranca `php artisan serve` con `PHP_CLI_SERVER_WORKERS=4`.

---

## Colas y tareas programadas

Los correos (`App\Mail\*`) implementan `ShouldQueue` y usan `afterCommit()`: se encolan en la tabla `jobs` (`QUEUE_CONNECTION=database`, por defecto) y solo se despachan cuando la transacción de base de datos que los originó se confirma.

**En Docker (Render y `docker compose`) no hay que hacer nada**: el entrypoint arranca en segundo plano, dentro del mismo contenedor y antes del servidor web,

- `php artisan queue:work --sleep=3 --tries=3 --max-time=3600` (worker de colas), y
- `php artisan schedule:work` (planificador),

cada uno dentro de un bucle que lo reinicia automáticamente si termina (el worker se recicla cada hora por `--max-time`). `php artisan serve` sigue siendo el PID 1. Se pueden desactivar con `RUN_QUEUE_WORKER=false` / `RUN_SCHEDULER=false` (por ejemplo si se ejecutan en un servicio aparte).

Tareas programadas (`routes/console.php`, zona horaria `APP_TIMEZONE`):

| Comando | Frecuencia | Qué hace |
|---------|------------|----------|
| `app:expire-pending-bookings` | cada 5 minutos | Expira reservas `pending_payment` vencidas y libera habitación y cupón. |
| `app:mark-no-shows` | cada hora | Marca como `no_show` las reservas confirmadas cuyo plazo de llegada venció y aplica la penalidad. |
| `app:send-checkin-reminders` | diario 08:00 | Envía el recordatorio de check-in (con enlace de pre-check-in) a las llegadas del día siguiente. |

Instalación manual (sin Docker), en dos terminales aparte:

```bash
php artisan queue:work --sleep=3 --tries=3
php artisan schedule:work
```

Trabajos fallidos (tras 3 intentos quedan en `failed_jobs`):

```bash
php artisan queue:failed          # listar
php artisan queue:retry all       # reintentar todos (o un ID concreto)
php artisan queue:flush           # descartar todos
```

---

## Pruebas

```bash
cd hotel-backend
# Requiere una base MySQL "hotel_reservas_test" (credenciales por defecto: root sin contraseña en 127.0.0.1)
php artisan test
```

Las credenciales de la base de pruebas se pueden sobrescribir con `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` (así lo hace la CI).

Frontend:

```bash
cd hotel-frontend
npm run lint
npm test                      # Vitest + Testing Library (jsdom): utilidades y componentes (src/test/)
npm run test:watch            # modo observación
npx playwright install chromium   # solo la primera vez
npm run test:e2e              # Playwright: build de producción + `vite preview`, API 100 % simulada
npm run build
```

Las pruebas E2E (`hotel-frontend/e2e/`) no necesitan backend: todas las llamadas a la API se interceptan con `page.route` y responden con los fixtures JSON de `e2e/fixtures/` (ver `e2e/support/mockApi.js`). Cubren: inicio → habitaciones → detalle → checkout; login de recepción → `/recepcionista/hoy` → Rack; bitácora de auditoría del admin y redirecciones por rol.

La CI (`.github/workflows/ci.yml`) ejecuta backend, frontend (lint + Vitest + build) y E2E en cada push a `main` y en cada pull request.

---

## Seguridad

- No se versionan `.env`, subidas de usuarios ni volcados de base de datos con datos personales.
- Los tokens de restablecimiento de contraseña se guardan hasheados y expiran a los 60 minutos.
- Login, registro, recuperación de contraseña, validación de cupones y checkout tienen rate limiting.
- Los datos de tarjeta nunca se registran ni se almacenan (solo marca y últimos 4 dígitos).
