#!/bin/sh
# =============================================================================
# Entrypoint del backend (Laravel 11)
# - Escribe .env a partir de las variables de entorno del contenedor
#   (Render / docker-compose) con valores por defecto de PRODUCCIÓN.
# - Prepara permisos, enlace de storage, cachés y migraciones.
# =============================================================================
set -e

cd /var/www/html

# ── Valores por defecto seguros (producción) ─────────────────────────────────
export APP_NAME="${APP_NAME:-Sistema de Reservas Hotel API}"
export APP_ENV="${APP_ENV:-production}"
export APP_DEBUG="${APP_DEBUG:-false}"
export APP_TIMEZONE="${APP_TIMEZONE:-America/Lima}"
export APP_LOCALE="${APP_LOCALE:-es}"
export LOG_CHANNEL="${LOG_CHANNEL:-stderr}"
export LOG_LEVEL="${LOG_LEVEL:-warning}"
export DB_CONNECTION="${DB_CONNECTION:-mysql}"
export SESSION_DRIVER="${SESSION_DRIVER:-database}"
export CACHE_STORE="${CACHE_STORE:-database}"
export QUEUE_CONNECTION="${QUEUE_CONNECTION:-database}"
export FILESYSTEM_DISK="${FILESYSTEM_DISK:-local}"
export BROADCAST_CONNECTION="${BROADCAST_CONNECTION:-reverb}"
export MAIL_MAILER="${MAIL_MAILER:-log}"
export PAYMENT_GATEWAY="${PAYMENT_GATEWAY:-simulation}"

# ── APP_KEY ──────────────────────────────────────────────────────────────────
if [ -z "$APP_KEY" ] && [ -f .env ]; then
    # Reutilizar la clave de un .env existente (p. ej. volumen local)
    APP_KEY="$(grep -E '^APP_KEY=' .env | head -n1 | cut -d= -f2- | tr -d '"')"
fi
if [ -z "$APP_KEY" ]; then
    echo "############################################################################"
    echo "## WARNING: APP_KEY no está definida. Se generará una clave TEMPORAL.      ##"
    echo "## Las sesiones/datos cifrados se invalidarán en cada reinicio.            ##"
    echo "## Defina APP_KEY (php artisan key:generate --show) en el entorno.         ##"
    echo "############################################################################"
    APP_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
fi
export APP_KEY

if [ -z "$PAYMENT_WEBHOOK_SECRET" ]; then
    echo "==> [Backend] AVISO: PAYMENT_WEBHOOK_SECRET vacío; el webhook de pagos rechazará todas las peticiones (401)."
fi

# ── Escribir .env ────────────────────────────────────────────────────────────
# Escapa \ " y $ para el formato de phpdotenv entre comillas dobles.
write_var() {
    name="$1"
    eval "value=\${$name-}"
    [ -z "$value" ] && return 0
    escaped="$(printf '%s' "$value" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\$/\\$/g')"
    printf '%s="%s"\n' "$name" "$escaped" >> .env.tmp
}

if [ "${KEEP_EXISTING_ENV_FILE:-false}" = "true" ] && [ -f .env ]; then
    echo "==> [Backend] KEEP_EXISTING_ENV_FILE=true: se conserva el .env existente."
else
    echo "==> [Backend] Escribiendo .env desde variables de entorno..."
    : > .env.tmp
    for var in \
        APP_NAME APP_ENV APP_KEY APP_DEBUG APP_TIMEZONE APP_URL APP_LOCALE APP_FALLBACK_LOCALE \
        FRONTEND_URL CORS_ALLOWED_ORIGINS CORS_ALLOWED_ORIGIN_PATTERNS CORS_SUPPORTS_CREDENTIALS \
        SANCTUM_TOKEN_EXPIRATION SANCTUM_STATEFUL_DOMAINS \
        LOG_CHANNEL LOG_STACK LOG_LEVEL \
        DB_CONNECTION DB_HOST DB_PORT DB_DATABASE DB_USERNAME DB_PASSWORD MYSQL_ATTR_SSL_CA \
        SESSION_DRIVER SESSION_LIFETIME CACHE_STORE QUEUE_CONNECTION FILESYSTEM_DISK BROADCAST_CONNECTION \
        MAIL_MAILER MAIL_SCHEME MAIL_HOST MAIL_PORT MAIL_USERNAME MAIL_PASSWORD MAIL_ENCRYPTION \
        MAIL_FROM_ADDRESS MAIL_FROM_NAME \
        REVERB_APP_ID REVERB_APP_KEY REVERB_APP_SECRET REVERB_HOST REVERB_PORT REVERB_SCHEME \
        PAYMENT_GATEWAY PAYMENT_WEBHOOK_SECRET \
        STRIPE_PUBLISHABLE_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET \
        SEED_ADMIN_EMAIL SEED_ADMIN_PASSWORD SEED_RECEPCION_EMAIL SEED_RECEPCION_PASSWORD
    do
        write_var "$var"
    done
    mv .env.tmp .env
    chmod 640 .env 2>/dev/null || true
fi

# ── Dependencias (si el código está montado como volumen sin vendor/) ────────
if [ ! -f vendor/autoload.php ]; then
    echo "==> [Backend] vendor/ no encontrado, ejecutando composer install..."
    composer install --no-interaction --prefer-dist --optimize-autoloader
fi

# ── Permisos ─────────────────────────────────────────────────────────────────
mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions \
         storage/framework/views storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache .env 2>/dev/null || true
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

# ── Laravel ──────────────────────────────────────────────────────────────────
php artisan storage:link --force >/dev/null 2>&1 || true

if [ "$APP_ENV" = "production" ]; then
    php artisan config:cache
    php artisan route:cache
else
    php artisan config:clear >/dev/null 2>&1 || true
    php artisan route:clear >/dev/null 2>&1 || true
fi

echo "==> [Backend] Ejecutando migraciones..."
php artisan migrate --force

# ── Cola y tareas programadas (SHE-038) ──────────────────────────────────────
# Se ejecutan en segundo plano dentro del mismo contenedor; si un proceso muere
# (o termina por --max-time) se reinicia automáticamente tras una pausa breve.
# El servidor web sigue siendo el PID 1 gracias a `exec "$@"` más abajo.
# RUN_QUEUE_WORKER=false / RUN_SCHEDULER=false desactivan cada uno (p. ej. si se
# ejecutan en otro contenedor o servicio dedicado).
keep_alive() {
    name="$1"; shift
    (
        while true; do
            echo "==> [Backend] Iniciando ${name}: $*"
            "$@" || echo "==> [Backend] ${name} terminó con código $?"
            sleep 5
        done
    ) &
}

QUEUE_CMD="php artisan queue:work --sleep=3 --tries=3 --max-time=3600"
SCHEDULE_CMD="php artisan schedule:work"

if [ "${RUN_QUEUE_WORKER:-true}" = "true" ]; then
    # shellcheck disable=SC2086
    keep_alive "queue:work" $QUEUE_CMD
fi
if [ "${RUN_SCHEDULER:-true}" = "true" ]; then
    # shellcheck disable=SC2086
    keep_alive "schedule:work" $SCHEDULE_CMD
fi

echo "==> [Backend] Iniciando Laravel en el puerto ${PORT:-8000} (APP_ENV=${APP_ENV})..."
exec "$@"
