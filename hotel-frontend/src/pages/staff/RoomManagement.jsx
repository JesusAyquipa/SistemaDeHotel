import { useState, useEffect, useCallback, useRef } from 'react';
import StaffSidebar from '../../components/StaffSidebar';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import useEscapeKey from '../../hooks/useEscapeKey';
import formatCurrency from '../../utils/formatCurrency';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';
import {
  getStaffRooms,
  createRoom,
  updateRoom,
  updateRoomStatus,
  deleteRoom,
} from '../../services/roomStaffService';
import echo from '../../services/echo';
import { useAuth } from '../../context/AuthContext';
import useRoomStatusChange, { isForceableError } from '../../hooks/useRoomStatusChange';
import { getRoomTypes } from '../../services/roomTypeService';
import RoomImageManager from '../../components/staff/RoomImageManager';
import { AMENITIES, AMENITY_KEYS } from '../../constants/amenities';

const EMPTY_FORM = {
  room_number: '',
  name: '',
  room_type_id: '',
  bed_type: 'individual',
  capacity: 1,
  size_m2: '',
  price_per_night: '',
  extra_amenities: [],
  description: '',
  image_url: '',
  image_file: null,
  status: 'disponible',
};

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
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  // Notificaciones Toast
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Modal Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  // SHE-034: catálogo de tipos de habitación para el formulario
  const [roomTypes, setRoomTypes] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  // SHE-017 al editar: motivo de mantenimiento y forzado ante reservas afectadas
  const [statusReason, setStatusReason] = useState('');
  const [affectedOnSave, setAffectedOnSave] = useState(null);
  const [forceSave, setForceSave] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cargar habitaciones desde la API
  const fetchRoomsData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await getStaffRooms({
        status: selectedStatus,
        search: debouncedSearch,
      });
      setRooms(data.rooms || []);
      setMetrics(data.metrics || {});
    } catch (err) {
      logError('rooms:list', err);
      setError(apiErrorMessage(err, 'Error al cargar habitaciones.'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [selectedStatus, debouncedSearch]);

  useEffect(() => {
    fetchRoomsData();
  }, [fetchRoomsData]);

  useEffect(() => {
    getRoomTypes()
      .then((data) => setRoomTypes(data.room_types || []))
      .catch((err) => logError('room-types:list', err));
  }, []);

  const selectedType = roomTypes.find((t) => String(t.id) === String(formData.room_type_id)) || null;

  // Al elegir un tipo se proponen su tipo de cama y capacidad
  const handleTypeChange = (value) => {
    const type = roomTypes.find((t) => String(t.id) === String(value));
    setFormData((prev) => ({
      ...prev,
      room_type_id: value,
      bed_type: type?.bed_type || prev.bed_type,
      capacity: type?.capacity || prev.capacity,
    }));
  };

  const toggleExtraAmenity = (key) => {
    setFormData((prev) => ({
      ...prev,
      extra_amenities: prev.extra_amenities.includes(key)
        ? prev.extra_amenities.filter((k) => k !== key)
        : [...prev.extra_amenities, key],
    }));
  };

  // Referencia a la última versión de fetch para el listener de WebSockets
  const fetchRef = useRef(fetchRoomsData);
  useEffect(() => {
    fetchRef.current = fetchRoomsData;
  }, [fetchRoomsData]);

  // Suscripción única a WebSockets (Laravel Echo / Reverb); no se re-suscribe al escribir
  useEffect(() => {
    if (!echo) return undefined;
    try {
      const channel = echo.channel('rooms');
      channel.listen('.room.status.updated', (eventData) => {
        setToast({
          type: 'info',
          message: `Hab. ${eventData?.room_number}: estado cambió de ${eventData?.old_status} a ${eventData?.new_status}`,
        });
        fetchRef.current(false); // Refrescar en background sin skeletons
      });
      return () => {
        echo.leaveChannel('rooms');
      };
    } catch {
      return undefined;
    }
  }, []);

  const showNotification = (message, type = 'success') => setToast({ message, type });
  const { user } = useAuth();
  const isAdmin = !!user?.roles?.includes('admin');

  useEscapeKey(() => { if (!submitting) setIsModalOpen(false); }, isModalOpen);

  // Cambio rápido de estado en 1-click (devuelve el error de la API o null)
  const applyQuickStatusChange = async ({ roomId, newStatus, roomNumber }, options = {}) => {
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
      await updateRoomStatus(roomId, newStatus, options);
      showNotification(`Habitación ${roomNumber} actualizada a estado: ${newStatus.toUpperCase()}`);
      // Refrescar en background para asegurar sincronización con base de datos sin mostrar skeletons
      fetchRoomsData(false);
    } catch (err) {
      logError('rooms:status', err);
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

      // Con reservas afectadas, el administrador decide en el diálogo "Forzar"
      if (!(isAdmin && isForceableError(err))) {
        showNotification(apiErrorMessage(err, 'No se pudo actualizar el estado.'), 'error');
      }
      return err;
    }
    return null;
  };

  const { requestChange: requestStatusChange, dialogs: statusDialogs } = useRoomStatusChange({
    isAdmin,
    submit: applyQuickStatusChange,
  });

  // Mantenimiento pide motivo; un 409 con reservas afectadas permite forzar (admin)
  const handleQuickStatusChange = (roomId, newStatus, roomNumber) => {
    const oldRoom = rooms.find((r) => r.id === roomId);
    if (!oldRoom || oldRoom.status === newStatus) return;
    requestStatusChange({ roomId, newStatus, roomNumber, oldStatus: oldRoom.status });
  };

  // Abrir Modal para Crear
  const handleOpenCreateModal = () => {
    setEditingRoom(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Abrir Modal para Editar
  const handleOpenEditModal = (room) => {
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number || '',
      name: room.name || '',
      room_type_id: room.room_type_id ? String(room.room_type_id) : '',
      bed_type: room.bed_type || 'individual',
      capacity: room.capacity || 1,
      size_m2: room.size_m2 || '',
      // price_override = tarifa propia de la habitación (null = usa la base del tipo)
      price_per_night: room.price_override !== undefined
        ? (room.price_override ?? '')
        : (room.price_per_night || ''),
      extra_amenities: Array.isArray(room.extra_amenities) ? room.extra_amenities : [],
      description: room.description || '',
      // Las rutas relativas (/storage/...) las gestiona la galería; solo se edita una URL externa
      image_url: /^https?:\/\//i.test(room.image_url || '') ? room.image_url : '',
      image_file: null,
      status: room.status || 'disponible',
    });
    setFormErrors({});
    setStatusReason('');
    setAffectedOnSave(null);
    setForceSave(false);
    setIsModalOpen(true);
  };

  // Guardar (Crear o Editar)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});

    try {
      // Usar FormData para soportar subida de imágenes
      const dataToSend = new FormData();
      dataToSend.append('room_number', formData.room_number);
      dataToSend.append('name', formData.name);
      dataToSend.append('room_type_id', formData.room_type_id || '');
      dataToSend.append('bed_type', formData.bed_type);
      dataToSend.append('capacity', formData.capacity);
      dataToSend.append('size_m2', formData.size_m2 || '');
      dataToSend.append('price_per_night', formData.price_per_night ?? '');
      dataToSend.append('extra_amenities', JSON.stringify(formData.extra_amenities || []));
      dataToSend.append('description', formData.description || '');
      dataToSend.append('status', formData.status);
      if (editingRoom && formData.status !== editingRoom.status) {
        if (statusReason.trim()) dataToSend.append('reason', statusReason.trim());
        if (forceSave) dataToSend.append('force', '1');
      }

      if (formData.image_file) {
        dataToSend.append('image', formData.image_file);
      } else if (formData.image_url) {
        dataToSend.append('image_url', formData.image_url);
      }

      if (editingRoom) {
        await updateRoom(editingRoom.id, dataToSend);
        showNotification(`Habitación ${formData.room_number} actualizada correctamente`);
      } else {
        await createRoom(dataToSend);
        showNotification(`Habitación ${formData.room_number} creada exitosamente`);
      }
      setIsModalOpen(false);
      fetchRoomsData();
    } catch (err) {
      logError('rooms:save', err);
      setFormErrors(err.response?.data?.errors || {});
      setAffectedOnSave(isForceableError(err) ? (err.response.data.affected_bookings || []) : null);
      showNotification(apiErrorMessage(err, 'Error al guardar la habitación.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Eliminar Habitación
  const handleDeleteRoom = async () => {
    const room = deleteTarget;
    setDeleteTarget(null);
    if (!room) return;
    try {
      await deleteRoom(room.id);
      showNotification(`Habitación ${room.room_number} eliminada del inventario`);
      fetchRoomsData();
    } catch (err) {
      logError('rooms:delete', err);
      // 409/422: la habitación tiene reservas asociadas (mensaje del backend)
      showNotification(apiErrorMessage(err, 'No se pudo eliminar la habitación.'), 'error');
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#fbf9f4] text-[#1b1c19] font-sans overflow-hidden">
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
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#78716c] text-sm" aria-hidden="true">
                search
              </span>
              <label htmlFor="room-search" className="sr-only">Buscar habitación</label>
              <input
                id="room-search"
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
                        {room.room_type?.name || room.bed_type} • {room.capacity} persona(s) {room.size_m2 ? `• ${room.size_m2}m²` : ''}
                      </p>

                      {/* Precio por noche */}
                      <div className="bg-[#f5f3ee] border border-[#d1c5af] p-2 mb-3 flex justify-between items-center font-mono text-xs">
                        <span className="text-[#78716c]">
                          Tarifa / noche{room.room_type_id && room.price_override == null ? ' (tipo)' : ''}:
                        </span>
                        <span className="font-bold text-[#14213d] text-sm">
                          {formatCurrency(room.price_per_night)}
                        </span>
                      </div>
                    </div>

                    {/* Acciones y Cambio Rápido de Estado en 1-Click */}
                    <div className="space-y-3 pt-2 border-t border-[#d1c5af]">
                      {/* Dropdown de Cambio Rápido de Estado */}
                      <div>
                        <label htmlFor={`room-status-${room.id}`}  className="block font-mono text-[9px] uppercase font-bold text-[#78716c] mb-1">
                          Cambiar Estado (1-Click)
                        </label>
                        <select id={`room-status-${room.id}`}
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
                          onClick={() => setDeleteTarget(room)}
                          className="px-2.5 py-1.5 bg-[#ffebee] hover:bg-[#ffcdd2] border border-[#ef5350] text-[#b71c1c] font-mono text-xs font-bold flex items-center justify-center cursor-pointer transition-all"
                          title="Eliminar Habitación"
                          aria-label={`Eliminar habitación ${room.room_number}`}
                        >
                          <span className="material-symbols-outlined text-xs" aria-hidden="true">delete</span>
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
          <div role="dialog" aria-modal="true" aria-labelledby="room-modal-title" className="bg-[#fbf9f4] border-2 border-[#c9a227] shadow-[6px_6px_0px_#14213d] max-w-xl w-full overflow-hidden">

            {/* Header Modal */}
            <div className="bg-[#14213d] text-[#fbf9f4] px-6 py-4 flex justify-between items-center border-b border-[#c9a227]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#c9a227]">
                  {editingRoom ? 'edit_note' : 'add_circle'}
                </span>
                <h3 id="room-modal-title" className="font-serif font-bold text-lg">
                  {editingRoom ? `Editar Habitación ${editingRoom.room_number}` : 'Registrar Nueva Habitación'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#d1c5af] hover:text-white cursor-pointer"
                aria-label="Cerrar"
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>

            {/* Formulario Body */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 font-mono text-xs">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="room-2" className="block font-bold text-[#4d4635] uppercase mb-1">
                    Número de Habitación *
                  </label>
                  <input id="room-2"
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
                  <label htmlFor="room-3" className="block font-bold text-[#4d4635] uppercase mb-1">
                    Nombre / Categoría *
                  </label>
                  <input id="room-3"
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

                <div className="sm:col-span-2">
                  <label htmlFor="room-type" className="block font-bold text-[#4d4635] uppercase mb-1">
                    Tipo de Habitación
                  </label>
                  <select id="room-type"
                    value={formData.room_type_id}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono cursor-pointer"
                  >
                    <option value="">Sin tipo (tarifa propia obligatoria)</option>
                    {roomTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — base {formatCurrency(t.base_price)}{t.active ? '' : ' (inactivo)'}
                      </option>
                    ))}
                  </select>
                  {formErrors.room_type_id && (
                    <p className="text-[#ba1a1a] text-[10px] mt-1">{formErrors.room_type_id[0]}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="room-4" className="block font-bold text-[#4d4635] uppercase mb-1">
                    Tipo de Cama *
                  </label>
                  <select id="room-4"
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
                  <label htmlFor="room-5" className="block font-bold text-[#4d4635] uppercase mb-1">
                    Capacidad (Huéspedes) *
                  </label>
                  <input id="room-5"
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
                  <label htmlFor="room-6" className="block font-bold text-[#4d4635] uppercase mb-1">
                    {selectedType ? 'Tarifa propia (opcional, S/)' : 'Tarifa por Noche (S/) *'}
                  </label>
                  <input id="room-6"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={selectedType ? `Base del tipo: ${Number(selectedType.base_price).toFixed(2)}` : '250.00'}
                    value={formData.price_per_night}
                    onChange={(e) => setFormData({ ...formData, price_per_night: e.target.value })}
                    required={!selectedType}
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono focus:border-[#14213d] focus:outline-none"
                  />
                  {formErrors.price_per_night && (
                    <p className="text-[#ba1a1a] text-[10px] mt-1">{formErrors.price_per_night[0]}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="room-7" className="block font-bold text-[#4d4635] uppercase mb-1">
                    Tamaño (m²)
                  </label>
                  <input id="room-7"
                    type="number"
                    step="0.1"
                    placeholder="35"
                    value={formData.size_m2}
                    onChange={(e) => setFormData({ ...formData, size_m2: e.target.value })}
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono focus:border-[#14213d] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="room-8" className="block font-bold text-[#4d4635] uppercase mb-1">
                    Estado Inicial *
                  </label>
                  <select id="room-8"
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

                {editingRoom && formData.status === 'mantenimiento' && editingRoom.status !== 'mantenimiento' && (
                  <div className="sm:col-span-2">
                    <label htmlFor="room-reason" className="block font-bold text-[#4d4635] uppercase mb-1">
                      Motivo del mantenimiento *
                    </label>
                    <textarea id="room-reason"
                      rows={2}
                      required
                      maxLength={500}
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                      className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-sans resize-none"
                    />
                    {formErrors.reason && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{formErrors.reason[0]}</p>}
                  </div>
                )}

                {editingRoom && affectedOnSave && affectedOnSave.length > 0 && isAdmin && (
                  <div className="sm:col-span-2 bg-[#ffdad6] border border-[#ba1a1a]/40 p-3 text-[#93000a] font-mono text-[11px] space-y-2">
                    <p className="font-bold">Reservas afectadas en los próximos 7 días:</p>
                    <ul className="list-disc pl-5">
                      {affectedOnSave.map((b) => (
                        <li key={b.booking_code}>{b.booking_code} — {b.guest_name || 'Huésped'}</li>
                      ))}
                    </ul>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={forceSave} onChange={(e) => setForceSave(e.target.checked)} />
                      <span>Forzar el cambio a mantenimiento</span>
                    </label>
                  </div>
                )}

                <fieldset className="sm:col-span-2">
                  <legend className="block font-bold text-[#4d4635] uppercase mb-1">Comodidades extra de la habitación</legend>
                  {selectedType?.amenities?.length > 0 && (
                    <p className="text-[10px] text-[#78716c] mb-1">
                      Incluidas por el tipo: {selectedType.amenities.map((k) => AMENITIES[k]?.label || k).join(', ')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {AMENITY_KEYS.filter((k) => !(selectedType?.amenities || []).includes(k)).map((key) => {
                      const on = formData.extra_amenities.includes(key);
                      return (
                        <button key={key} type="button" onClick={() => toggleExtraAmenity(key)} aria-pressed={on}
                          className={`px-2 py-1 border text-[10px] flex items-center gap-1 cursor-pointer ${on ? 'bg-[#14213d] text-[#fbf9f4] border-[#14213d]' : 'bg-[#fbf9f4] text-[#4d4635] border-[#d1c5af] hover:border-[#14213d]'}`}>
                          <span className="material-symbols-outlined text-xs" aria-hidden="true">{AMENITIES[key].icon}</span>
                          {AMENITIES[key].label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {editingRoom && isAdmin && (
                  <div className="sm:col-span-2">
                    <RoomImageManager
                      roomId={editingRoom.id}
                      onNotify={showNotification}
                      onChanged={() => fetchRoomsData(false)}
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label htmlFor={editingRoom ? 'room-9-url' : 'room-9'} className="block font-bold text-[#4d4635] uppercase mb-1">
                    {editingRoom ? 'Imagen de respaldo (si no hay galería)' : 'Imagen de la Habitación (Opcional)'}
                  </label>
                  <div className="flex flex-col gap-2">
                    {!editingRoom && (
                      <input id="room-9"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => setFormData({ ...formData, image_file: e.target.files[0] })}
                        className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-1.5 text-xs font-mono focus:border-[#14213d] focus:outline-none file:mr-4 file:py-1 file:px-3 file:border-0 file:bg-[#14213d] file:text-[#fbf9f4] file:font-bold file:cursor-pointer hover:file:bg-[#2a385e]"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#78716c] uppercase font-bold">O ingresar URL:</span>
                      <input
                        id="room-9-url"
                        type="url"
                        placeholder="https://images.unsplash.com/..."
                        value={formData.image_url}
                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                        disabled={!!formData.image_file}
                        className="flex-1 bg-[#fbf9f4] border border-[#d1c5af] p-1.5 text-xs font-mono focus:border-[#14213d] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                  {formErrors.image && (
                    <p className="text-[#ba1a1a] text-[10px] mt-1">{formErrors.image[0]}</p>
                  )}
                  {formErrors.image_url && (
                    <p className="text-[#ba1a1a] text-[10px] mt-1">{formErrors.image_url[0]}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="room-10" className="block font-bold text-[#4d4635] uppercase mb-1">
                    Descripción
                  </label>
                  <textarea id="room-10"
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
        message={toast?.message}
        isOpen={!!toast}
        type={toast?.type}
        onClose={() => setToast(null)}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar habitación"
        message={deleteTarget ? `¿Estás seguro de eliminar la Habitación ${deleteTarget.room_number} (${deleteTarget.name})?` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeleteRoom}
        onCancel={() => setDeleteTarget(null)}
      />

      {statusDialogs}
    </div>
  );
}
