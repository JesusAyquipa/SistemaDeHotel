import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import EditBookingModal from '../../components/staff/EditBookingModal';

export default function BookingManagement() {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Example static data based on the provided HTML, or fetch from API
  useEffect(() => {
    // In a real scenario we'd fetch from /api/bookings (which needs a new endpoint to list all bookings)
    // For now, we simulate the data from the HTML
    setBookings([
      { id: 1, code: 'RES-001', guest: 'Juan Pérez', checkIn: '2024-10-12', checkOut: '2024-10-15', room: 'Standard 101', status: 'Confirmada', statusColor: 'text-[#2E7A4A] bg-[#2E7A4A]/20' },
      { id: 2, code: 'RES-002', guest: 'María Gómez', checkIn: '2024-10-14', checkOut: '2024-10-18', room: 'Deluxe 205', status: 'Pendiente', statusColor: 'text-[#755b00] bg-[#755b00]/20' },
      { id: 3, code: 'RES-003', guest: 'Carlos Ruiz', checkIn: '2024-10-10', checkOut: '2024-10-12', room: 'Suite 301', status: 'Check-in', statusColor: 'text-[#14213D] bg-[#14213D]/10' },
    ]);
    setLoading(false);
  }, []);

  const openEditModal = (booking) => {
    setSelectedBooking(booking);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setSelectedBooking(null);
    setIsEditModalOpen(false);
  };

  const handleDelete = async (id) => {
    if (confirm('¿Está seguro que desea cancelar esta reserva?')) {
      try {
        // Implement real cancellation
        // await axios.post(`/api/bookings/${id}/cancel`);
        alert('Lógica de cancelación a implementar en el backend');
      } catch (error) {
        console.error(error);
      }
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen md:flex-row bg-[#dcdad5] font-sans">
      {/* Sidebar - As provided in HTML */}
      <nav className="hidden md:flex flex-col h-screen w-64 bg-[#fbf9f4] border-r border-[#d1c5af] p-2 flex-shrink-0 z-10 sticky top-0">
        <div className="mb-4 px-4 py-4 border-b border-[#d1c5af]">
          <h1 className="font-serif font-bold text-xl text-[#1b1c19]">The Grand Ledger</h1>
          <p className="font-mono text-[10px] text-[#4d4635] uppercase tracking-widest mt-1">SISTEMA HOTELERO</p>
        </div>
        
        <div className="flex items-center gap-3 px-4 py-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#eae8e3] flex items-center justify-center border border-[#d1c5af]">
            <span className="material-symbols-outlined text-[#4d4635]">person</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1b1c19] leading-tight">Administrador</p>
            <p className="font-mono text-[10px] text-[#4d4635]">Administrador Princi...</p>
          </div>
        </div>
        
        <div className="px-2 mb-6">
          <button className="w-full bg-[#c9a227] text-[#4b3a00] font-mono text-xs font-medium uppercase py-2.5 rounded-sm hover:opacity-90 transition-colors shadow-sm flex items-center justify-center">
            <span className="material-symbols-outlined mr-2 text-[18px]">add</span>NUEVA RESERVA
          </button>
        </div>
        
        <ul className="flex-1 space-y-1 overflow-y-auto px-2">
          <li>
            <Link to="/recepcionista/habitaciones" className="flex items-center px-4 py-2.5 text-[#4d4635] hover:bg-[#eae8e3] transition-all rounded-sm">
              <span className="material-symbols-outlined mr-3 text-[20px]">door_front</span>
              <span className="font-mono text-xs font-medium uppercase tracking-wider">HABITACIONES</span>
            </Link>
          </li>
          <li>
            <Link to="/recepcionista/reservas" className="flex items-center px-4 py-2.5 bg-[#c9a227]/20 text-[#c9a227] font-semibold border-l-4 border-[#c9a227] rounded-r-sm">
              <span className="material-symbols-outlined mr-3 text-[20px]">calendar_month</span>
              <span className="font-mono text-xs font-medium uppercase tracking-wider">RESERVAS</span>
            </Link>
          </li>
          <li>
            <Link to="/recepcionista/huespedes/nuevo" className="flex items-center px-4 py-2.5 text-[#4d4635] hover:bg-[#eae8e3] transition-all rounded-sm">
              <span className="material-symbols-outlined mr-3 text-[20px]">group</span>
              <span className="font-mono text-xs font-medium uppercase tracking-wider">HUÉSPEDES</span>
            </Link>
          </li>
        </ul>
        
        <div className="px-2 pt-4 border-t border-[#d1c5af] mt-2 mb-4">
          <ul className="space-y-1">
            <li>
              <Link to="/" className="flex items-center px-4 py-2 text-[#4d4635] hover:bg-[#eae8e3] transition-all rounded-sm">
                <span className="material-symbols-outlined mr-3 text-[18px]">logout</span>
                <span className="font-mono text-xs font-medium uppercase">VOLVER AL INICIO</span>
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-12 overflow-y-auto bg-[#dcdad5]">
        <div className="flex flex-col w-full py-12 gap-8 bg-[#EDEBE6] rounded border border-[#d1c5af] p-8">
          <div className="flex flex-col gap-4">
            <h1 className="font-serif text-4xl font-bold text-[#14213D] tracking-tight">Gestión de Reservas</h1>
            <p className="text-lg text-[#14213D]/70 max-w-2xl">Administre y supervise todas las reservas del hotel.</p>
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#F7F6F3] p-6 border border-[#D1CEC5]">
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs font-medium text-[#14213D]/60 uppercase tracking-widest">Rango de Fechas</label>
                <div className="relative">
                  <select className="bg-transparent border-b-2 border-[#D1CEC5] focus:border-[#14213D] outline-none py-2 pr-8 text-[#14213D] appearance-none transition-colors cursor-pointer">
                    <option>Esta Semana</option>
                    <option>Este Mes</option>
                    <option>Próximo Mes</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-[#14213D] pointer-events-none">expand_more</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs font-medium text-[#14213D]/60 uppercase tracking-widest">Estado</label>
                <div className="relative">
                  <select className="bg-transparent border-b-2 border-[#D1CEC5] focus:border-[#14213D] outline-none py-2 pr-8 text-[#14213D] appearance-none transition-colors cursor-pointer">
                    <option>Todos</option>
                    <option>Confirmada</option>
                    <option>Pendiente</option>
                    <option>Check-in</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-[#14213D] pointer-events-none">expand_more</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs font-medium text-[#14213D]/60 uppercase tracking-widest">Tipo de Habitación</label>
                <div className="relative">
                  <select className="bg-transparent border-b-2 border-[#D1CEC5] focus:border-[#14213D] outline-none py-2 pr-8 text-[#14213D] appearance-none transition-colors cursor-pointer">
                    <option>Todas</option>
                    <option>Standard</option>
                    <option>Deluxe</option>
                    <option>Suite</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-[#14213D] pointer-events-none">expand_more</span>
                </div>
              </div>
            </div>
            <button className="bg-[#755b00] text-white font-mono text-sm font-medium px-6 py-3 uppercase tracking-widest hover:bg-[#c9a227] transition-all shadow-[2px_2px_0px_0px_rgba(20,33,61,0.1)] active:translate-y-[1px] active:shadow-none active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.2)] whitespace-nowrap" type="button">
              + NUEVA RESERVA MANUAL
            </button>
          </div>

          <div className="flex flex-col gap-6 bg-[#F7F6F3] p-8 border border-[#D1CEC5]">
            <h2 className="font-serif text-xl font-semibold text-[#14213D] flex items-center gap-2">Listado de Reservas</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#14213D] text-[#F7F6F3]">
                    <th className="font-mono text-xs font-normal uppercase tracking-widest py-3 px-4">Código de Reserva</th>
                    <th className="font-mono text-xs font-normal uppercase tracking-widest py-3 px-4">Huésped</th>
                    <th className="font-mono text-xs font-normal uppercase tracking-widest py-3 px-4">Fechas (In/Out)</th>
                    <th className="font-mono text-xs font-normal uppercase tracking-widest py-3 px-4">Habitación</th>
                    <th className="font-mono text-xs font-normal uppercase tracking-widest py-3 px-4">Estado</th>
                    <th className="font-mono text-xs font-normal uppercase tracking-widest py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-[#14213D]">
                  {loading ? (
                    <tr><td colSpan="6" className="py-4 text-center">Cargando reservas...</td></tr>
                  ) : (
                    bookings.map(booking => (
                      <tr key={booking.id} className="border-b border-[#D1CEC5]/50 hover:bg-[#14213D]/5 transition-colors">
                        <td className="py-4 px-4 font-medium">{booking.code}</td>
                        <td className="py-4 px-4 text-[#14213D]/70">{booking.guest}</td>
                        <td className="py-4 px-4 text-[#14213D]/70">{booking.checkIn} - {booking.checkOut}</td>
                        <td className="py-4 px-4">{booking.room}</td>
                        <td className="py-4 px-4">
                          <span className={`${booking.statusColor} px-2 py-1 font-mono text-xs font-medium uppercase tracking-wider rounded-sm`}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button className="text-[#755b00] hover:text-[#c9a227] transition-colors p-1 ml-1" title="Editar" onClick={() => openEditModal(booking)}>
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button onClick={() => handleDelete(booking.id)} className="text-[#ba1a1a] hover:opacity-80 transition-colors p-1 ml-1" title="Cancelar">
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isEditModalOpen && (
        <EditBookingModal 
          isOpen={isEditModalOpen} 
          onClose={closeEditModal} 
          booking={selectedBooking}
        />
      )}
    </div>
  );
}
