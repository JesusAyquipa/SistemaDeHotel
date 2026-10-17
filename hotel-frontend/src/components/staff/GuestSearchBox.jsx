import { useId, useState } from 'react';
import useGuestSearch from '../../hooks/useGuestSearch';
import GuestFlags from './GuestFlags';

/**
 * Buscador de huéspedes existentes (personal). Llama a onSelect(guest) al elegir uno.
 */
export default function GuestSearchBox({ onSelect, placeholder = 'Buscar huésped existente...', label = 'Buscar huésped existente', compact = false }) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const results = useGuestSearch(query);

  const handleSelect = (guest) => {
    onSelect(guest);
    setQuery('');
  };

  return (
    <div className="relative">
      <label htmlFor={inputId} className="sr-only">{label}</label>
      <input
        id={inputId}
        type="search"
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={`w-full bg-[#eae8e3] border border-[#d1c5af] focus:outline-none focus:border-[#14213D] ${compact ? 'p-2 text-xs' : 'p-3 text-sm mb-2'}`}
      />
      {results.length > 0 && (
        <ul className="absolute top-full left-0 right-0 bg-[#fbf9f4] border border-[#d1c5af] max-h-48 overflow-y-auto z-10 shadow-lg" role="listbox" aria-label="Resultados de búsqueda">
          {results.map((guest) => (
            <li key={guest.id} role="option" aria-selected="false">
              <button
                type="button"
                className={`w-full text-left hover:bg-[#eae8e3] border-b border-[#d1c5af]/50 ${compact ? 'p-2' : 'p-3'}`}
                onClick={() => handleSelect(guest)}
              >
                <span className={`block font-semibold text-[#1b1c19] ${compact ? 'text-xs' : ''}`}>{guest.name} {guest.surname} <GuestFlags guest={guest} compact /></span>
                <span className={`block text-[#4d4635] ${compact ? 'text-[10px]' : 'text-xs'}`}>
                  {guest.document_type}: {guest.document_number}{!compact && guest.email ? ` | ${guest.email}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
