# Imagen base oficial de PHP 8.2 en Debian (CLI)
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

# Instalar dependencias primero (mejor cache de capas)
COPY composer.json composer.lock ./
RUN composer install --no-interaction --prefer-dist --no-dev --no-scripts --no-autoloader

# Copiar el codigo del proyecto (ver .dockerignore)
COPY . .

# Autoloader optimizado (ejecuta package:discover via post-autoload-dump)
RUN composer dump-autoload --optimize --no-dev

# Entrypoint: genera .env desde variables de entorno, permisos, cachés y migraciones
COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Servidor embebido de Laravel con varios workers (Laravel 11 soporta PHP_CLI_SERVER_WORKERS)
ENV PHP_CLI_SERVER_WORKERS=4

EXPOSE 8000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "php artisan serve --host=0.0.0.0 --port=${PORT:-8000}"]
