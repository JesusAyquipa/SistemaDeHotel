# Imagen base oficial de Node.js 22 LTS en Alpine Linux (Vite 8 requiere Node >= 20.19)
FROM node:22-alpine

# Directorio de trabajo en el contenedor
WORKDIR /app

# Copiar manifiestos de dependencias para aprovechar la caché de capas de Docker
COPY package*.json ./

# Instalar dependencias exactamente según package-lock.json
RUN npm ci

# Copiar el resto del código de la aplicación
COPY . .

# Exponer el puerto por defecto de Vite
EXPOSE 5173

# NOTA: este contenedor ejecuta el servidor de DESARROLLO de Vite (usado por docker-compose).
# Para producción, construir con `npm run build` y servir `dist/` con un servidor estático
# (nginx, Vercel, etc.) en lugar de usar `vite dev`.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
