import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import EditBookingModal from '../../components/staff/EditBookingModal';
import StaffSidebar from '../../components/StaffSidebar';
import api from '../../services/api';

export default function BookingManagement() {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/staff/bookings');
      // Mapear los datos reales al formato que espera la tabla
      const mappedBookings = response.data.bookings.map(booking => {
        let statusColor = '';
        let displayStatus = booking.status;
        
        switch (booking.status) {
          case 'confirmed':
          case 'confirmada':
            statusColor = 'text-[#2E7A4A] bg-[#2E7A4A]/20';
            displayStatus = 'Confirmada';
            break;
          case 'pending_payment':
            statusColor = 'text-[#755b00] bg-[#755b00]/20';
            displayStatus = 'Pendiente';
            break;
          case 'checked_in':
            statusColor = 'text-[#14213D] bg-[#14213D]/10';
            displayStatus = 'Check-in';
            break;
          case 'cancelled':
          case 'cancelada':
            statusColor = 'text-[#ba1a1a] bg-[#ba1a1a]/20';
            displayStatus = 'Cancelada';
            break;
          case 'completed':
            statusColor = 'text-[#14213D] bg-[#14213D]/20';
            displayStatus = 'Completada';
            break;
          default:
            statusColor = 'text-gray-600 bg-gray-200';
        }

        return {
          id: booking.id,
          code: booking.booking_code,
          guest: booking.guest ? `${booking.guest.name} ${booking.guest.surname}` : 'Desconocido',
          checkIn: booking.check_in.substring(0, 10),
          checkOut: booking.check_out.substring(0, 10),
          room: booking.room ? booking.room.name : 'No asignada',
          status: displayStatus,
          statusColor: statusColor,
          rawBooking: booking // Para el modal de edición
        };
      });
      setBookings(mappedBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      alert('Error al cargar las reservas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const openEditModal = (booking = null) => {
    setSelectedBooking(booking);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setSelectedBooking(null);
    setIsEditModalOpen(false);
  };

  const handleDelete = async (code) => {
    if (confirm('¿Está seguro que desea cancelar esta reserva?')) {
      try {
        const response = await api.post(`/bookings/${code}/cancel`);
        alert(response.data.message || 'Reserva cancelada con éxito');
        fetchBookings();
      } catch (error) {
        console.error('Error canceling booking:', error);
        alert(error.response?.data?.message || 'Hubo un error al intentar cancelar la reserva');
      }
    }
  };

  return (
    <div className="flex h-screen bg-[#fbf9f4] text-[#1b1c19] font-sans overflow-hidden">
      <StaffSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#dcdad5]">
        
        {/* Main Content */}
        <div className="flex-1 p-4 md:p-12 overflow-y-auto">
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
              <button 
                onClick={() => openEditModal(null)}
                className="bg-[#755b00] text-white font-mono text-sm font-medium px-6 py-3 uppercase tracking-widest hover:bg-[#c9a227] transition-all shadow-[2px_2px_0px_0px_rgba(20,33,61,0.1)] active:translate-y-[1px] active:shadow-none active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.2)] whitespace-nowrap" type="button">
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
                            <button onClick={() => handleDelete(booking.code)} className="text-[#ba1a1a] hover:opacity-80 transition-colors p-1 ml-1" title="Cancelar">
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
