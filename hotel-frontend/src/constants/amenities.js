/**
 * Catálogo de comodidades (SHE-035). Reflejo de hotel-backend/config/amenities.php:
 * clave => { label (español), icon (Material Symbols Outlined) }.
 */
export const AMENITIES = {
  wifi: { label: 'Wi-Fi de alta velocidad', icon: 'wifi' },
  tv: { label: 'Smart TV', icon: 'tv' },
  ac: { label: 'Aire acondicionado', icon: 'ac_unit' },
  heating: { label: 'Calefacción', icon: 'heat' },
  bath: { label: 'Baño privado', icon: 'shower' },
  bathtub: { label: 'Bañera', icon: 'bathtub' },
  safe: { label: 'Caja fuerte', icon: 'lock' },
  room_service: { label: 'Servicio a la habitación', icon: 'room_service' },
  minibar: { label: 'Frigobar', icon: 'kitchen' },
  coffee: { label: 'Cafetera de cortesía', icon: 'coffee_maker' },
  bathrobe: { label: 'Batas y amenities premium', icon: 'dry_cleaning' },
  desk: { label: 'Escritorio de trabajo', icon: 'desk' },
  balcony: { label: 'Balcón / terraza', icon: 'balcony' },
  view: { label: 'Vista panorámica', icon: 'landscape' },
  living_room: { label: 'Sala de estar', icon: 'weekend' },
  butler: { label: 'Servicio de mayordomo', icon: 'concierge' },
  accessible: { label: 'Accesible', icon: 'accessible' },
  pet_friendly: { label: 'Acepta mascotas', icon: 'pets' },
};

export const AMENITY_KEYS = Object.keys(AMENITIES);

/** Convierte claves en [{ key, label, icon }] ignorando las desconocidas. */
export function describeAmenities(keys = []) {
  return [...new Set(keys || [])]
    .filter((key) => AMENITIES[key])
    .map((key) => ({ key, ...AMENITIES[key] }));
}
