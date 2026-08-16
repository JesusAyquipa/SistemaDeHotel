export default function RoomFilters({ filters, onFilterChange }) {
  const bedTypes = [
    { value: 'todos', label: 'Todas las camas' },
    { value: 'individual', label: 'Individual' },
    { value: 'doble', label: 'Doble' },
    { value: 'king', label: 'King Size' },
  ];

  const capacities = [
    { value: '', label: 'Cualquier capacidad' },
    { value: '1', label: 'Mínimo 1 huésped' },
    { value: '2', label: 'Mínimo 2 huéspedes' },
    { value: '3', label: 'Mínimo 3 huéspedes' },
    { value: '4', label: 'Mínimo 4 huéspedes' },
  ];

  return (
    <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[#755b00]">tune</span>
        <span className="font-mono text-xs uppercase tracking-wider font-semibold text-[#1b1c19]">
          Filtros de Búsqueda:
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* Filtro Tipo de Cama */}
        <div className="flex items-center gap-2">
          <label htmlFor="bed_type_filter" className="font-mono text-xs text-[#4d4635] uppercase">
            Tipo de Cama:
          </label>
          <select
            id="bed_type_filter"
            value={filters.bed_type || 'todos'}
            onChange={(e) => onFilterChange('bed_type', e.target.value)}
            className="bg-[#fbf9f4] border border-[#d1c5af] px-3 py-1.5 font-mono text-xs text-[#1b1c19] rounded-sm focus:border-[#14213d] outline-none cursor-pointer"
          >
            {bedTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro Capacidad Mínima */}
        <div className="flex items-center gap-2">
          <label htmlFor="capacity_filter" className="font-mono text-xs text-[#4d4635] uppercase">
            Capacidad:
          </label>
          <select
            id="capacity_filter"
            value={filters.capacity || ''}
            onChange={(e) => onFilterChange('capacity', e.target.value)}
            className="bg-[#fbf9f4] border border-[#d1c5af] px-3 py-1.5 font-mono text-xs text-[#1b1c19] rounded-sm focus:border-[#14213d] outline-none cursor-pointer"
          >
            {capacities.map((cap) => (
              <option key={cap.value} value={cap.value}>
                {cap.label}
              </option>
            ))}
          </select>
        </div>

        {/* Botón Restablecer si hay filtros aplicados */}
        {(filters.bed_type !== 'todos' || filters.capacity) && (
          <button
            type="button"
            onClick={() => {
              onFilterChange('bed_type', 'todos');
              onFilterChange('capacity', '');
            }}
            className="text-xs font-mono text-[#984543] hover:underline uppercase flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            Restablecer filtros
          </button>
        )}
      </div>
    </div>
  );
}
