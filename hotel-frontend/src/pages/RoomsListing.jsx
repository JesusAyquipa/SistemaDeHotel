import { useState, useEffect, useCallback } from 'react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import AvailabilitySearch from '../components/AvailabilitySearch';
import RoomFilters from '../components/RoomFilters';
import RoomCard from '../components/RoomCard';
import CheckoutModal from '../components/CheckoutModal';
import PaymentReceiptModal from '../components/PaymentReceiptModal';
import { getAvailableRooms } from '../services/rooms';

export default function RoomsListing() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para el flujo de reserva y checkout
  const [selectedRoomForBooking, setSelectedRoomForBooking] = useState(null);
  const [activeReceiptBookingCode, setActiveReceiptBookingCode] = useState(null);

  // Parámetros de búsqueda por fechas y huéspedes
  const [searchParams, setSearchParams] = useState({
    check_in: '',
    check_out: '',
    capacity: '1',
  });

  // Filtros visuales adicionales
  const [filters, setFilters] = useState({
    bed_type: 'todos',
    capacity: '',
    min_price: '',
    max_price: '',
    sort_by: 'price_asc',
    search: '',
  });

  // Función para consultar la API con los parámetros activos
  const fetchRooms = useCallback(async (currentSearch, currentFilters) => {
    setLoading(true);
    setError(null);
    try {
      const query = {
        check_in: currentSearch.check_in,
        check_out: currentSearch.check_out,
        bed_type: currentFilters.bed_type !== 'todos' ? currentFilters.bed_type : undefined,
        capacity: currentFilters.capacity || currentSearch.capacity || undefined,
        min_price: currentFilters.min_price || undefined,
        max_price: currentFilters.max_price || undefined,
        sort_by: currentFilters.sort_by || undefined,
        search: currentFilters.search || undefined,
      };

      const data = await getAvailableRooms(query);
      setRooms(data);
    } catch (err) {
      console.error('Error fetching rooms:', err);
      const apiMsg = err.response?.data?.message || 'No se pudo cargar el catálogo de habitaciones. Verifica tu conexión.';
      setError(apiMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Al montar el componente, cargar todas las habitaciones disponibles por defecto
  useEffect(() => {
    fetchRooms(searchParams, filters);
  }, []);

  // Handler cuando se ejecuta la búsqueda de disponibilidad
  const handleSearch = (newSearch) => {
    setSearchParams(newSearch);
    fetchRooms(newSearch, filters);
  };

  // Handler cuando cambian los filtros visuales
  const handleFilterChange = (key, value) => {
    const updatedFilters = {
      ...filters,
      [key]: value,
    };
    setFilters(updatedFilters);
    fetchRooms(searchParams, updatedFilters);
  };

  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] flex flex-col font-sans">
      <PublicHeader />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-8 pb-12">
          <div className="relative h-[320px] sm:h-[420px] w-full flex items-center justify-center overflow-hidden border border-[#d1c5af] bg-[#f5f3ee] p-4">
            <div
              className="absolute inset-2 bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1600&q=80')",
              }}
            />
            <div className="absolute inset-2 bg-[#14213d] opacity-40" />

            <div className="relative z-10 text-center bg-[#fbf9f4]/95 p-6 sm:p-10 border border-[#d1c5af] shadow-[2px_2px_0px_rgba(20,33,61,0.15)] max-w-xl mx-auto backdrop-blur-xs">
              <span className="font-mono text-xs text-[#755b00] uppercase tracking-widest block mb-2 font-bold">
                Sheraton Lima • Catálogo Exclusivo
              </span>
              <h1 className="font-serif text-2xl sm:text-4xl font-bold text-[#1b1c19] mb-3">
                Un Legado de Confort.
              </h1>
              <p className="font-sans text-xs sm:text-sm text-[#4d4635] leading-relaxed">
                Descubre nuestras habitaciones y suites patrimoniales diseñadas para ofrecer una estadía inolvidable.
              </p>
            </div>
          </div>

          {/* Barra de Búsqueda de Disponibilidad */}
          <div className="relative -mt-10 sm:-mt-12 z-20 mx-auto max-w-4xl px-2 sm:px-4">
            <AvailabilitySearch
              searchParams={searchParams}
              onSearch={handleSearch}
              loading={loading}
            />
          </div>
        </section>

        {/* Sección de Catálogo y Filtros */}
        <section className="bg-[#f5f3ee] py-12 border-y border-[#d1c5af]">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
            {/* Header del Catálogo */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 border-b border-[#d1c5af] pb-4">
              <div>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1b1c19]">
                  Habitaciones Disponibles
                </h2>
                <p className="font-mono text-xs text-[#4d4635] mt-1">
                  {searchParams.check_in && searchParams.check_out
                    ? `Disponibilidad verificada para: ${searchParams.check_in} al ${searchParams.check_out}`
                    : 'Mostrando catálogo general de habitaciones habilitadas'}
                </p>
              </div>

              <div className="font-mono text-xs text-[#755b00] font-bold uppercase tracking-wider">
                {rooms.length} {rooms.length === 1 ? 'Habitación encontrada' : 'Habitaciones encontradas'}
              </div>
            </div>

            {/* Barra de Filtros Visuales */}
            <div className="mb-8">
              <RoomFilters filters={filters} onFilterChange={handleFilterChange} />
            </div>

            {/* Estado de Error */}
            {error && (
              <div className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-6 rounded-xs text-[#93000a] my-8 text-center font-mono text-sm shadow-sm">
                <span className="material-symbols-outlined text-3xl mb-2 block">error</span>
                <p className="font-bold">{error}</p>
                <button
                  onClick={() => fetchRooms(searchParams, filters)}
                  className="mt-4 px-4 py-2 bg-[#ba1a1a] text-white rounded-xs uppercase text-xs font-bold hover:bg-[#93000a] transition-colors"
                >
                  Reintentar Búsqueda
                </button>
              </div>
            )}

            {/* Estado de Carga (Skeletons) */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="bg-[#fbf9f4] border border-[#d1c5af] animate-pulse flex flex-col p-4"
                  >
                    <div className="h-48 bg-[#e4e2dd] mb-4"></div>
                    <div className="h-6 bg-[#e4e2dd] w-3/4 mb-2"></div>
                    <div className="h-4 bg-[#e4e2dd] w-full mb-2"></div>
                    <div className="h-4 bg-[#e4e2dd] w-2/3 mb-6"></div>
                    <div className="mt-auto h-8 bg-[#e4e2dd]"></div>
                  </div>
                ))}
              </div>
            )}

            {/* Grid de Habitaciones Reales */}
            {!loading && !error && rooms.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {rooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onSelect={(selectedRoom) => {
                      setSelectedRoomForBooking(selectedRoom);
                    }}
                  />
                ))}
              </div>
            )}

            {/* Estado Vacío */}
            {!loading && !error && rooms.length === 0 && (
              <div className="bg-[#fbf9f4] border border-[#d1c5af] p-12 text-center max-w-lg mx-auto shadow-sm my-8">
                <span className="material-symbols-outlined text-5xl text-[#755b00] mb-3">
                  door_front
                </span>
                <h3 className="font-serif text-xl font-bold text-[#1b1c19] mb-2">
                  No hay habitaciones disponibles
                </h3>
                <p className="font-sans text-xs sm:text-sm text-[#4d4635] mb-6 leading-relaxed">
                  {searchParams.check_in && searchParams.check_out
                    ? 'No encontramos habitaciones libres que coincidan con las fechas o filtros seleccionados. Intenta con un rango de fechas diferente o modifica los filtros.'
                    : 'No se encontraron habitaciones con los filtros aplicados.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const defaultSearch = { check_in: '', check_out: '', capacity: '1' };
                    const defaultFilters = {
                      bed_type: 'todos',
                      capacity: '',
                      min_price: '',
                      max_price: '',
                      sort_by: 'price_asc',
                      search: '',
                    };
                    setSearchParams(defaultSearch);
                    setFilters(defaultFilters);
                    fetchRooms(defaultSearch, defaultFilters);
                  }}
                  className="bg-[#c9a227] text-[#14213d] font-mono text-xs uppercase px-6 py-3 font-bold hover:brightness-105 transition-all shadow-sm cursor-pointer"
                >
                  Ver Todas las Habitaciones
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <PublicFooter />

      {/* Modal de Checkout Seguro y Pago en Línea */}
      {selectedRoomForBooking && (
        <CheckoutModal
          room={selectedRoomForBooking}
          initialDates={{
            check_in: searchParams.check_in,
            check_out: searchParams.check_out,
          }}
          onClose={() => setSelectedRoomForBooking(null)}
          onPaymentSuccess={(result) => {
            const code = result?.booking_code || result?.booking?.booking_code;
            setSelectedRoomForBooking(null);
            if (code) {
              setActiveReceiptBookingCode(code);
            }
            // Recargar catálogo para refrescar disponibilidades
            fetchRooms(searchParams, filters);
          }}
        />
      )}

      {/* Modal de Comprobante Digital de Pago (Voucher / Recibo Imprimible) */}
      {activeReceiptBookingCode && (
        <PaymentReceiptModal
          bookingCode={activeReceiptBookingCode}
          onClose={() => setActiveReceiptBookingCode(null)}
        />
      )}
    </div>
  );
}

