import api from './api';

/**
 * Obtiene las habitaciones disponibles con filtros opcionales de fechas, tipo de cama y capacidad.
 * @param {Object} params - { check_in, check_out, bed_type, capacity }
 * @returns {Promise<Array>} Lista de habitaciones
 */
export const getAvailableRooms = async (params = {}) => {
  const cleanParams = {};
  
  if (params.check_in) cleanParams.check_in = params.check_in;
  if (params.check_out) cleanParams.check_out = params.check_out;
  if (params.bed_type && params.bed_type !== 'todos') cleanParams.bed_type = params.bed_type;
  if (params.capacity && Number(params.capacity) > 0) cleanParams.capacity = params.capacity;

  const response = await api.get('/rooms/available', {
    params: cleanParams,
  });

  return response.data;
};

export default {
  getAvailableRooms,
};
