import api from './api';

/**
 * Tipos de habitación (SHE-034).
 */

/** Tipos activos para filtros públicos. GET /api/room-types */
export const getPublicRoomTypes = async ({ signal } = {}) => {
  const response = await api.get('/room-types', { signal });
  return response.data.room_types || [];
};

/** Listado para el panel (admin|recepcionista). GET /api/staff/room-types */
export const getRoomTypes = async (params = {}) => {
  const response = await api.get('/staff/room-types', { params });
  return response.data; // { room_types, amenity_catalog }
};

export const createRoomType = async (data) => {
  const response = await api.post('/staff/room-types', data);
  return response.data;
};

export const updateRoomType = async (id, data) => {
  const response = await api.put(`/staff/room-types/${id}`, data);
  return response.data;
};

export const deleteRoomType = async (id) => {
  const response = await api.delete(`/staff/room-types/${id}`);
  return response.data;
};

export default {
  getPublicRoomTypes,
  getRoomTypes,
  createRoomType,
  updateRoomType,
  deleteRoomType,
};
