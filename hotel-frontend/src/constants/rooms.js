import assetUrl from '../utils/assetUrl';

// Imágenes por defecto si la habitación no tiene imagen propia.
export const DEFAULT_ROOM_IMAGES = {
  individual: '/images/rooms/photo-1590490360182-c33d57733427.jpg',
  doble: '/images/rooms/photo-1566665797739-1674de7a421a.jpg',
  king: '/images/rooms/photo-1582719478250-c89cae4dc85b.jpg',
  default: '/images/rooms/photo-1618773928121-c32242e63f39.jpg',
};

/** Imágenes de la galería ordenadas (principal primero). SHE-035 */
export function roomImages(room) {
  const list = Array.isArray(room?.images) ? [...room.images] : [];
  list.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return list.map((img) => ({ ...img, url: assetUrl(img.url) }));
}

export function roomImage(room) {
  const gallery = roomImages(room);
  if (gallery.length > 0) return gallery[0].url;
  if (room?.image_url) return assetUrl(room.image_url);
  return DEFAULT_ROOM_IMAGES[room?.bed_type] || DEFAULT_ROOM_IMAGES.default;
}

/** Etiquetas cortas de tipo de habitación (según tipo de cama). */
export const ROOM_TYPE_LABELS = {
  individual: 'Individual',
  doble: 'Doble',
  king: 'King',
};
