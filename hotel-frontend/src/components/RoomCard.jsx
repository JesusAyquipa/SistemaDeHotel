// Imágenes representativas por defecto según el tipo de cama/suite si no hay URL en BD
const DEFAULT_IMAGES = {
  individual: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
  doble: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80',
  king: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
  default: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80',
};

export default function RoomCard({ room, onSelect }) {
  const imageUrl = room.image_url || DEFAULT_IMAGES[room.bed_type] || DEFAULT_IMAGES.default;

  const bedTypeLabels = {
    individual: 'Cama Individual',
    doble: 'Cama Doble',
    king: 'Cama King Size',
  };

  const formattedPrice = Number(room.price_per_night).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="bg-[#fbf9f4] border border-[#d1c5af] flex flex-col group hover:shadow-[4px_4px_0px_rgba(20,33,61,0.15)] transition-all duration-300">
      {/* Header Imagen con Badge de Habitación */}
      <div className="h-60 border-b border-[#d1c5af] overflow-hidden relative p-2 bg-[#eae8e3]">
        <div
          className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url('${imageUrl}')` }}
          role="img"
          aria-label={room.name}
        />
        {/* Número de Habitación */}
        <div className="absolute top-4 left-4 bg-[#c9a227] text-[#14213d] px-3 py-1 font-mono text-xs font-bold border border-[#14213d] shadow-sm">
          HAB {room.room_number}
        </div>
        {/* Tipo de Cama Badge */}
        <div className="absolute top-4 right-4 bg-[#fbf9f4]/90 backdrop-blur-xs text-[#4d4635] px-2.5 py-1 font-mono text-[11px] uppercase border border-[#d1c5af]">
          {bedTypeLabels[room.bed_type] || room.bed_type}
        </div>
      </div>

      {/* Contenido de la Tarjeta */}
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="font-serif font-bold text-xl text-[#1b1c19] mb-2 line-clamp-1">
          {room.name}
        </h3>

        <p className="font-sans text-xs sm:text-sm text-[#4d4635] mb-6 line-clamp-3 leading-relaxed">
          {room.description || 'Alojamiento confortable con acabados de primera calidad, baño privado y servicio a la habitación.'}
        </p>

        {/* Footer con Metadatos y Precio */}
        <div className="mt-auto border-t border-[#d1c5af] pt-4 flex items-center justify-between">
          {/* Capacidad y Tamaño */}
          <div className="flex items-center gap-4 text-[#4d4635]">
            <div className="flex items-center gap-1" title="Capacidad de personas">
              <span className="material-symbols-outlined text-base text-[#755b00]">person</span>
              <span className="font-mono text-xs font-semibold">{room.capacity} {room.capacity === 1 ? 'huésped' : 'huéspedes'}</span>
            </div>
            {room.size_m2 && (
              <div className="flex items-center gap-1" title="Tamaño en metros cuadrados">
                <span className="material-symbols-outlined text-base text-[#755b00]">square_foot</span>
                <span className="font-mono text-xs">{room.size_m2} m²</span>
              </div>
            )}
          </div>

          {/* Precio por Noche */}
          <div className="text-right">
            <span className="font-mono text-[10px] text-[#4d4635] uppercase block">Por noche</span>
            <span className="font-mono text-base sm:text-lg font-bold text-[#14213d]">
              S/ {formattedPrice}
            </span>
          </div>
        </div>

        {/* Botón de acción */}
        <button
          type="button"
          onClick={() => onSelect && onSelect(room)}
          className="w-full mt-4 bg-[#f5f3ee] hover:bg-[#c9a227] text-[#14213d] border border-[#d1c5af] hover:border-[#a68a4d] py-2.5 font-mono text-xs uppercase tracking-wider font-bold transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Seleccionar Habitación</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
