import { useState, useEffect, useCallback } from 'react';
import StaffSidebar from '../../components/StaffSidebar';
import Toast from '../../components/Toast';
import {
  getStaffRooms,
  createRoom,
  updateRoom,
  updateRoomStatus,
  deleteRoom,
} from '../../services/roomStaffService';
import echo from '../../services/echo';

// Configuración visual de badges por estado de habitación
const STATUS_CONFIG = {
  disponible: {
    label: 'Disponible',
    color: 'bg-[#1b5e20] text-[#e8f5e9] border-[#2e7d32]',
    badgeBg: 'bg-[#e8f5e9] text-[#1b5e20] border-[#81c784]',
    dotColor: 'bg-[#4caf50]',
    icon: 'check_circle',
  },
  ocupada: {
    label: 'Ocupada',
    color: 'bg-[#b71c1c] text-[#ffebee] border-[#c62828]',
    badgeBg: 'bg-[#ffebee] text-[#b71c1c] border-[#ef5350]',
    dotColor: 'bg-[#f44336]',
    icon: 'hotel',
  },
  mantenimiento: {
    label: 'En Mantenimiento',
    color: 'bg-[#e65100] text-[#fff3e0] border-[#ef6c00]',
    badgeBg: 'bg-[#fff3e0] text-[#e65100] border-[#ffb74d]',
    dotColor: 'bg-[#ff9800]',
    icon: 'build',
  },
  limpieza: {
    label: 'En Limpieza',
    color: 'bg-[#f57f17] text-[#fffde7] border-[#fbc02d]',
    badgeBg: 'bg-[#fffde7] text-[#f57f17] border-[#fff176]',
    dotColor: 'bg-[#ffee58]',
    icon: 'cleaning_services',
  },
  reservada: {
    label: 'Reservada',
    color: 'bg-[#14213d] text-[#fbf9f4] border-[#c9a227]',
    badgeBg: 'bg-[#e8eaf6] text-[#1a237e] border-[#7986cb]',
    dotColor: 'bg-[#5c6bc0]',
    icon: 'bookmark',
  },
};

export default function RoomManagement() {
  const [rooms, setRooms] = useState([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    disponible: 0,
    ocupada: 0,
    mantenimiento: 0,
    limpieza: 0,
    reservada: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [selectedStatus, setSelectedStatus] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Notificaciones Toast
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Modal Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [formData, setFormData] = useState({
    room_number: '',
    name: '',
    bed_type: 'individual',
    capacity: 1,
    size_m2: '',
    price_per_night: '',
    description: '',
    image_url: '',
    status: 'disponible',
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Cargar habitaciones desde la API
  const fetchRoomsData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await getStaffRooms({
        status: selectedStatus,
        search: searchTerm,
      });
      setRooms(data.rooms || []);
      setMetrics(data.metrics || {});
    } catch (err) {
      console.error('Error al cargar inventario de habitaciones:', err);
      const msg = err.response?.data?.message || 'Error al cargar habitaciones.';
      setError(msg);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [selectedStatus, searchTerm]);

  useEffect(() => {
    fetchRoomsData();
  }, [fetchRoomsData]);

  // Escuchador de WebSockets (Laravel Echo / Reverb) para actualizaciones en vivo
  useEffect(() => {
    try {
      const channel = echo.channel('rooms');
      channel.listen('.room.status.updated', (eventData) => {
        console.log('⚡ Evento WebSocket recibido (RoomStatusUpdated):', eventData);
        showNotification(
          `🔔 Hab. ${eventData.room_number}: Estado cambió de ${eventData.old_status} a ${eventData.new_status}`
        );
        fetchRoomsData(false); // Refrescar en background sin skeletons
      });

      return () => {
        echo.leaveChannel('rooms');
      };
    } catch (e) {
      console.warn('WebSockets Reverb no disponible en desarrollo local:', e);
    }
  }, [fetchRoomsData]);

  const showNotification = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
  };

  // Handler para cambio rápido de estado en 1-click
  const handleQuickStatusChange = async (roomId, newStatus, roomNumber) => {
    // 1. Optimistic UI update para respuesta instantánea
    const oldRoom = rooms.find((r) => r.id === roomId);
    const oldStatus = oldRoom ? oldRoom.status : null;

    setRooms((prevRooms) => {
      // Si el filtro está activado y el nuevo estado ya no coincide, lo removemos de la vista
      if (selectedStatus !== 'todos' && selectedStatus !== newStatus) {
        return prevRooms.filter((r) => r.id !== roomId);
      }
      // De lo contrario, solo actualizamos el estado
      return prevRooms.map((room) =>
        room.id === roomId ? { ...room, status: newStatus } : room
      );
    });

    if (oldStatus) {
      setMetrics((prev) => ({
        ...prev,
        [oldStatus]: Math.max(0, (prev[oldStatus] || 0) - 1),
        [newStatus]: (prev[newStatus] || 0) + 1,
      }));
    }

    // 2. Llamada a la API
    try {
      await updateRoomStatus(roomId, newStatus);
      showNotification(`Habitación ${roomNumber} actualizada a estado: ${newStatus.toUpperCase()}`);
      // Refrescar en background para asegurar sincronización con base de datos sin mostrar skeletons
      fetchRoomsData(false);
    } catch (err) {
      console.error('Error al cambiar estado:', err);
      // Revertir estado optimista si hubo error
      setRooms((prevRooms) => {
        if (selectedStatus !== 'todos' && selectedStatus !== newStatus) {
          // Si lo habíamos eliminado de la vista, no podemos devolverlo fácilmente 
          // sin recargar desde la API, así que forzamos recarga con loading
          fetchRoomsData(true);
          return prevRooms;
        }
        return prevRooms.map((room) =>
          room.id === roomId ? { ...room, status: oldStatus } : room
        );
      });

      if (oldStatus) {
        setMetrics((prev) => ({
          ...prev,
          [oldStatus]: (prev[oldStatus] || 0) + 1,
          [newStatus]: Math.max(0, (prev[newStatus] || 0) - 1),
        }));
      }
      
      const msg = err.response?.data?.message || 'No se pudo actualizar el estado.';
      showNotification(`❌ ${msg}`);
    }
  };

  // Abrir Modal para Crear
  const handleOpenCreateModal = () => {
    setEditingRoom(null);
    setFormData({
      room_number: '',
      name: '',
      bed_type: 'individual',
      capacity: 1,
      size_m2: '',
      price_per_night: '',
      description: '',
      image_url: '',
      status: 'disponible',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Abrir Modal para Editar
  const handleOpenEditModal = (room) => {
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number || '',
      name: room.name || '',
      bed_type: room.bed_type || 'individual',
      capacity: room.capacity || 1,
      size_m2: room.size_m2 || '',
      price_per_night: room.price_per_night || '',
      description: room.description || '',
      image_url: room.image_url || '',
      status: room.status || 'disponible',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Guardar (Crear o Editar)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});

    try {
      if (editingRoom) {
        await updateRoom(editingRoom.id, formData);
        showNotification(`Habitación ${formData.room_number} actualizada correctamente`);
      } else {
        await createRoom(formData);
        showNotification(`Habitación ${formData.room_number} creada exitosamente`);
      }
      setIsModalOpen(false);
      fetchRoomsData();
    } catch (err) {
      console.error('Error al guardar habitación:', err);
      const apiErrors = err.response?.data?.errors || {};
      const apiMsg = err.response?.data?.message || 'Error al guardar la habitación.';
      setFormErrors(apiErrors);
      showNotification(`❌ ${apiMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Eliminar Habitación
  const handleDeleteRoom = async (room) => {
    if (!window.confirm(`¿Estás seguro de eliminar la Habitación ${room.room_number} (${room.name})?`)) {
      return;
    }

    try {
      await deleteRoom(room.id);
      showNotification(`Habitación ${room.room_number} eliminada del inventario`);
      fetchRoomsData();
    } catch (err) {
      console.error('Error al eliminar habitación:', err);
      const msg = err.response?.data?.message || 'No se pudo eliminar la habitación.';
      showNotification(`❌ ${msg}`);
    }
  };

  return (
    <div className="flex h-screen bg-[#fbf9f4] text-[#1b1c19] font-sans overflow-hidden">
      {/* Sidebar de Recepción */}
      <StaffSidebar />

      {/* Área Principal de Trabajo */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Header */}
        <header className="bg-[#14213d] text-[#fbf9f4] px-6 py-5 border-b border-[#c9a227] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#c9a227] text-2xl">door_front</span>
              <h1 className="font-serif text-2xl font-bold tracking-wide">
                Inventario y Control de Habitaciones
              </h1>
            </div>
            <p className="font-mono text-xs text-[#d1c5af] mt-0.5">
              Panel de Recepción • Gestión en tiempo real de estados de habitación
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 bg-[#c9a227] hover:bg-[#b08b1a] text-[#14213d] font-mono text-xs uppercase tracking-wider font-bold border border-[#14213d] shadow-[2px_2px_0px_#14213d] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm font-bold">add</span>
            <span>Registrar Habitación</span>
          </button>
        </header>

        {/* Contenido Principal */}
        <main className="p-6 space-y-6 flex-grow">

          {/* Tarjetas de Métricas del Inventario */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[#f5f3ee] border border-[#d1c5af] p-3 text-center">
              <span className="font-mono text-[10px] text-[#78716c] uppercase font-bold block">Total Hotel</span>
              <span className="font-mono text-2xl font-bold text-[#14213d]">{metrics.total || 0}</span>
            </div>

            <div className="bg-[#e8f5e9] border border-[#81c784] p-3 text-center">
              <span className="font-mono text-[10px] text-[#1b5e20] uppercase font-bold block">Disponibles</span>
              <span className="font-mono text-2xl font-bold text-[#1b5e20]">{metrics.disponible || 0}</span>
            </div>

            <div className="bg-[#ffebee] border border-[#ef5350] p-3 text-center">
              <span className="font-mono text-[10px] text-[#b71c1c] uppercase font-bold block">Ocupadas</span>
              <span className="font-mono text-2xl font-bold text-[#b71c1c]">{metrics.ocupada || 0}</span>
            </div>

            <div className="bg-[#fff3e0] border border-[#ffb74d] p-3 text-center">
              <span className="font-mono text-[10px] text-[#e65100] uppercase font-bold block">Mantenimiento</span>
              <span className="font-mono text-2xl font-bold text-[#e65100]">{metrics.mantenimiento || 0}</span>
            </div>

            <div className="bg-[#fffde7] border border-[#fff176] p-3 text-center">
              <span className="font-mono text-[10px] text-[#f57f17] uppercase font-bold block">Limpieza</span>
              <span className="font-mono text-2xl font-bold text-[#f57f17]">{metrics.limpieza || 0}</span>
            </div>

            <div className="bg-[#e8eaf6] border border-[#7986cb] p-3 text-center">
              <span className="font-mono text-[10px] text-[#1a237e] uppercase font-bold block">Reservadas</span>
              <span className="font-mono text-2xl font-bold text-[#1a237e]">{metrics.reservada || 0}</span>
            </div>
          </div>

          {/* Barra de Búsqueda y Filtros Rápidos */}
          <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            
            {/* Input de Búsqueda */}
            <div className="relative flex-grow max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#78716c] text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar por número o nombre de habitación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#fbf9f4] border border-[#d1c5af] pl-9 pr-3 py-2 text-xs font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none"
              />
            </div>

            {/* Filtro de Botones Rápidos por Estado */}
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
              <button
                type="button"
                onClick={() => setSelectedStatus('todos')}
                className={`px-3 py-1.5 font-bold uppercase transition-all cursor-pointer ${
                  selectedStatus === 'todos'
                    ? 'bg-[#14213d] text-[#fbf9f4] border border-[#14213d]'
                    : 'bg-[#fbf9f4] text-[#4d4635] border border-[#d1c5af] hover:bg-[#e4e2dd]'
                }`}
              >
                Todas ({metrics.total || 0})
              </button>

              {Object.keys(STATUS_CONFIG).map((stKey) => {
                const conf = STATUS_CONFIG[stKey];
                const count = metrics[stKey] || 0;
                return (
                  <button
                    key={stKey}
                    type="button"
                    onClick={() => setSelectedStatus(stKey)}
                    className={`px-3 py-1.5 font-bold uppercase transition-all cursor-pointer ${
                      selectedStatus === stKey
                        ? `${conf.color} border`
                        : 'bg-[#fbf9f4] text-[#4d4635] border border-[#d1c5af] hover:bg-[#e4e2dd]'
                    }`}
                  >
                    {conf.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mensaje de Error */}
          {error && (
            <div className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-4 text-[#93000a] font-mono text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Carga Skeletons */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="bg-[#f5f3ee] border border-[#d1c5af] h-56 animate-pulse p-4" />
              ))}
            </div>
          )}

          {/* Grid de Tarjetas de Habitación */}
          {!loading && !error && rooms.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {rooms.map((room) => {
                const statusConf = STATUS_CONFIG[room.status] || STATUS_CONFIG.disponible;

                return (
                  <div
                    key={room.id}
                    className="bg-[#fbf9f4] border-2 border-[#d1c5af] shadow-[2px_2px_0px_rgba(20,33,61,0.15)] p-4 flex flex-col justify-between hover:border-[#14213d] transition-all"
                  >
                    {/* Header de la Tarjeta: Número y Badge de Estado */}
                    <div>
                      <div className="flex justify-between items-start mb-2 border-b border-[#d1c5af] pb-2">
                        <div className="bg-[#14213d] text-[#fbf9f4] px-2.5 py-1 font-mono text-xs font-bold border border-[#c9a227]">
                          HAB {room.room_number}
                        </div>

                        {/* Badge con Dot Animado */}
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 border text-[10px] font-mono font-bold uppercase ${statusConf.badgeBg}`}>
                          <span className={`w-2 h-2 rounded-full ${statusConf.dotColor} animate-pulse`} />
                          <span>{statusConf.label}</span>
                        </div>
                      </div>

                      {/* Nombre y Tipo */}
                      <h3 className="font-serif font-bold text-base text-[#1b1c19] mb-1 line-clamp-1">
                        {room.name}
                      </h3>
                      <p className="font-mono text-[11px] text-[#755b00] font-semibold mb-3 uppercase">
                        {room.bed_type} • {room.capacity} persona(s) {room.size_m2 ? `• ${room.size_m2}m²` : ''}
                      </p>

                      {/* Precio por noche */}
                      <div className="bg-[#f5f3ee] border border-[#d1c5af] p-2 mb-3 flex justify-between items-center font-mono text-xs">
                        <span className="text-[#78716c]">Tarifa / noche:</span>
                        <span className="font-bold text-[#14213d] text-sm">
                          S/ {Number(room.price_per_night).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Acciones y Cambio Rápido de Estado en 1-Click */}
                    <div className="space-y-3 pt-2 border-t border-[#d1c5af]">
                      {/* Dropdown de Cambio Rápido de Estado */}
                      <div>
                        <label className="block font-mono text-[9px] uppercase font-bold text-[#78716c] mb-1">
                          Cambiar Estado (1-Click)
                        </label>
                        <select
                          value={room.status}
                          onChange={(e) => handleQuickStatusChange(room.id, e.target.value, room.room_number)}
                          className={`w-full p-1.5 font-mono text-xs font-bold uppercase border cursor-pointer focus:outline-none ${statusConf.badgeBg}`}
                        >
                          <option value="disponible">🟢 Disponible</option>
                          <option value="ocupada">🔴 Ocupada</option>
                          <option value="mantenimiento">🟠 En Mantenimiento</option>
                          <option value="limpieza">🟡 En Limpieza</option>
                          <option value="reservada">🔵 Reservada</option>
                        </select>
                      </div>

                      {/* Botones Editar / Eliminar */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(room)}
                          className="flex-1 py-1.5 bg-[#f5f3ee] hover:bg-[#e4e2dd] border border-[#d1c5af] text-[#14213d] font-mono text-[11px] uppercase font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                        >
                          <span className="material-symbols-outlined text-xs">edit</span>
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteRoom(room)}
                          className="px-2.5 py-1.5 bg-[#ffebee] hover:bg-[#ffcdd2] border border-[#ef5350] text-[#b71c1c] font-mono text-xs font-bold flex items-center justify-center cursor-pointer transition-all"
                          title="Eliminar Habitación"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Estado Vacío */}
          {!loading && !error && rooms.length === 0 && (
            <div className="bg-[#f5f3ee] border border-[#d1c5af] p-12 text-center max-w-md mx-auto my-8 space-y-3">
              <span className="material-symbols-outlined text-4xl text-[#755b00]">meeting_room</span>
              <h3 className="font-serif text-lg font-bold text-[#1b1c19]">No se encontraron habitaciones</h3>
              <p className="font-sans text-xs text-[#4d4635]">
                {searchTerm || selectedStatus !== 'todos'
                  ? 'Intenta modificar el término de búsqueda o el filtro de estado.'
                  : 'Aún no hay habitaciones registradas en el inventario.'}
              </p>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-[#c9a227] text-[#14213d] font-mono text-xs uppercase font-bold border border-[#14213d]"
              >
                + Registrar Primera Habitación
              </button>
            </div>
          )}

        </main>
      </div>

      {/* Modal para Crear / Editar Habitación */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#14213d]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#fbf9f4] border-2 border-[#c9a227] shadow-[6px_6px_0px_#14213d] max-w-xl w-full overflow-hidden">
            
            {/* Header Modal */}
            <div className="bg-[#14213d] text-[#fbf9f4] px-6 py-4 flex justify-between items-center border-b border-[#c9a227]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#c9a227]">
                  {editingRoom ? 'edit_note' : 'add_circle'}
                </span>
                <h3 className="font-serif font-bold text-lg">
                  {editingRoom ? `Editar Habitación ${editingRoom.room_number}` : 'Registrar Nueva Habitación'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#d1c5af] hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Formulario Body */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 font-mono text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#4d4635] uppercase mb-1">
                    Número de Habitación *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 101"
                    value={formData.room_number}
                    onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                    required
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono focus:border-[#14213d] focus:outline-none"
                  />
                  {formErrors.room_number && (
                    <p className="text-[#ba1a1a] text-[10px] mt-1">{formErrors.room_number[0]}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-[#4d4635] uppercase mb-1">
                    Nombre / Categoría *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Suite Presidencial"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-sans focus:border-[#14213d] focus:outline-none"
                  />
                  {formErrors.name && (
                    <p className="text-[#ba1a1a] text-[10px] mt-1">{formErrors.name[0]}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-[#4d4635] uppercase mb-1">
                    Tipo de Cama *
                  </label>
                  <select
                    value={formData.bed_type}
                    onChange={(e) => setFormData({ ...formData, bed_type: e.target.value })}
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono cursor-pointer"
                  >
                    <option value="individual">Individual</option>
                    <option value="doble">Doble</option>
                    <option value="king">King Size</option>
                    <option value="suite">Suite</option>
                    <option value="familiar">Familiar</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#4d4635] uppercase mb-1">
                    Capacidad (Huéspedes) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) })}
                    required
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono focus:border-[#14213d] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#4d4635] uppercase mb-1">
                    Tarifa por Noche (S/) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="250.00"
                    value={formData.price_per_night}
                    onChange={(e) => setFormData({ ...formData, price_per_night: e.target.value })}
                    required
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono focus:border-[#14213d] focus:outline-none"
                  />
                  {formErrors.price_per_night && (
                    <p className="text-[#ba1a1a] text-[10px] mt-1">{formErrors.price_per_night[0]}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-[#4d4635] uppercase mb-1">
                    Tamaño (m²)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="35"
                    value={formData.size_m2}
                    onChange={(e) => setFormData({ ...formData, size_m2: e.target.value })}
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono focus:border-[#14213d] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#4d4635] uppercase mb-1">
                    Estado Inicial *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono cursor-pointer"
                  >
                    <option value="disponible">🟢 Disponible</option>
                    <option value="ocupada">🔴 Ocupada</option>
                    <option value="mantenimiento">🟠 En Mantenimiento</option>
                    <option value="limpieza">🟡 En Limpieza</option>
                    <option value="reservada">🔵 Reservada</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#4d4635] uppercase mb-1">
                    URL de la Imagen (Opcional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono focus:border-[#14213d] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#4d4635] uppercase mb-1">
                    Descripción
                  </label>
                  <textarea
                    rows="2"
                    placeholder="Comodidades, vista exterior, equipamiento..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-sans resize-none focus:border-[#14213d] focus:outline-none"
                  />
                </div>
              </div>

              {/* Botones Modal */}
              <div className="border-t border-[#d1c5af] pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-[#d1c5af] font-bold uppercase text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-[#c9a227] hover:bg-[#b08b1a] text-[#14213d] font-bold uppercase text-xs border border-[#14213d] shadow-[2px_2px_0px_#14213d] cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  {submitting ? (
                    <span>Guardando...</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">save</span>
                      <span>{editingRoom ? 'Guardar Cambios' : 'Registrar Habitación'}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Toast Component */}
      <Toast
        message={toastMessage}
        show={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}
