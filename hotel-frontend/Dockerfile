# Imagen base oficial de Node.js 20 LTS en Alpine Linux
FROM node:20-alpine

# Directorio de trabajo en el contenedor
WORKDIR /app

# Copiar manifiestos de dependencias para aprovechar la caché de capas de Docker
COPY package*.json ./

# Instalar dependencias del proyecto
RUN npm install

# Copiar el resto del código de la aplicación
COPY . .

# Exponer el puerto por defecto de Vite
EXPOSE 5173

# Arrancar el servidor de desarrollo de Vite con --host 0.0.0.0 para aceptar conexiones externas
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
