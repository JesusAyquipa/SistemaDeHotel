import { useState, useEffect } from 'react';
import { getMyBookings } from '../services/bookingService';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import CancelBookingModal from '../components/CancelBookingModal';
import ModifyBookingModal from '../components/ModifyBookingModal';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [modifyModalBooking, setModifyModalBooking] = useState(null);

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMyBookings();
      setBookings(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar tus reservas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const getStatusBadge = (status) => {
    const statusConfig = {
      confirmed: { label: 'Confirmada', classes: 'bg-[#e8f5e9] text-[#1b5e20] border-[#4caf50]' },
      pending_payment: { label: 'Pendiente', classes: 'bg-[#fff3e0] text-[#e65100] border-[#ff9800]' },
      cancelled: { label: 'Cancelada', classes: 'bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]' },
      checked_in: { label: 'En Curso', classes: 'bg-[#e3f2fd] text-[#1565c0] border-[#2196f3]' },
      completed: { label: 'Completada', classes: 'bg-[#f5f5f5] text-[#616161] border-[#9e9e9e]' },
    };
    const config = statusConfig[status] || { label: status, classes: 'bg-gray-100 text-gray-800 border-gray-300' };

    return (
      <span className={`px-2 py-1 text-[10px] uppercase font-mono font-bold border ${config.classes}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] flex flex-col font-sans">
      <PublicHeader />

      <main className="flex-grow max-w-[1200px] mx-auto w-full px-4 sm:px-6 py-12">
        <div className="mb-8 border-b border-[#d1c5af] pb-4">
          <h1 className="font-serif text-3xl font-bold text-[#1b1c19]">Mis Reservas</h1>
          <p className="font-sans text-sm text-[#4d4635] mt-2">
            Gestiona tu estadía. Aquí puedes ver, modificar fechas o cancelar tus reservas.
          </p>
        </div>

        {error && (
          <div className="bg-[#ffdad6] text-[#93000a] p-4 text-sm font-mono border border-[#ba1a1a]/30 mb-8">
            <span className="material-symbols-outlined align-middle mr-2">error</span>
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-[#eae8e3] h-48 border border-[#d1c5af]"></div>
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20 bg-[#f5f3ee] border border-[#d1c5af]">
            <span className="material-symbols-outlined text-6xl text-[#d1c5af] mb-4">luggage</span>
            <h3 className="font-serif text-xl font-bold text-[#4d4635] mb-2">No tienes reservas</h3>
            <p className="font-sans text-sm text-[#755b00]">Aún no has realizado ninguna reserva con nosotros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {bookings.map((booking) => (
              <div key={booking.id} className="bg-white border border-[#d1c5af] shadow-[2px_2px_0px_rgba(20,33,61,0.15)] flex flex-col hover:shadow-[4px_4px_0px_rgba(20,33,61,0.2)] transition-shadow">
                <div className="p-5 border-b border-[#eae8e3] flex justify-between items-start bg-[#fbf9f4]">
                  <div>
                    <span className="font-mono text-[10px] text-[#755b00] font-bold uppercase tracking-widest block mb-1">
                      Código de Reserva
                    </span>
                    <h3 className="font-serif font-bold text-lg text-[#14213d]">{booking.booking_code}</h3>
                  </div>
                  {getStatusBadge(booking.status)}
                </div>

                <div className="p-5 flex-grow">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="font-mono text-[10px] text-[#4d4635] uppercase block mb-1">Check-in</span>
                      <p className="font-sans font-semibold text-sm text-[#1b1c19]">
                        {new Date(booking.check_in).toLocaleDateString('es-PE', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] text-[#4d4635] uppercase block mb-1">Check-out</span>
                      <p className="font-sans font-semibold text-sm text-[#1b1c19]">
                        {new Date(booking.check_out).toLocaleDateString('es-PE', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className="font-mono text-[10px] text-[#4d4635] uppercase block mb-1">Habitación</span>
                    <p className="font-sans text-sm text-[#1b1c19] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#c9a227] text-sm">bed</span>
                      {booking.room?.name || `Habitación ID: ${booking.room_id}`}
                    </p>
                  </div>

                  <div className="border-t border-[#eae8e3] pt-4 flex justify-between items-end">
                    <span className="font-mono text-xs uppercase text-[#4d4635]">Total pagado</span>
                    <span className="font-mono font-bold text-lg text-[#14213d]">S/ {Number(booking.total_amount).toFixed(2)}</span>
                  </div>
                </div>

                {/* Acciones permitidas solo si la reserva está activa o confirmada */}
                {['confirmed', 'pending_payment', 'reservada'].includes(booking.status) && (
                  <div className="p-4 bg-[#eae8e3] border-t border-[#d1c5af] flex gap-3">
                    <button
                      onClick={() => setModifyModalBooking(booking)}
                      className="flex-1 px-4 py-2 bg-white border border-[#a68a4d] text-[#14213d] font-mono text-xs uppercase font-bold hover:bg-[#c9a227] hover:text-white transition-colors flex justify-center items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit_calendar</span>
                      Modificar
                    </button>
                    <button
                      onClick={() => setCancelModalBooking(booking)}
                      className="flex-1 px-4 py-2 bg-white border border-[#ba1a1a] text-[#ba1a1a] font-mono text-xs uppercase font-bold hover:bg-[#ba1a1a] hover:text-white transition-colors flex justify-center items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">cancel</span>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <PublicFooter />

      {cancelModalBooking && (
        <CancelBookingModal
          booking={cancelModalBooking}
          onClose={() => setCancelModalBooking(null)}
          onSuccess={() => {
            setCancelModalBooking(null);
            fetchBookings(); // Recargar la lista de reservas
          }}
        />
      )}

      {modifyModalBooking && (
        <ModifyBookingModal
          booking={modifyModalBooking}
          onClose={() => setModifyModalBooking(null)}
          onSuccess={() => {
            setModifyModalBooking(null);
            fetchBookings(); // Recargar la lista de reservas
          }}
        />
      )}
    </div>
  );
}
