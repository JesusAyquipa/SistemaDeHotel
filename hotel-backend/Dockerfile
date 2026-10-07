# Imagen base oficial de PHP 8.2 en Debian (CLI optimizado para desarrollo)
FROM php:8.2-cli

# Evitar prompts interactivos durante la instalacion de paquetes
ENV DEBIAN_FRONTEND=noninteractive

# Instalar dependencias del sistema y librerias para extensiones de Laravel
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    zip \
    unzip \
    default-mysql-client \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        mbstring \
        exif \
        pcntl \
        bcmath \
        gd \
        zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Instalar Composer desde la imagen oficial v2
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Establecer directorio de trabajo
WORKDIR /var/www/html

# Copiar el codigo del proyecto
COPY . .

# Instalar dependencias de Composer en tiempo de build
RUN composer install --no-interaction --prefer-dist --optimize-autoloader

# Script de entrada: inyecta las variables de entorno del sistema (Render) en el .env
RUN printf '#!/bin/sh\nset -e\n\
echo "==> [Backend] Escribiendo variables de entorno en .env..."\n\
cp .env.example .env\n\
# Inyectar cada variable del sistema operativo al final del .env\n\
[ -n "$DB_CONNECTION" ]     && echo "DB_CONNECTION=$DB_CONNECTION"         >> .env\n\
[ -n "$DB_HOST" ]           && echo "DB_HOST=$DB_HOST"                     >> .env\n\
[ -n "$DB_PORT" ]           && echo "DB_PORT=$DB_PORT"                     >> .env\n\
[ -n "$DB_DATABASE" ]       && echo "DB_DATABASE=$DB_DATABASE"             >> .env\n\
[ -n "$DB_USERNAME" ]       && echo "DB_USERNAME=$DB_USERNAME"             >> .env\n\
[ -n "$DB_PASSWORD" ]       && echo "DB_PASSWORD=$DB_PASSWORD"             >> .env\n\
[ -n "$MYSQL_ATTR_SSL_CA" ] && echo "MYSQL_ATTR_SSL_CA=$MYSQL_ATTR_SSL_CA" >> .env\n\
[ -n "$APP_KEY" ]           && echo "APP_KEY=$APP_KEY"                     >> .env\n\
[ -n "$FRONTEND_URL" ]      && echo "FRONTEND_URL=$FRONTEND_URL"           >> .env\n\
if ! grep -q "^APP_KEY=base64:" .env 2>/dev/null; then\n\
  echo "==> [Backend] Generando APP_KEY..."\n\
  php artisan key:generate --force\n\
fi\n\
echo "==> [Backend] Ejecutando migraciones automáticas..."\n\
php artisan migrate --force\n\
mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache\n\
chmod -R 777 storage bootstrap/cache\n\
echo "==> [Backend] Iniciando Laravel en el puerto ${PORT:-8000} ..."\n\
exec "$@"\n' > /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

# Exponer puerto 8000
EXPOSE 8000

# Entrypoint y comando por defecto
ENTRYPOINT ["docker-entrypoint.sh"]
CMD sh -c "php artisan serve --host=0.0.0.0 --port=${PORT:-8000}"
