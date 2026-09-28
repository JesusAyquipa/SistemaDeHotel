import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import StaffSidebar from '../../components/StaffSidebar';
import { getRoomDetails } from '../../services/roomStaffService';
import AddChargeModal from '../../components/staff/AddChargeModal';
import Toast from '../../components/Toast';

export default function RoomAccount() {
  const { id } = useParams();
  const [room, setRoom] = useState(null);
  const [activeBooking, setActiveBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [charges, setCharges] = useState([]);
  
  const [isAddChargeOpen, setIsAddChargeOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const data = await getRoomDetails(id);
        setRoom(data.room);
        
        if (data.room && data.room.bookings) {
          const booking = data.room.bookings.find(b => 
            b.status === 'checked_in' || b.status === 'confirmed' || b.status === 'pending_payment'
          );
          setActiveBooking(booking);
          
          if (booking) {
            const roomPrice = parseFloat(booking.total_amount) || parseFloat(data.room.price_per_night);
            const baseCharge = { 
              id: 'base', 
              date: booking.check_in, 
              concept: 'Tarifa de Habitación', 
              quantity: 1, 
              unit_price: roomPrice, 
              total: roomPrice 
            };
              
            // Fetch charges for this booking
            try {
              const res = await api.get(`/staff/bookings/${booking.id}/charges`);
              const dbCharges = res.data.charges || [];
              setCharges([baseCharge, ...dbCharges]);
            } catch (err) {
              console.error("Error fetching charges", err);
              // Set base charge even if fetch fails
              setCharges([baseCharge]);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching room details", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen bg-[#e5e4de]">
        <StaffSidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-[#78716c] animate-pulse">Cargando detalles...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex h-screen bg-[#e5e4de]">
        <StaffSidebar />
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <p className="font-serif text-2xl">Habitación no encontrada</p>
          <Link to="/recepcionista/habitaciones" className="text-[#987d35] underline font-mono">Volver</Link>
        </div>
      </div>
    );
  }

  const subtotal = charges.reduce((acc, curr) => acc + parseFloat(curr.total), 0);
  const igv = subtotal * 0.18;
  const total = subtotal + igv;

  const handleAddCharge = async (newCharge) => {
    if (!activeBooking) {
      setToastMessage('Error: No hay reserva activa para cargar el consumo.');
      return;
    }
    
    try {
       // Send to backend
       const res = await api.post(`/staff/bookings/${activeBooking.id}/charges`, {
         date: newCharge.date,
         concept: newCharge.concept,
         quantity: newCharge.quantity,
         unit_price: newCharge.unitPrice
       });
       
       setCharges(prev => [...prev, res.data.charge]);
       setToastMessage(`Consumo agregado: ${newCharge.concept}`);
    } catch (err) {
       console.error(err);
       setToastMessage('Error al agregar el consumo');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmail = () => {
    if (activeBooking?.guest?.email) {
      setToastMessage(`Folio enviado a ${activeBooking.guest.email}`);
    } else {
      setToastMessage('Folio enviado por correo exitosamente');
    }
  };

  const handleProcessPayment = () => {
    setToastMessage(`Procesando pago por $${total.toFixed(2)}...`);
    // Simulated delay
    setTimeout(() => {
      setToastMessage('¡Pago procesado con éxito!');
      setCharges([]); // Clear charges on success
    }, 1500);
  };

  return (
    <div className="flex h-screen bg-[#e5e4de] text-[#1b1c19] font-sans overflow-hidden">
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} type="success" />
      )}
      
      <StaffSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="px-10 pt-10 pb-6 flex items-baseline gap-4">
          <h1 className="font-serif text-5xl font-bold text-[#2d2d2a] tracking-tight">
            Detalle de Cuenta
          </h1>
        </header>
        
        <div className="px-10 mb-8 flex items-center gap-2 text-[#987d35] font-mono text-sm font-bold uppercase tracking-wide">
          <span className="material-symbols-outlined text-lg">vpn_key</span>
          <span>Habitación {room.room_number} <span className="text-[#a39f96] bg-white px-2 py-0.5 ml-2 border border-[#d1c5af]">({room.name || room.bed_type})</span></span>
        </div>

        <main className="px-10 flex flex-col lg:flex-row gap-10">
          
          {/* Panel Izquierdo: Resumen de Huésped */}
          <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <div className="bg-white p-6 shadow-sm border border-gray-200">
              <h2 className="font-serif text-xl font-bold text-[#2d2d2a] mb-4 border-b border-gray-200 pb-2">
                Resumen de Huésped
              </h2>
              
              <div className="space-y-4 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#a39f96] tracking-widest uppercase font-bold">Nombre</span>
                  <span className="font-bold text-sm text-[#2d2d2a]">
                    {activeBooking ? `${activeBooking.guest?.name || ''} ${activeBooking.guest?.surname || ''}` : 'Sin Huésped'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a39f96] tracking-widest uppercase font-bold">Check-in</span>
                  <span className="text-[#2d2d2a]">{activeBooking ? activeBooking.check_in : '--'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a39f96] tracking-widest uppercase font-bold">Check-out</span>
                  <span className="text-[#2d2d2a]">{activeBooking ? activeBooking.check_out : '--'}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[#a39f96] tracking-widest uppercase font-bold">Agencia/Empresa</span>
                  <span className="text-[#2d2d2a]">Particular</span>
                </div>
              </div>

              <button 
                onClick={() => setIsAddChargeOpen(true)}
                className="mt-8 w-full bg-[#987d35] hover:bg-[#7a642a] text-white font-mono text-xs font-bold uppercase tracking-widest py-3 flex items-center justify-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                Agregar Consumo
              </button>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={handlePrint}
                className="flex-1 bg-transparent hover:bg-white border border-[#987d35] text-[#2d2d2a] font-mono text-[10px] font-bold uppercase tracking-widest py-3 flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">print</span>
                Imprimir Folio
              </button>
              <button 
                onClick={handleEmail}
                className="flex-1 bg-transparent hover:bg-white border border-[#987d35] text-[#2d2d2a] font-mono text-[10px] font-bold uppercase tracking-widest py-3 flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">mail</span>
                Enviar por Email
              </button>
            </div>
            
            <Link to="/recepcionista/habitaciones" className="text-center font-mono text-xs text-[#a39f96] hover:text-[#2d2d2a] underline mt-4">
              Volver al Tablero
            </Link>
          </div>

          {/* Panel Derecho: Tabla de Consumos y Totales */}
          <div className="w-full lg:w-2/3 flex flex-col gap-6">
            <div className="bg-white shadow-sm border border-gray-200">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-[#1b1c19] text-[#a39f96]">
                  <tr>
                    <th className="px-6 py-4 font-bold tracking-widest uppercase">Fecha</th>
                    <th className="px-6 py-4 font-bold tracking-widest uppercase">Concepto</th>
                    <th className="px-6 py-4 font-bold tracking-widest uppercase text-right">Cant.</th>
                    <th className="px-6 py-4 font-bold tracking-widest uppercase text-right">Precio Unit.</th>
                    <th className="px-6 py-4 font-bold tracking-widest uppercase text-right text-white">Total</th>
                  </tr>
                </thead>
                <tbody className="text-[#2d2d2a] divide-y divide-gray-100">
                  {charges.length > 0 ? charges.map((charge, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">{new Date(charge.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</td>
                      <td className="px-6 py-4 font-bold font-sans">{charge.concept}</td>
                      <td className="px-6 py-4 text-right">{charge.quantity}</td>
                      <td className="px-6 py-4 text-right">${parseFloat(charge.unit_price || charge.unitPrice).toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-bold">${parseFloat(charge.total).toFixed(2)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-[#a39f96]">No hay consumos registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="self-end w-full max-w-sm bg-white p-6 shadow-sm border border-gray-200 mt-2 relative">
              {/* Etiqueta lateral amarilla simulada en el diseño */}
              <div className="absolute top-0 right-0 w-4 h-full bg-[#e5e4de] opacity-50 border-l border-white"></div>
              
              <div className="space-y-2 font-mono text-xs mb-6 pr-6">
                <div className="flex justify-between items-center text-[#78716c]">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[#78716c] border-b border-gray-200 pb-4">
                  <span>IGV (18%):</span>
                  <span>${igv.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="flex flex-col pr-6 mb-6">
                <span className="font-serif text-sm tracking-widest uppercase text-[#2d2d2a] font-bold">Total Acumulado:</span>
                <span className="font-serif text-3xl font-bold text-[#987d35] mt-1">${total.toFixed(2)}</span>
              </div>

              <button 
                onClick={handleProcessPayment}
                disabled={total <= 0}
                className="w-full disabled:opacity-50 disabled:cursor-not-allowed bg-[#fcede8] hover:bg-[#f5e0d8] border border-[#d32f2f] text-[#d32f2f] font-mono text-xs font-bold uppercase tracking-widest py-3 flex items-center justify-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">payments</span>
                Procesar Pago
              </button>
            </div>
          </div>

        </main>
      </div>

      <AddChargeModal 
        isOpen={isAddChargeOpen} 
        onClose={() => setIsAddChargeOpen(false)}
        onAddCharge={handleAddCharge}
      />
    </div>
  );
}
