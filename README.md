# 🏨 Sistema de Gestión de Reservas de Hotel (Monorepo)

Proyecto académico universitario desarrollado bajo metodología ágil (**Scrum**) para un equipo de 3 personas (Plazo: 5 meses).

---

## 🏗️ Estructura del Proyecto

El repositorio está organizado como un **Monorepo** con dos proyectos independientes:

```text
SistemaDeHotel/
├── hotel-backend/        ← Backend API REST (Laravel 11 + PHP 8.2+)
└── hotel-frontend/       ← Frontend SPA (React + Vite + Tailwind CSS)
```

---

## 🛠️ Requisitos Previos

* **PHP** 8.2 o superior
* **Composer** 2.x
* **Node.js** v18+ y **npm**
* **MySQL** (XAMPP / Laragon / Servicio MySQL en el puerto 3306)

---

## 🚀 Guía de Instalación e Inicio Rápido

### 1. Configuración del Backend (`hotel-backend`)

Abre una terminal en la raíz del proyecto y ejecuta:

```bash
cd hotel-backend

# 1. Copiar archivo de entorno si no existe
cp .env.example .env

# 2. Asegurarse de tener dependencias instaladas
composer install

# 3. Generar App Key
php artisan key:generate

# 4. Crear la base de datos en MySQL (puerto 3306) llamada: hotel_reservas
# Y luego ejecutar las migraciones y seeders iniciales (roles: admin, recepcionista, cliente):
php artisan migrate --seed

# 5. Iniciar el servidor backend de Laravel (Puerto 8000)
php artisan serve
```

El backend quedará disponible en: `http://localhost:8000`

---

### 2. Configuración del Frontend (`hotel-frontend`)

Abre una **segunda terminal** en la raíz del proyecto y ejecuta:

```bash
cd hotel-frontend

# 1. Instalar dependencias si es necesario
npm install

# 2. Iniciar el servidor de desarrollo de Vite (Puerto 5173)
npm run dev
```

El frontend quedará disponible en: `http://localhost:5173`

---

## ⚡ Verificación de Conexión (Backend ↔ Frontend)

1. Con ambos servidores corriendo (`php artisan serve` y `npm run dev`), ingresa desde tu navegador a `http://localhost:5173`.
2. Dirígete a la pestaña **"Test Conexión API"** (`http://localhost:5173/ping`).
3. Verás una tarjeta de confirmación en verde indicando la respuesta exitosa del endpoint `GET /api/ping` de Laravel.

---

## 📦 Funcionalidades e Integraciones Instaladas

### Backend (`hotel-backend`)
* **Laravel Sanctum**: Autenticación para la SPA (React).
* **Spatie Laravel-permission**: Manejo de Roles (`admin`, `recepcionista`, `cliente`).
* **Laravel Reverb**: WebSockets para notificaciones y disponibilidad de habitaciones en tiempo real.
* **CORS**: Habilitado para origin `http://localhost:5173` con soporte de credenciales.
* **PHPUnit**: Pruebas unitarias y de integración configuradas (ejecutar con `php artisan test`).

### Frontend (`hotel-frontend`)
* **Tailwind CSS v4**: Estilos modernos y responsivos.
* **Axios**: Instancia preconfigurada en `src/services/api.js` conectada a `http://localhost:8000/api`.
* **Laravel Echo + Pusher**: Conexión WebSockets en `src/services/echo.js`.
* **React Router**: Navegación SPA fluida.
* **Estructura modular**:
  * `src/components/`
  * `src/pages/`
  * `src/services/`
  * `src/context/`
  * `src/hooks/`

---

## 📋 Metodología Scrum (Sprints)

Este Monorepo sirve como **Base Arquitectónica Limpia** para que el equipo pueda ir agregando historias de usuario Sprint a Sprint durante los 5 meses de desarrollo.
