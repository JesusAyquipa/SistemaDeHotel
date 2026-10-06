# Imagen base oficial de PHP 8.2 en Debian (CLI optimizado para desarrollo)
FROM php:8.2-cli

# Evitar prompts interactivos durante la instalación de paquetes
ENV DEBIAN_FRONTEND=noninteractive

# Instalar dependencias del sistema y librerías para extensiones de Laravel
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

# Copiar el código del proyecto
COPY . .

# Script de entrada para automatizar la configuración inicial en desarrollo
# Se genera directamente con LF para prevenir errores de saltos de línea Windows (CRLF)
RUN printf '#!/bin/sh\n\
set -e\n\
if [ ! -f "vendor/autoload.php" ]; then\n\
  echo "==> [Backend] Instalando dependencias de Composer..."\n\
  composer install --no-interaction --prefer-dist\n\
fi\n\
if [ ! -f ".env" ]; then\n\
  echo "==> [Backend] Creando archivo .env desde .env.example..."\n\
  cp .env.example .env\n\
fi\n\
if ! grep -q "^APP_KEY=base64:" .env 2>/dev/null; then\n\
  echo "==> [Backend] Generando APP_KEY..."\n\
  php artisan key:generate --force\n\
fi\n\
mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache\n\
chmod -R 777 storage bootstrap/cache\n\
echo "==> [Backend] Iniciando Laravel en el puerto ${PORT:-8000} ..."\n\
exec "$@"\n' > /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

# Exponer puerto 8000 para el servidor integrado de Laravel
EXPOSE 8000

# Entrypoint y comando por defecto
ENTRYPOINT ["docker-entrypoint.sh"]
CMD sh -c "php artisan serve --host=0.0.0.0 --port=${PORT:-8000}"
