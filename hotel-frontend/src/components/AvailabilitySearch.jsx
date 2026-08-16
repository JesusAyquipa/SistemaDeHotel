import { useState } from 'react';

export default function AvailabilitySearch({ searchParams, onSearch, loading }) {
  const [dates, setDates] = useState({
    check_in: searchParams.check_in || '',
    check_out: searchParams.check_out || '',
    capacity: searchParams.capacity || '1',
  });
  const [dateError, setDateError] = useState('');

  // Fecha de hoy en formato YYYY-MM-DD para el atributo min
  const today = new Date().toISOString().split('T')[0];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDates((prev) => ({
      ...prev,
      [name]: value,
    }));
    setDateError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (dates.check_in && !dates.check_out) {
      setDateError('Por favor selecciona también la fecha de salida.');
      return;
    }

    if (!dates.check_in && dates.check_out) {
      setDateError('Por favor selecciona también la fecha de llegada.');
      return;
    }

    if (dates.check_in && dates.check_out) {
      if (dates.check_out <= dates.check_in) {
        setDateError('La fecha de salida debe ser posterior a la fecha de llegada.');
        return;
      }
    }

    onSearch({
      check_in: dates.check_in,
      check_out: dates.check_out,
      capacity: dates.capacity,
    });
  };

  const handleClear = () => {
    setDates({
      check_in: '',
      check_out: '',
      capacity: '1',
    });
    setDateError('');
    onSearch({
      check_in: '',
      check_out: '',
      capacity: '1',
    });
  };

  return (
    <div className="bg-[#fbf9f4] border border-[#d1c5af] p-5 sm:p-6 shadow-[2px_2px_0px_rgba(20,33,61,0.1)]">
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-5 items-end">
        {/* Check In */}
        <div className="flex-1 w-full">
          <label
            htmlFor="check_in"
            className="block font-mono text-xs uppercase tracking-wider text-[#4d4635] mb-2 font-medium"
          >
            Llegada (Check In)
          </label>
          <input
            id="check_in"
            name="check_in"
            type="date"
            min={today}
            value={dates.check_in}
            onChange={handleChange}
            className="w-full bg-transparent border-0 border-b-2 border-[#d1c5af] focus:border-[#14213d] focus:ring-0 px-1 py-2 font-sans text-sm text-[#1b1c19] outline-none transition-colors"
          />
        </div>

        {/* Check Out */}
        <div className="flex-1 w-full">
          <label
            htmlFor="check_out"
            className="block font-mono text-xs uppercase tracking-wider text-[#4d4635] mb-2 font-medium"
          >
            Salida (Check Out)
          </label>
          <input
            id="check_out"
            name="check_out"
            type="date"
            min={dates.check_in || today}
            value={dates.check_out}
            onChange={handleChange}
            className="w-full bg-transparent border-0 border-b-2 border-[#d1c5af] focus:border-[#14213d] focus:ring-0 px-1 py-2 font-sans text-sm text-[#1b1c19] outline-none transition-colors"
          />
        </div>

        {/* Guests / Capacity */}
        <div className="flex-1 w-full">
          <label
            htmlFor="capacity"
            className="block font-mono text-xs uppercase tracking-wider text-[#4d4635] mb-2 font-medium"
          >
            Huéspedes
          </label>
          <select
            id="capacity"
            name="capacity"
            value={dates.capacity}
            onChange={handleChange}
            className="w-full bg-transparent border-0 border-b-2 border-[#d1c5af] focus:border-[#14213d] focus:ring-0 px-1 py-2 font-sans text-sm text-[#1b1c19] outline-none transition-colors cursor-pointer"
          >
            <option value="1">1 Huésped</option>
            <option value="2">2 Huéspedes</option>
            <option value="3">3 Huéspedes</option>
            <option value="4">4+ Huéspedes</option>
          </select>
        </div>

        {/* Botones */}
        <div className="w-full md:w-auto flex items-center gap-2">
          {(dates.check_in || dates.check_out) && (
            <button
              type="button"
              onClick={handleClear}
              className="bg-transparent border border-[#d1c5af] hover:bg-[#eae8e3] text-[#4d4635] font-mono text-xs uppercase px-4 py-3.5 transition-all font-semibold"
              title="Limpiar fechas"
            >
              Limpiar
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex-1 md:flex-initial bg-[#c9a227] text-[#14213d] font-mono text-xs uppercase tracking-wider px-6 sm:px-8 py-3.5 border border-[#a68a4d] hover:brightness-105 transition-all shadow-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-[#14213d] border-t-transparent rounded-full animate-spin"></span>
                <span>Buscando...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">search</span>
                <span>Buscar Disponibilidad</span>
              </>
            )}
          </button>
        </div>
      </form>

      {dateError && (
        <div className="mt-3 p-2 bg-[#ffdad6] border border-[#ba1a1a]/30 text-[#93000a] font-mono text-xs rounded-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">warning</span>
          <span>{dateError}</span>
        </div>
      )}
    </div>
  );
}
