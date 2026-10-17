import api from './api';

/**
 * Galería de imágenes por habitación (SHE-035). Solo admin para mutaciones.
 */

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Valida en cliente tipo y tamaño. Devuelve un mensaje de error o null. */
export function validateImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `"${file.name}": formato no permitido (solo JPG, PNG o WEBP).`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `"${file.name}": supera el máximo de 4 MB.`;
  }
  return null;
}

export const getRoomImages = async (roomId) => {
  const response = await api.get(`/staff/rooms/${roomId}/images`);
  return response.data.images || [];
};

export const uploadRoomImages = async (roomId, files) => {
  const form = new FormData();
  files.forEach((file) => form.append('images[]', file));
  const response = await api.post(`/staff/rooms/${roomId}/images`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.images || [];
};

export const reorderRoomImages = async (roomId, order) => {
  const response = await api.patch(`/staff/rooms/${roomId}/images/reorder`, { order });
  return response.data.images || [];
};

export const setPrimaryRoomImage = async (roomId, imageId) => {
  const response = await api.patch(`/staff/rooms/${roomId}/images/${imageId}/primary`);
  return response.data.images || [];
};

export const deleteRoomImage = async (roomId, imageId) => {
  const response = await api.delete(`/staff/rooms/${roomId}/images/${imageId}`);
  return response.data.images || [];
};

export default {
  getRoomImages,
  uploadRoomImages,
  reorderRoomImages,
  setPrimaryRoomImage,
  deleteRoomImage,
  validateImageFile,
};
