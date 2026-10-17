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

/**
 * Listado paginado de huéspedes. GET /api/guests
 * @param {{ search?: string, sort?: 'recent'|'name'|'stays', page?: number }} params
 */
export const listGuests = async ({ search = '', sort = 'recent', page = 1, flag = '' } = {}, { signal } = {}) => {
  const params = { sort, page };
  if (search.trim()) params.search = search.trim();
  if (flag) params.flag = flag; // SHE-033: 'vip' | 'blacklisted'
  const response = await api.get('/guests', { params, signal });
  return response.data;
};

/** Ficha del huésped con estadísticas e historial. GET /api/guests/{id} */
export const getGuest = async (id, { signal } = {}) => {
  const response = await api.get(`/guests/${id}`, { signal });
  return response.data;
};

/** Actualiza la ficha del huésped. PUT /api/guests/{id} */
export const updateGuest = async (id, data) => {
  const response = await api.put(`/guests/${id}`, data);
  return response.data;
};

/** Elimina un huésped sin reservas (solo admin). DELETE /api/guests/{id} */
export const deleteGuest = async (id) => {
  const response = await api.delete(`/guests/${id}`);
  return response.data;
};
