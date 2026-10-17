import { Link } from 'react-router-dom';
import { roomImage } from '../constants/rooms';

export default function RoomCard({ room, onSelect }) {
  const imageUrl = roomImage(room);

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
          {room.room_type?.name || bedTypeLabels[room.bed_type] || room.bed_type}
        </div>
      </div>

      {/* Contenido de la Tarjeta */}
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="font-serif font-bold text-xl text-[#1b1c19] mb-2 line-clamp-1">
          {room.name}
        </h3>

        {/* Calificación promedio de reseñas publicadas (SHE-037) */}
        {Number(room.reviews_count) > 0 && room.rating_avg != null && (
          <div className="flex items-center gap-1 mb-2" aria-label={`Calificación ${Number(room.rating_avg).toFixed(1)} de 5 (${room.reviews_count} reseñas)`}>
            <span className="material-symbols-outlined text-base text-[#c9a227]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">star</span>
            <span className="font-mono text-xs font-bold text-[#14213d]">{Number(room.rating_avg).toFixed(1)}</span>
            <span className="font-mono text-[11px] text-[#4d4635]">({room.reviews_count} {Number(room.reviews_count) === 1 ? 'reseña' : 'reseñas'})</span>
          </div>
        )}

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

        {/* Acciones: ver detalle / reservar */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Link
            to={`/habitaciones/${room.id}`}
            aria-label={`Ver detalle de ${room.name}`}
            className="w-full bg-transparent hover:bg-[#eae8e3] text-[#14213d] border border-[#14213d] py-2.5 font-mono text-xs uppercase tracking-wider font-bold transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">visibility</span>
            <span>Ver detalle</span>
          </Link>
          <button
            type="button"
            onClick={() => onSelect && onSelect(room)}
            className="w-full bg-[#f5f3ee] hover:bg-[#c9a227] text-[#14213d] border border-[#d1c5af] hover:border-[#a68a4d] py-2.5 font-mono text-xs uppercase tracking-wider font-bold transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Reservar</span>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
