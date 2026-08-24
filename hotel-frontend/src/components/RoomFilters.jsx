import { useState } from 'react';

export default function RoomFilters({ filters, onFilterChange }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const bedTypes = [
    { value: 'todos', label: 'Todas las camas' },
    { value: 'individual', label: 'Individual' },
    { value: 'doble', label: 'Doble' },
    { value: 'king', label: 'King Size / Suite' },
  ];

  const capacities = [
    { value: '', label: 'Cualquier capacidad' },
    { value: '1', label: 'Mínimo 1 huésped' },
    { value: '2', label: 'Mínimo 2 huéspedes' },
    { value: '3', label: 'Mínimo 3 huéspedes' },
    { value: '4', label: 'Mínimo 4 huéspedes' },
  ];

  const sortOptions = [
    { value: 'price_asc', label: 'Precio: Menor a Mayor' },
    { value: 'price_desc', label: 'Precio: Mayor a Menor' },
    { value: 'capacity_desc', label: 'Mayor Capacidad' },
    { value: 'size_desc', label: 'Mayor Tamaño (m²)' },
  ];

  const priceTiers = [
    { label: 'Todos los precios', min: '', max: '' },
    { label: 'Hasta S/ 250', min: '', max: '250' },
    { label: 'S/ 250 - S/ 450', min: '250', max: '450' },
    { label: 'Más de S/ 450 (Suites)', min: '450', max: '' },
  ];

  const hasActiveFilters =
    (filters.bed_type && filters.bed_type !== 'todos') ||
    filters.capacity ||
    filters.min_price ||
    filters.max_price ||
    filters.search ||
    (filters.sort_by && filters.sort_by !== 'price_asc');

  const handlePriceTierSelect = (tier) => {
    onFilterChange('min_price', tier.min);
    onFilterChange('max_price', tier.max);
  };

  const handleReset = () => {
    onFilterChange('bed_type', 'todos');
    onFilterChange('capacity', '');
    onFilterChange('min_price', '');
    onFilterChange('max_price', '');
    onFilterChange('search', '');
    onFilterChange('sort_by', 'price_asc');
  };

  return (
    <div className="bg-[#fbf9f4] border border-[#d1c5af] p-5 shadow-[2px_2px_0px_rgba(20,33,61,0.08)] space-y-4">
      {/* Barra Superior: Filtros Rápidos, Búsqueda y Orden */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        
        {/* Búsqueda por palabra clave */}
        <div className="relative flex-1 min-w-[240px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#755b00] text-sm">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar por suite, clásica, vista, hab..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-full bg-[#f5f3ee] border border-[#d1c5af] pl-9 pr-4 py-2 font-sans text-xs text-[#1b1c19] focus:border-[#14213d] outline-none transition-colors"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onFilterChange('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716c] hover:text-[#1b1c19] text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filtros Principales */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Tipo de Habitación / Cama */}
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#755b00] text-base">bed</span>
            <select
              id="bed_type_filter"
              value={filters.bed_type || 'todos'}
              onChange={(e) => onFilterChange('bed_type', e.target.value)}
              className="bg-[#f5f3ee] border border-[#d1c5af] px-3 py-2 font-mono text-xs text-[#1b1c19] focus:border-[#14213d] outline-none cursor-pointer"
            >
              {bedTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Capacidad */}
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#755b00] text-base">group</span>
            <select
              id="capacity_filter"
              value={filters.capacity || ''}
              onChange={(e) => onFilterChange('capacity', e.target.value)}
              className="bg-[#f5f3ee] border border-[#d1c5af] px-3 py-2 font-mono text-xs text-[#1b1c19] focus:border-[#14213d] outline-none cursor-pointer"
            >
              {capacities.map((cap) => (
                <option key={cap.value} value={cap.value}>
                  {cap.label}
                </option>
              ))}
            </select>
          </div>

          {/* Ordenamiento */}
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#755b00] text-base">swap_vert</span>
            <select
              id="sort_by_filter"
              value={filters.sort_by || 'price_asc'}
              onChange={(e) => onFilterChange('sort_by', e.target.value)}
              className="bg-[#f5f3ee] border border-[#d1c5af] px-3 py-2 font-mono text-xs text-[#1b1c19] focus:border-[#14213d] outline-none cursor-pointer"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Botón de Filtros Avanzados de Precio */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-3 py-2 border font-mono text-xs uppercase flex items-center gap-1 transition-colors cursor-pointer ${
              showAdvanced || filters.min_price || filters.max_price
                ? 'bg-[#14213d] text-[#fbf9f4] border-[#14213d]'
                : 'bg-[#f5f3ee] text-[#14213d] border-[#d1c5af] hover:border-[#14213d]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">attach_money</span>
            <span>Precios</span>
            <span className="material-symbols-outlined text-xs">
              {showAdvanced ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* Botón Restablecer */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-mono text-[#984543] hover:underline uppercase flex items-center gap-1 cursor-pointer ml-auto"
              title="Restablecer todos los filtros"
            >
              <span className="material-symbols-outlined text-sm">restart_alt</span>
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* Panel Desplegable: Filtro Específico por Rango de Precio */}
      {showAdvanced && (
        <div className="pt-4 border-t border-[#d1c5af] bg-[#f5f3ee] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn">
          <div>
            <span className="font-mono text-xs font-bold uppercase text-[#755b00] block mb-2">
              Rangos de Precio Sugeridos:
            </span>
            <div className="flex flex-wrap gap-2">
              {priceTiers.map((tier, idx) => {
                const isSelected = filters.min_price === tier.min && filters.max_price === tier.max;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePriceTierSelect(tier)}
                    className={`px-3 py-1 text-xs font-mono border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#c9a227] text-[#14213d] border-[#14213d] font-bold shadow-xs'
                        : 'bg-[#fbf9f4] text-[#4d4635] border-[#d1c5af] hover:border-[#14213d]'
                    }`}
                  >
                    {tier.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div>
              <label className="block font-mono text-[10px] uppercase text-[#78716c]">Min (S/)</label>
              <input
                type="number"
                min="0"
                step="10"
                placeholder="0"
                value={filters.min_price || ''}
                onChange={(e) => onFilterChange('min_price', e.target.value)}
                className="w-24 bg-[#fbf9f4] border border-[#d1c5af] p-1.5 font-mono text-xs text-[#1b1c19] focus:border-[#14213d] outline-none"
              />
            </div>
            <span className="text-[#78716c] mt-3">—</span>
            <div>
              <label className="block font-mono text-[10px] uppercase text-[#78716c]">Max (S/)</label>
              <input
                type="number"
                min="0"
                step="10"
                placeholder="1500"
                value={filters.max_price || ''}
                onChange={(e) => onFilterChange('max_price', e.target.value)}
                className="w-24 bg-[#fbf9f4] border border-[#d1c5af] p-1.5 font-mono text-xs text-[#1b1c19] focus:border-[#14213d] outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
