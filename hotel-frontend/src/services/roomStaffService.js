import api from './api';

/**
 * Servicio API para la gestión de inventario y estados de habitaciones (Staff / Recepción).
 */

/**
 * Obtiene todas las habitaciones para el staff con métricas de inventario.
 * @param {Object} params - { status, search }
 * @returns {Promise<Object>} { rooms: [...], metrics: {...} }
 */
export const getStaffRooms = async (params = {}) => {
  const cleanParams = {};
  if (params.status && params.status !== 'todos') cleanParams.status = params.status;
  if (params.search && params.search.trim()) cleanParams.search = params.search.trim();

  const response = await api.get('/staff/rooms', { params: cleanParams });
  return response.data;
};

/**
 * Obtiene el detalle de una habitación específica con sus reservas.
 * @param {number|string} id - ID de la habitación
 */
export const getRoomDetails = async (id) => {
  const response = await api.get(`/staff/rooms/${id}`);
  return response.data;
};

/**
 * Registra una nueva habitación en el inventario.
 * @param {Object} roomData - Datos de la habitación
 * @returns {Promise<Object>} Habitación creada
 */
export const createRoom = async (roomData) => {
  const isFormData = roomData instanceof FormData;
  const response = await api.post('/staff/rooms', roomData, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
  });
  return response.data;
};

/**
 * Actualiza la información técnica de una habitación.
 * @param {number|string} id - ID de la habitación
 * @param {Object} roomData - Datos actualizados
 * @returns {Promise<Object>} Habitación actualizada
 */
export const updateRoom = async (id, roomData) => {
  const isFormData = roomData instanceof FormData;
  
  if (isFormData) {
    roomData.append('_method', 'PUT');
    const response = await api.post(`/staff/rooms/${id}`, roomData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  const response = await api.put(`/staff/rooms/${id}`, roomData);
  return response.data;
};

/**
 * Realiza un cambio rápido de estado de una habitación (1-click).
 * @param {number|string} id - ID de la habitación
 * @param {string} status - Nuevo estado (disponible, ocupada, mantenimiento, limpieza, reservada)
 * @returns {Promise<Object>} Respuesta con el cambio de estado
 */
export const updateRoomStatus = async (id, status) => {
  const response = await api.patch(`/staff/rooms/${id}/status`, { status });
  return response.data;
};

/**
 * Elimina una habitación del inventario si no tiene reservas vigentes.
 * @param {number|string} id - ID de la habitación
 * @returns {Promise<Object>} Mensaje de confirmación
 */
export const deleteRoom = async (id) => {
  const response = await api.delete(`/staff/rooms/${id}`);
  return response.data;
};

export default {
  getStaffRooms,
  getRoomDetails,
  createRoom,
  updateRoom,
  updateRoomStatus,
  deleteRoom,
};
