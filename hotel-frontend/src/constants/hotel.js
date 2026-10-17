export const HOTEL_NAME = import.meta.env.VITE_HOTEL_NAME || 'Hotel Demo';

// Datos del emisor para comprobantes internos (el backend envía los valores de config/hotel.php;
// estos son solo el respaldo si la respuesta no los incluye).
export const HOTEL_RUC = import.meta.env.VITE_HOTEL_RUC || '00000000000';
export const HOTEL_ADDRESS = import.meta.env.VITE_HOTEL_ADDRESS || 'Lima, Perú';
export const HOTEL_PHONE = import.meta.env.VITE_HOTEL_PHONE || '';
