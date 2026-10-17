import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import StaffSidebar from '../../components/StaffSidebar';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import HousekeepingTasks from '../../components/staff/HousekeepingTasks';
import { roomAccountPath } from '../../utils/frontDesk';
import { getStaffRooms, updateRoomStatus } from '../../services/roomStaffService';
import echo from '../../services/echo';
import { useAuth } from '../../context/AuthContext';
import useRoomStatusChange, { isForceableError } from '../../hooks/useRoomStatusChange';
import logError from '../../utils/logError';
import { apiErrorMessage } from '../../utils/apiError';

// Configuración de las columnas Kanban
/** La habitación tiene un huésped con check-in activo (dato del servidor; respaldo: estado ocupada). */
const hasGuest = (room) => (room.has_guest !== undefined && room.has_guest !== null
  ? Boolean(room.has_guest)
  : room.status === 'ocupada');

/**
 * Pista visual de transiciones inválidas (el servidor es la fuente de verdad).
 * Devuelve el motivo por el que la opción está deshabilitada, o null.
 */
function invalidTargetReason(room, target) {
  if (room.status === target) return null;
  if (target === 'ocupada' && !hasGuest(room)) return 'solo mediante check-in';
  if ((target === 'disponible' || target === 'mantenimiento') && hasGuest(room)) return 'huésped alojado';
  return null;
}

const STATUS_OPTIONS = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'ocupada', label: 'Ocupada' },
  { value: 'limpieza', label: 'En Limpieza' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
];

const STATUS_COLUMNS = [
  { id: 'disponible', title: 'Disponibles', dotColor: 'bg-[#4caf50]', borderTop: 'border-t-[#4caf50]', bgColor: 'bg-white' },
  { id: 'ocupada', title: 'Ocupadas', dotColor: 'bg-[#1976d2]', borderTop: 'border-t-[#1976d2]', bgColor: 'bg-white' },
  { id: 'limpieza', title: 'En Limpieza', dotColor: 'bg-[#ffb300]', borderTop: 'border-t-[#ffb300]', bgColor: 'bg-white' },
  { id: 'mantenimiento', title: 'Mantenimiento', dotColor: 'bg-[#d32f2f]', borderTop: 'border-t-[#d32f2f]', bgColor: 'bg-[#fcede8]' }, // Ligeramente rojizo como en la imagen
];

export default function HousekeepingDashboard() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [floorFilter, setFloorFilter] = useState('Todos los pisos');
  const [typeFilter, setTypeFilter] = useState('Todos los tipos');

  // Notificaciones Toast
  const [toast, setToast] = useState(null);
  const [pendingChange, setPendingChange] = useState(null);
  const { user } = useAuth();
  // Pestañas: tablero Kanban de estados | tareas asignables (SHE-032)
  const [view, setView] = useState('board');
  const isAdmin = !!user?.roles?.includes('admin');

  const fetchRoomsData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await getStaffRooms({ status: 'todos' });
      setRooms(data.rooms || []);
    } catch (err) {
      logError('housekeeping:fetch', err);
      setError(apiErrorMessage(err, 'Error al cargar habitaciones.'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoomsData();
  }, [fetchRoomsData]);

  // WebSockets para actualizaciones en vivo (solo si Reverb está configurado)
  const fetchRef = useRef(fetchRoomsData);
  useEffect(() => {
    fetchRef.current = fetchRoomsData;
  }, [fetchRoomsData]);

  useEffect(() => {
    if (!echo) return undefined;
    try {
      const channel = echo.channel('rooms');
      channel.listen('.room.status.updated', (eventData) => {
        setToast({ type: 'info', message: `Hab. ${eventData?.room_number}: estado cambió a ${eventData?.new_status}` });
        fetchRef.current(false);
      });
      return () => {
        echo.leaveChannel('rooms');
      };
    } catch {
      return undefined;
    }
  }, []);

  const showNotification = (message, type = 'success') => {
    setToast({ message, type });
  };

  /**
   * Aplica el cambio (optimista) y devuelve el error de la API, o null si tuvo éxito.
   */
  const applyStatusChange = async ({ roomId, newStatus, roomNumber, oldStatus }, options = {}) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status: newStatus } : r));

    try {
      await updateRoomStatus(roomId, newStatus, options);
      showNotification(`Habitación ${roomNumber} actualizada a: ${newStatus}`);
      fetchRoomsData(false);
      return null;
    } catch (err) {
      logError('housekeeping:status', err);
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status: oldStatus } : r));
      // Para un admin, el 409 con reservas afectadas abre el diálogo "Forzar" en lugar del aviso
      if (!(isAdmin && isForceableError(err))) {
        showNotification(apiErrorMessage(err, 'No se pudo actualizar el estado.'), 'error');
      }
      return err;
    }
  };

  const { requestChange, dialogs: statusDialogs } = useRoomStatusChange({
    isAdmin,
    submit: applyStatusChange,
  });

  const handleStatusChange = (roomId, newStatus, roomNumber) => {
    const oldRoom = rooms.find((r) => r.id === roomId);
    if (!oldRoom || oldRoom.status === newStatus) return;

    const change = { roomId, newStatus, roomNumber, oldStatus: oldRoom.status };

    // Habitación con huésped que pasa a limpieza: confirmar (sigue alojado)
    if (hasGuest(oldRoom) && newStatus === 'limpieza') {
      setPendingChange(change);
      setRooms([...rooms]);
      return;
    }

    requestChange(change);
  };

  // Filtrado en el cliente (piso/tipo)
  const filteredRooms = rooms.filter(room => {
    let matchFloor = true;
    if (floorFilter !== 'Todos los pisos') {
      const floorStr = String(room.room_number)[0]; // Asumiendo formato 101, 205
      matchFloor = `Piso ${floorStr}` === floorFilter;
    }
    let matchType = true;
    if (typeFilter !== 'Todos los tipos') {
      matchType = room.bed_type.toLowerCase() === typeFilter.toLowerCase();
    }
    return matchFloor && matchType;
  });

  // Agrupado por estado
  const roomsByStatus = {
    disponible: filteredRooms.filter(r => r.status === 'disponible'),
    ocupada: filteredRooms.filter(r => r.status === 'ocupada' || r.status === 'reservada'), // Agrupamos reservada aquí o creamos otra columna, la imagen muestra 4
    limpieza: filteredRooms.filter(r => r.status === 'limpieza'),
    mantenimiento: filteredRooms.filter(r => r.status === 'mantenimiento'),
  };

  // Extraer opciones únicas para los filtros
  const availableFloors = ['Todos los pisos', ...new Set(rooms.map(r => `Piso ${String(r.room_number)[0]}`))].sort();
  const availableTypes = ['Todos los tipos', ...new Set(rooms.map(r => r.bed_type))];

  return (
    <div className="flex h-screen bg-[#e5e4de] text-[#1b1c19] font-sans overflow-hidden">
      <StaffSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header simple estilo Housekeeping */}
        <header className="px-8 pt-8 pb-4">
          <p className="text-[10px] font-mono tracking-widest text-[#78716c] uppercase font-bold mb-1">
            OPERATION PANEL
          </p>
          <h1 className="font-serif text-4xl font-bold text-[#2d2d2a] tracking-tight">
            Estado de Habitaciones (Housekeeping)
          </h1>
        </header>

        <main className="px-4 md:px-8 pb-8 flex-grow flex flex-col">
          <div role="tablist" aria-label="Vistas de housekeeping" className="flex gap-1 mb-6 border-b border-[#d1c5af]">
            {[{ id: 'board', label: 'Tablero', icon: 'view_kanban' }, { id: 'tasks', label: 'Tareas', icon: 'task_alt' }].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={view === t.id}
                onClick={() => setView(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest font-bold border-b-2 -mb-px cursor-pointer ${view === t.id ? 'border-[#c9a227] text-[#14213d]' : 'border-transparent text-[#78716c] hover:text-[#14213d]'}`}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {view === 'tasks' && (
            <HousekeepingTasks
              rooms={rooms}
              isAdmin={isAdmin}
              currentUser={user}
              notify={showNotification}
              onRoomsChanged={() => fetchRoomsData(false)}
            />
          )}

          {view === 'board' && (<>
          {/* Barra de Filtros (Estilo papel/minimalista) */}
          <div className="bg-white p-4 flex flex-wrap items-center gap-4 sm:gap-8 mb-8 shadow-sm">
            <span className="font-mono text-xs font-bold text-[#c9a227] tracking-widest uppercase">
              FILTROS
            </span>
            <div className="flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-2">
                <label htmlFor="hk-floor" className="font-mono text-[10px] uppercase font-bold text-[#78716c]">Piso</label>
                <select
                  id="hk-floor"
                  value={floorFilter}
                  onChange={(e) => setFloorFilter(e.target.value)}
                  className="border-b border-[#78716c] pb-1 text-sm bg-transparent focus:outline-none font-medium cursor-pointer"
                >
                  {availableFloors.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="hk-type" className="font-mono text-[10px] uppercase font-bold text-[#78716c]">Tipo</label>
                <select
                  id="hk-type"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="border-b border-[#78716c] pb-1 text-sm bg-transparent focus:outline-none font-medium cursor-pointer capitalize"
                >
                  {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-4 mb-6 text-[#93000a] font-mono text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Tablero Kanban */}
          {loading ? (
            <div className="flex gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="flex-1 bg-white/50 h-96 animate-pulse rounded-sm" />
              ))}
            </div>
          ) : (
            <div className="flex gap-6 overflow-x-auto pb-4 flex-grow items-start">
              {STATUS_COLUMNS.map((col) => (
                <div key={col.id} className="flex-1 min-w-[280px] max-w-[320px] flex flex-col">
                  {/* Encabezado de Columna */}
                  <div className={`flex justify-between items-center pb-2 mb-4 border-b-2 border-gray-300 ${col.borderTop} pt-2`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${col.dotColor}`}></span>
                      <h2 className="font-serif text-lg font-bold text-[#2d2d2a]">{col.title}</h2>
                    </div>
                    <span className="font-mono text-xs text-[#78716c] font-bold">
                      {roomsByStatus[col.id]?.length || 0}
                    </span>
                  </div>

                  {/* Lista de Tarjetas */}
                  <div className="flex flex-col gap-4">
                    {roomsByStatus[col.id]?.map((room) => (
                      <div
                        key={room.id}
                        className={`p-4 shadow-sm border border-gray-200 relative group flex flex-col ${col.bgColor}`}
                      >
                        {/* Header Tarjeta */}
                        <div className="flex justify-between items-start mb-4">
                          <div className={`px-2 py-1 text-white font-mono text-xs font-bold ${
                            room.status === 'disponible' ? 'bg-[#7a9d54]' :
                            room.status === 'ocupada' || room.status === 'reservada' ? 'bg-[#987d35]' :
                            room.status === 'limpieza' ? 'bg-[#987d35]' : 'bg-[#b71c1c]'
                          }`}>
                            {room.room_number}
                          </div>

                          {/* Dropdown de Estado o Ver Cuenta */}
                          <div className="relative flex items-center gap-3">
                            {(room.status === 'ocupada' || room.status === 'reservada') && (
                              <Link
                                to={roomAccountPath(isAdmin, room.id)}
                                className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#c9a227] hover:text-[#987d35] transition-colors"
                              >
                                Ver Cuenta
                              </Link>
                            )}
                            <div className="relative flex items-center">
                              <select
                                className="appearance-none bg-transparent text-transparent text-xl font-bold leading-none cursor-pointer focus:outline-none focus:ring-0 text-right w-8 z-10 relative"
                                style={{ border: 'none' }}
                                value={room.status}
                                onChange={(e) => handleStatusChange(room.id, e.target.value, room.room_number)}
                                title="Cambiar estado"
                              >
                                {room.status === 'reservada' && <option value="reservada" className="text-[#2d2d2a] text-sm">Reservada</option>}
                                {STATUS_OPTIONS.map((opt) => {
                                  const blocked = invalidTargetReason(room, opt.value);
                                  return (
                                    <option
                                      key={opt.value}
                                      value={opt.value}
                                      disabled={!!blocked}
                                      className="text-[#2d2d2a] text-sm"
                                    >
                                      {blocked ? `${opt.label} (${blocked})` : opt.label}
                                    </option>
                                  );
                                })}
                              </select>
                              <div className="absolute right-0 top-0 pointer-events-none text-[#a39f96] group-hover:text-[#2d2d2a] font-bold text-xl leading-none z-0">
                                ...
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Cuerpo Tarjeta */}
                        <div className="mb-6 flex-grow">
                          <h3 className="font-serif font-bold text-lg text-[#2d2d2a] mb-1">{room.name}</h3>
                          <p className="font-sans text-xs text-[#78716c] line-clamp-2">
                            {room.description || `Cama ${room.bed_type}, Capacidad: ${room.capacity}`}
                          </p>
                        </div>

                        {/* Footer Tarjeta */}
                        <div className="border-t border-gray-200 pt-3 flex justify-between items-center text-[10px] font-mono font-bold uppercase tracking-widest text-[#78716c]">
                          {room.status === 'disponible' && (
                            <>
                              <span>INSPECCIONADA</span>
                              <span className="material-symbols-outlined text-[#4caf50] text-lg">check_circle</span>
                            </>
                          )}
                          {(room.status === 'ocupada' || room.status === 'reservada') && (
                            <>
                              <span>{room.status === 'reservada' ? 'RESERVADA' : 'OCUPADA'}</span>
                              <span className="material-symbols-outlined text-[#1976d2] text-lg">
                                {room.status === 'reservada' ? 'bookmark' : 'person'}
                              </span>
                            </>
                          )}
                          {room.status === 'limpieza' && (
                            <>
                              <span className="text-[#c9a227]">EN PROGRESO</span>
                              <span className="material-symbols-outlined text-[#c9a227] text-lg">cleaning_services</span>
                            </>
                          )}
                          {room.status === 'mantenimiento' && (
                            <>
                              <span className="text-[#d32f2f]">URGENTE</span>
                              <span className="material-symbols-outlined text-[#d32f2f] text-lg">build</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          </>)}
        </main>
      </div>

      <Toast message={toast?.message} isOpen={!!toast} type={toast?.type} onClose={() => setToast(null)} />

      <ConfirmDialog
        isOpen={!!pendingChange}
        title="Cambiar estado de habitación ocupada"
        message={pendingChange ? `La Habitación ${pendingChange.roomNumber} está ocupada por un huésped. Si cambias el estado a '${pendingChange.newStatus}', dejará de aparecer como 'Ocupada' en este tablero, aunque la reserva siga activa.\n\n¿Deseas cambiar su estado físico?` : ''}
        confirmLabel="Sí, cambiar estado"
        onCancel={() => setPendingChange(null)}
        onConfirm={() => {
          const change = pendingChange;
          setPendingChange(null);
          requestChange(change);
        }}
      />

      {statusDialogs}
    </div>
  );
}
