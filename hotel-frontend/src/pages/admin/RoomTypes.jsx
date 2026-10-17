import { useCallback, useEffect, useState } from 'react';
import StaffSidebar from '../../components/StaffSidebar';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import useEscapeKey from '../../hooks/useEscapeKey';
import formatCurrency from '../../utils/formatCurrency';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';
import { AMENITIES, AMENITY_KEYS } from '../../constants/amenities';
import {
  getRoomTypes,
  createRoomType,
  updateRoomType,
  deleteRoomType,
} from '../../services/roomTypeService';

const BED_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'doble', label: 'Doble' },
  { value: 'king', label: 'King Size' },
  { value: 'suite', label: 'Suite' },
  { value: 'familiar', label: 'Familiar' },
];

const EMPTY_FORM = {
  name: '',
  description: '',
  base_price: '',
  capacity: 2,
  bed_type: 'doble',
  amenities: ['wifi', 'tv', 'ac', 'bath'],
  active: true,
};

/**
 * Administración de tipos de habitación y tarifas base (SHE-034 / SHE-035).
 * Ruta: /admin/tipos-habitacion (solo admin).
 */
export default function RoomTypes() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const showNotification = (message, type = 'success') => setToast({ message, type });

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRoomTypes();
      setTypes(data.room_types || []);
    } catch (err) {
      logError('room-types:list', err);
      setToast({ type: 'error', message: apiErrorMessage(err, 'Error al cargar los tipos de habitación.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  useEscapeKey(() => { if (!submitting) setIsModalOpen(false); }, isModalOpen);

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (type) => {
    setEditing(type);
    setFormData({
      name: type.name || '',
      description: type.description || '',
      base_price: type.base_price ?? '',
      capacity: type.capacity || 1,
      bed_type: type.bed_type || 'doble',
      amenities: Array.isArray(type.amenities) ? type.amenities : [],
      active: !!type.active,
    });
    setFormErrors({});
    setFormError('');
    setIsModalOpen(true);
  };

  const toggleAmenity = (key) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(key)
        ? prev.amenities.filter((k) => k !== key)
        : [...prev.amenities, key],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormErrors({});

    if (!formData.name.trim()) {
      setFormError('El nombre del tipo es obligatorio.');
      return;
    }
    if (formData.base_price === '' || Number(formData.base_price) < 0) {
      setFormError('Ingrese una tarifa base válida.');
      return;
    }

    const payload = {
      ...formData,
      name: formData.name.trim(),
      base_price: Number(formData.base_price),
      capacity: Number(formData.capacity),
    };

    setSubmitting(true);
    try {
      if (editing) {
        await updateRoomType(editing.id, payload);
        showNotification(`Tipo "${payload.name}" actualizado.`);
      } else {
        await createRoomType(payload);
        showNotification(`Tipo "${payload.name}" creado.`);
      }
      setIsModalOpen(false);
      fetchTypes();
    } catch (err) {
      logError('room-types:save', err);
      setFormErrors(err.response?.data?.errors || {});
      setFormError(apiErrorMessage(err, 'No se pudo guardar el tipo de habitación.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    try {
      await deleteRoomType(target.id);
      showNotification(`Tipo "${target.name}" eliminado.`);
      fetchTypes();
    } catch (err) {
      logError('room-types:delete', err);
      // 409: el tipo tiene habitaciones asignadas
      showNotification(apiErrorMessage(err, 'No se pudo eliminar el tipo.'), 'error');
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#fbf9f4] text-[#1b1c19] font-sans overflow-hidden">
      <StaffSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-[#14213d] text-[#fbf9f4] px-6 py-5 border-b border-[#c9a227] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#c9a227] text-2xl" aria-hidden="true">category</span>
              <h1 className="font-serif text-2xl font-bold tracking-wide">Tipos de Habitación y Tarifas</h1>
            </div>
            <p className="font-mono text-xs text-[#d1c5af] mt-0.5">
              Tarifa base por tipo • cada habitación puede definir una tarifa propia
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="px-5 py-2.5 bg-[#c9a227] hover:bg-[#b08b1a] text-[#14213d] font-mono text-xs uppercase tracking-wider font-bold border border-[#14213d] shadow-[2px_2px_0px_#14213d] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">add</span>
            <span>Nuevo tipo</span>
          </button>
        </header>

        <main className="p-6 flex-grow">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-[#f5f3ee] border border-[#d1c5af] h-48 animate-pulse" />
              ))}
            </div>
          ) : types.length === 0 ? (
            <div className="bg-[#f5f3ee] border border-[#d1c5af] p-12 text-center max-w-md mx-auto my-8 space-y-3">
              <span className="material-symbols-outlined text-4xl text-[#755b00]" aria-hidden="true">category</span>
              <h2 className="font-serif text-lg font-bold">Aún no hay tipos de habitación</h2>
              <p className="text-xs text-[#4d4635]">Cree un tipo para definir su tarifa base y comodidades.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {types.map((type) => (
                <article key={type.id} className={`bg-[#fbf9f4] border-2 p-4 flex flex-col gap-3 shadow-[2px_2px_0px_rgba(20,33,61,0.15)] ${type.active ? 'border-[#d1c5af]' : 'border-dashed border-[#d1c5af] opacity-70'}`}>
                  <div className="flex items-start justify-between gap-2 border-b border-[#d1c5af] pb-2">
                    <div>
                      <h2 className="font-serif font-bold text-lg">{type.name}</h2>
                      <p className="font-mono text-[10px] text-[#78716c] uppercase">
                        {type.slug} • {type.capacity} huésped(es){type.bed_type ? ` • cama ${type.bed_type}` : ''}
                      </p>
                    </div>
                    {!type.active && (
                      <span className="font-mono text-[10px] uppercase border border-[#d1c5af] px-2 py-0.5 text-[#78716c]">Inactivo</span>
                    )}
                  </div>

                  {type.description && <p className="text-xs text-[#4d4635] line-clamp-2">{type.description}</p>}

                  <div className="bg-[#f5f3ee] border border-[#d1c5af] p-2 flex justify-between items-center font-mono text-xs">
                    <span className="text-[#78716c]">Tarifa base / noche:</span>
                    <span className="font-bold text-[#14213d] text-sm">{formatCurrency(type.base_price)}</span>
                  </div>

                  <ul className="flex flex-wrap gap-1.5" aria-label="Comodidades">
                    {(type.amenities || []).filter((k) => AMENITIES[k]).map((k) => (
                      <li key={k} className="flex items-center gap-1 text-[10px] bg-[#f5f3ee] border border-[#d1c5af] px-1.5 py-0.5" title={AMENITIES[k].label}>
                        <span className="material-symbols-outlined text-xs text-[#755b00]" aria-hidden="true">{AMENITIES[k].icon}</span>
                        {AMENITIES[k].label}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto flex items-center justify-between pt-2 border-t border-[#d1c5af]">
                    <span className="font-mono text-[11px] text-[#4d4635]">
                      {type.rooms_count || 0} habitación(es)
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(type)}
                        className="px-3 py-1.5 bg-[#f5f3ee] hover:bg-[#e4e2dd] border border-[#d1c5af] text-[#14213d] font-mono text-[11px] uppercase font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xs" aria-hidden="true">edit</span>
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(type)}
                        className="px-2.5 py-1.5 bg-[#ffebee] hover:bg-[#ffcdd2] border border-[#ef5350] text-[#b71c1c] cursor-pointer"
                        aria-label={`Eliminar tipo ${type.name}`}
                        title={type.rooms_count > 0 ? 'Tiene habitaciones asignadas' : 'Eliminar'}
                      >
                        <span className="material-symbols-outlined text-xs" aria-hidden="true">delete</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#14213d]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="room-type-modal-title" className="bg-[#fbf9f4] border-2 border-[#c9a227] shadow-[6px_6px_0px_#14213d] max-w-xl w-full">
            <div className="bg-[#14213d] text-[#fbf9f4] px-6 py-4 flex justify-between items-center border-b border-[#c9a227]">
              <h3 id="room-type-modal-title" className="font-serif font-bold text-lg">
                {editing ? `Editar tipo: ${editing.name}` : 'Nuevo tipo de habitación'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-[#d1c5af] hover:text-white cursor-pointer" aria-label="Cerrar">
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 font-mono text-xs">
              {formError && (
                <div className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-2 text-[#93000a]" role="alert">{formError}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="rt-name" className="block font-bold text-[#4d4635] uppercase mb-1">Nombre *</label>
                  <input id="rt-name" type="text" required maxLength={100} value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 font-sans focus:border-[#14213d] focus:outline-none" />
                  {formErrors.name && <p className="text-[#ba1a1a] text-[10px] mt-1">{formErrors.name[0]}</p>}
                </div>

                <div>
                  <label htmlFor="rt-price" className="block font-bold text-[#4d4635] uppercase mb-1">Tarifa base (S/) *</label>
                  <input id="rt-price" type="number" min="0" step="0.01" required value={formData.base_price}
                    onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 focus:border-[#14213d] focus:outline-none" />
                  {formErrors.base_price && <p className="text-[#ba1a1a] text-[10px] mt-1">{formErrors.base_price[0]}</p>}
                </div>

                <div>
                  <label htmlFor="rt-capacity" className="block font-bold text-[#4d4635] uppercase mb-1">Capacidad *</label>
                  <input id="rt-capacity" type="number" min="1" max="20" required value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 focus:border-[#14213d] focus:outline-none" />
                </div>

                <div>
                  <label htmlFor="rt-bed" className="block font-bold text-[#4d4635] uppercase mb-1">Tipo de cama</label>
                  <select id="rt-bed" value={formData.bed_type}
                    onChange={(e) => setFormData({ ...formData, bed_type: e.target.value })}
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 cursor-pointer">
                    {BED_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })} />
                    <span className="font-bold text-[#4d4635] uppercase">Activo (visible en filtros)</span>
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="rt-desc" className="block font-bold text-[#4d4635] uppercase mb-1">Descripción</label>
                  <textarea id="rt-desc" rows={2} maxLength={1000} value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 font-sans resize-none focus:border-[#14213d] focus:outline-none" />
                </div>

                <fieldset className="sm:col-span-2">
                  <legend className="block font-bold text-[#4d4635] uppercase mb-1">Comodidades del tipo</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {AMENITY_KEYS.map((key) => {
                      const on = formData.amenities.includes(key);
                      return (
                        <button key={key} type="button" onClick={() => toggleAmenity(key)} aria-pressed={on}
                          className={`px-2 py-1 border text-[10px] flex items-center gap-1 cursor-pointer ${on ? 'bg-[#14213d] text-[#fbf9f4] border-[#14213d]' : 'bg-[#fbf9f4] text-[#4d4635] border-[#d1c5af] hover:border-[#14213d]'}`}>
                          <span className="material-symbols-outlined text-xs" aria-hidden="true">{AMENITIES[key].icon}</span>
                          {AMENITIES[key].label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </div>

              <div className="border-t border-[#d1c5af] pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={submitting}
                  className="px-4 py-2 border border-[#d1c5af] font-bold uppercase cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting}
                  className="px-6 py-2 bg-[#c9a227] hover:bg-[#b08b1a] text-[#14213d] font-bold uppercase border border-[#14213d] shadow-[2px_2px_0px_#14213d] cursor-pointer disabled:opacity-50">
                  {submitting ? 'Guardando…' : (editing ? 'Guardar cambios' : 'Crear tipo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast message={toast?.message} isOpen={!!toast} type={toast?.type} onClose={() => setToast(null)} />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar tipo de habitación"
        message={deleteTarget
          ? (deleteTarget.rooms_count > 0
            ? `El tipo "${deleteTarget.name}" tiene ${deleteTarget.rooms_count} habitación(es) asignada(s) y no podrá eliminarse. Reasígnelas o desactívelo.`
            : `¿Eliminar el tipo "${deleteTarget.name}"?`)
          : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
