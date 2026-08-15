import api from './api';

/**
 * Servicio para la gestión de huéspedes en el backend.
 */

/**
 * Envía los datos del nuevo huésped a POST /api/guests
 * @param {Object} guestData 
 * @returns {Promise<Object>} Respuesta del backend con el mensaje y datos del huésped creado.
 */
export const registerGuest = async (guestData) => {
  const response = await api.post('/guests', guestData);
  return response.data;
};
