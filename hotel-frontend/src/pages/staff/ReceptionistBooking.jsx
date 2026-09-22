import { useState } from 'react';
import StaffSidebar from '../../components/StaffSidebar';
import api from '../../services/api';

export default function ReceptionistBooking() {
  const [searchQuery, setSearchQuery] = useState('');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setBooking(null);

    try {
      // Intentamos buscar por código de reserva
      const response = await api.get(`/bookings/${searchQuery}`);
      setBooking(response.data.booking);
    } catch (err) {
      console.error('Error fetching booking:', err);
      setError('No se encontró la reserva con ese código o hubo un error.');
    } finally {
      setLoading(false);
    }
  };

  const isEarlyCheckIn = () => {
    if (!booking) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(booking.check_in + 'T00:00:00');
    checkInDate.setHours(0, 0, 0, 0);
    return today < checkInDate;
  };

  const isEarlyCheckOut = () => {
    if (!booking) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkOutDate = new Date(booking.check_out + 'T00:00:00');
    checkOutDate.setHours(0, 0, 0, 0);
    return today < checkOutDate;
  };

  const handleCheckIn = async () => {
    if (!booking) return;
    if (isEarlyCheckIn()) {
      alert("No se puede realizar el check-in antes de la fecha programada.");
      return;
    }
    
    try {
      const response = await api.post(`/staff/bookings/${booking.booking_code}/check-in`);
      alert(response.data.message);
      setBooking(response.data.booking); // Actualizamos con los nuevos datos
    } catch (err) {
      console.error('Error in check-in:', err);
      alert(err.response?.data?.message || 'Error al procesar el check-in.');
    }
  };

  const handleCheckOut = async () => {
    if (!booking) return;

    let earlyCheckoutReason = '';
    if (isEarlyCheckOut()) {
      earlyCheckoutReason = window.prompt("El huésped está realizando el check-out antes de la fecha programada. Por favor, indique el motivo:");
      if (earlyCheckoutReason === null) {
        // User cancelled the prompt
        return;
      }
      if (!earlyCheckoutReason.trim()) {
        alert("El motivo es obligatorio para salidas anticipadas.");
        return;
      }
    }

    try {
      const response = await api.post(`/staff/bookings/${booking.booking_code}/check-out`, {
        early_checkout_reason: earlyCheckoutReason
      });
      alert(response.data.message);
      setBooking(response.data.booking); // Actualizamos con los nuevos datos
    } catch (err) {
      console.error('Error in check-out:', err);
      alert(err.response?.data?.message || 'Error al procesar el check-out.');
    }
  };

  return (
    <div className="flex h-screen bg-[#fbf9f4] text-[#1b1c19] font-sans overflow-hidden">
      <StaffSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#dcdad5]">
        <div className="flex-1 p-4 md:p-12 overflow-y-auto">
          <div className="flex flex-col w-full py-12 gap-8 bg-[#EDEBE6] rounded border border-[#d1c5af] p-8">
            <div className="flex flex-col gap-4">
              <h1 className="font-serif text-4xl font-bold text-[#14213D] tracking-tight">Recepción: Check-in / Check-out</h1>
              <p className="text-lg text-[#14213D]/70 max-w-2xl">Gestione la entrada y salida de los huéspedes del hotel.</p>
            </div>

            {/* Buscador */}
            <form onSubmit={handleSearch} className="flex gap-4 items-end bg-[#F7F6F3] p-6 border border-[#D1CEC5]">
              <div className="flex flex-col gap-2 flex-1">
                <label className="font-mono text-xs font-medium text-[#14213D]/60 uppercase tracking-widest">Código de Reserva</label>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ej. RES-A1B2C3D4"
                  className="bg-transparent border-b-2 border-[#D1CEC5] focus:border-[#14213D] outline-none py-2 text-[#14213D] transition-colors"
                />
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="bg-[#14213D] text-white font-mono text-sm font-medium px-6 py-2 h-[42px] uppercase tracking-widest hover:bg-[#2a3c63] transition-all disabled:opacity-50"
              >
                {loading ? 'Buscando...' : 'Buscar Reserva'}
              </button>
            </form>

            {/* Errores */}
            {error && (
              <div className="bg-[#ba1a1a]/10 border border-[#ba1a1a]/30 text-[#ba1a1a] p-4 rounded text-sm">
                {error}
              </div>
            )}

            {/* Detalles de la Reserva y Acciones */}
            {booking && (
              <div className="bg-[#F7F6F3] border border-[#D1CEC5] p-6 flex flex-col gap-6">
                <h2 className="font-serif text-2xl font-bold text-[#14213D] border-b border-[#D1CEC5] pb-2">Detalles de la Reserva</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-mono uppercase text-[#14213D]/60">Huésped</p>
                    <p className="font-medium text-lg">{booking.guest?.name} {booking.guest?.surname}</p>
                    <p className="text-sm text-[#14213D]/80">Doc: {booking.guest?.document_number}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs font-mono uppercase text-[#14213D]/60">Habitación</p>
                    <p className="font-medium text-lg">{booking.room?.name || 'No asignada'}</p>
                    <p className="text-sm text-[#14213D]/80">N° {booking.room?.room_number}</p>
                  </div>

                  <div>
                    <p className="text-xs font-mono uppercase text-[#14213D]/60">Fechas</p>
                    <p className="font-medium">In: {booking.check_in?.substring(0,10)}</p>
                    <p className="font-medium">Out: {booking.check_out?.substring(0,10)}</p>
                  </div>

                  <div>
                    <p className="text-xs font-mono uppercase text-[#14213D]/60">Estado Actual</p>
                    <span className="inline-block mt-1 px-3 py-1 bg-[#14213D]/10 text-[#14213D] font-mono text-xs font-bold uppercase rounded">
                      {booking.status}
                    </span>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-4 pt-4 border-t border-[#D1CEC5] mt-2">
                  <button 
                    onClick={handleCheckIn}
                    disabled={(booking.status !== 'confirmed' && booking.status !== 'pending_payment') || isEarlyCheckIn()}
                    title={isEarlyCheckIn() ? "No se puede hacer check-in antes de la fecha programada" : ""}
                    className="flex-1 bg-[#2E7A4A] text-white font-mono text-sm font-medium px-6 py-3 uppercase tracking-widest hover:bg-[#3f9e63] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[2px_2px_0px_0px_rgba(20,33,61,0.1)] active:translate-y-[1px] active:shadow-none"
                  >
                    Realizar Check-In
                  </button>
                  <button 
                    onClick={handleCheckOut}
                    disabled={booking.status !== 'checked_in'}
                    className="flex-1 bg-[#755b00] text-white font-mono text-sm font-medium px-6 py-3 uppercase tracking-widest hover:bg-[#c9a227] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[2px_2px_0px_0px_rgba(20,33,61,0.1)] active:translate-y-[1px] active:shadow-none"
                  >
                    Realizar Check-Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
