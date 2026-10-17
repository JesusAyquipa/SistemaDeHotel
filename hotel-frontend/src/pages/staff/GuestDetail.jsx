import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StaffLayout from '../../components/StaffLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import Toast from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { getGuest, updateGuest, deleteGuest } from '../../services/guestService';
import formatCurrency from '../../utils/formatCurrency';
import { bookingStatusBadge, bookingStatusLabel } from '../../utils/bookingStatus';
import { apiErrorMessage, apiStatus } from '../../utils/apiError';
import { formatDmy, nightsBetween } from '../../utils/dates';
import logError from '../../utils/logError';
import GuestFlags from '../../components/staff/GuestFlags';

const EDITABLE_FIELDS = [
  'name', 'surname', 'document_type', 'document_number', 'birth_date',
  'nationality', 'phone', 'email', 'address', 'notes',
];

const DOCUMENT_TYPES = ['DNI', 'Pasaporte', 'Carné de Extranjería', 'CE'];

function toForm(guest) {
  const form = {};
  EDITABLE_FIELDS.forEach((f) => {
    const v = guest?.[f];
    form[f] = v == null ? '' : (f === 'birth_date' ? String(v).substring(0, 10) : String(v));
  });
  // SHE-033: VIP, preferencias y lista negra
  form.is_vip = !!guest?.is_vip;
  form.preferences = Array.isArray(guest?.preferences) ? guest.preferences : [];
  form.is_blacklisted = !!guest?.is_blacklisted;
  form.blacklist_reason = guest?.blacklist_reason || '';
  return form;
}

const MAX_PREFERENCES = 30;

function StatCard({ icon, label, value, hint }) {
  return (
    <div className="bg-white border border-[#d1c5af] p-4 shadow-sm">
      <p className="font-mono text-[10px] uppercase tracking-widest text-[#4d4635] font-bold flex items-center gap-1.5">
        <span className="material-symbols-outlined text-base text-[#755b00]" aria-hidden="true">{icon}</span>
        {label}
      </p>
      <p className="font-serif text-2xl font-bold text-[#14213d] mt-2">{value}</p>
      {hint && <p className="font-mono text-[11px] text-[#4d4635] mt-1">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2 py-0.5 border text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap ${bookingStatusBadge(status)}`}>
      {bookingStatusLabel(status)}
    </span>
  );
}

/**
 * Ficha del huésped: datos editables, estadísticas e historial de estadías (SHE-024 / SHE-025).
 */
export default function GuestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin');
  const basePath = isAdmin ? '/admin' : '/recepcionista';
  const uid = useId();
  const fid = (name) => `${uid}-${name}`;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [form, setForm] = useState(toForm(null));
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setNotFound(false);
    getGuest(id, { signal: controller.signal })
      .then((res) => {
        setData(res);
        setForm(toForm(res.guest));
        setDirty(false);
        setFieldErrors({});
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (apiStatus(err) === 404) {
          setNotFound(true);
        } else {
          logError('guests:show', err);
          setError(apiErrorMessage(err, 'No se pudo cargar la ficha del huésped.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, reloadKey]);

  const [prefInput, setPrefInput] = useState('');

  const setExtra = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setFieldErrors((fe) => ({ ...fe, [name]: undefined }));
    setDirty(true);
  };

  const addPreference = () => {
    const value = prefInput.trim().substring(0, 100);
    if (!value) return;
    if (!form.preferences.includes(value) && form.preferences.length < MAX_PREFERENCES) {
      setExtra('preferences', [...form.preferences, value]);
    }
    setPrefInput('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setFieldErrors((fe) => ({ ...fe, [name]: undefined }));
    setDirty(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});
    const payload = {};
    EDITABLE_FIELDS.forEach((f) => {
      const v = typeof form[f] === 'string' ? form[f].trim() : form[f];
      payload[f] = v === '' ? null : v;
    });
    payload.is_vip = !!form.is_vip;
    payload.preferences = form.preferences;
    // Los campos de lista negra solo los envía (y acepta) el administrador
    if (isAdmin) {
      payload.is_blacklisted = !!form.is_blacklisted;
      payload.blacklist_reason = form.is_blacklisted ? (form.blacklist_reason.trim() || null) : null;
    }
    try {
      const res = await updateGuest(id, payload);
      setData((d) => ({ ...d, guest: res.data }));
      setForm(toForm(res.data));
      setDirty(false);
      setToast({ open: true, message: res.message || 'Datos actualizados.', type: 'success' });
    } catch (err) {
      logError('guests:update', err);
      const errors = err?.response?.data?.errors;
      if (apiStatus(err) === 422 && errors) {
        const mapped = {};
        Object.entries(errors).forEach(([k, v]) => { mapped[k] = Array.isArray(v) ? v[0] : String(v); });
        setFieldErrors(mapped);
      }
      setToast({ open: true, message: apiErrorMessage(err, 'No se pudieron guardar los cambios.'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteGuest(id);
      navigate(`${basePath}/huespedes`, { replace: true });
    } catch (err) {
      logError('guests:delete', err);
      setToast({ open: true, message: apiErrorMessage(err, 'No se pudo eliminar el huésped.'), type: 'error' });
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const inputClass = (name) =>
    `w-full bg-white border p-2 text-sm focus:outline-none ${fieldErrors[name] ? 'border-[#ba1a1a]' : 'border-[#d1c5af] focus:border-[#14213d]'}`;

  const field = (name, label, props = {}) => (
    <div className={props.wide ? 'sm:col-span-2' : undefined}>
      <label htmlFor={fid(name)} className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
        {label}{props.required ? ' *' : ''}
      </label>
      <input
        id={fid(name)}
        name={name}
        type={props.type || 'text'}
        value={form[name]}
        onChange={handleChange}
        required={props.required}
        maxLength={props.maxLength}
        autoComplete={props.autoComplete}
        aria-invalid={!!fieldErrors[name]}
        aria-describedby={fieldErrors[name] ? fid(`${name}-err`) : undefined}
        className={inputClass(name)}
      />
      {fieldErrors[name] && (
        <p id={fid(`${name}-err`)} className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors[name]}</p>
      )}
    </div>
  );

  const backLink = (
    <Link
      to={`${basePath}/huespedes`}
      className="inline-flex items-center gap-1 font-mono text-xs text-[#4d4635] hover:text-[#755b00]"
    >
      <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_back</span>
      Volver al listado
    </Link>
  );

  let content;
  if (loading && !data) {
    content = (
      <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Cargando ficha del huésped">
        <div className="h-8 w-1/2 bg-[#e4e2dd]" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-[#e4e2dd]" />)}
        </div>
        <div className="h-72 bg-[#e4e2dd]" />
      </div>
    );
  } else if (notFound) {
    content = (
      <div className="text-center py-16">
        <span className="material-symbols-outlined text-5xl text-[#c9a227]" aria-hidden="true">person_off</span>
        <h1 className="font-serif text-2xl font-bold text-[#14213d] mt-3">Huésped no encontrado</h1>
        <p className="text-sm text-[#4d4635] mt-2">La ficha solicitada no existe o fue eliminada.</p>
        <div className="mt-6">{backLink}</div>
      </div>
    );
  } else if (error) {
    content = (
      <div role="alert" className="bg-[#ffdad6] text-[#93000a] p-4 text-sm font-mono border border-[#ba1a1a]/30 flex items-center justify-between gap-4">
        <span>{error}</span>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="underline font-bold cursor-pointer">Reintentar</button>
      </div>
    );
  } else if (data) {
    const { guest, stats, bookings = [], upcoming_bookings: upcoming = [] } = data;
    const canDelete = isAdmin && bookings.length === 0;

    content = (
      <div className="space-y-8">
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#d1c5af] pb-4">
          <div>
            {backLink}
            <h1 className="font-serif text-3xl font-bold text-[#755b00] tracking-tight mt-2">
              {guest.name} {guest.surname} <GuestFlags guest={guest} />
            </h1>
            <p className="font-mono text-xs text-[#4d4635] mt-1">
              {guest.document_type} {guest.document_number} · Registrado el {formatDmy(guest.created_at)}
              {guest.user_id ? ' · Con cuenta web' : ''}
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={!canDelete}
              title={canDelete ? 'Eliminar huésped' : 'No se puede eliminar: el huésped tiene reservas registradas'}
              className="inline-flex items-center gap-2 border border-[#ba1a1a] text-[#ba1a1a] px-4 py-2 font-mono text-xs uppercase tracking-wider font-bold hover:bg-[#ffdad6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">delete</span>
              Eliminar
            </button>
          )}
        </div>

        {guest.is_blacklisted && (
          <div role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/50 p-4 text-[#93000a] text-sm flex items-start gap-2">
            <span className="material-symbols-outlined" aria-hidden="true">block</span>
            <div>
              <p className="font-bold">Huésped en lista negra</p>
              <p>{guest.blacklist_reason || 'Sin motivo registrado.'} Las nuevas reservas de este huésped serán rechazadas.</p>
            </div>
          </div>
        )}

        {/* Estadísticas */}
        <section aria-label="Estadísticas del huésped" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="hotel" label="Estadías completadas" value={stats.total_stays} hint={`${stats.total_bookings} reservas en total`} />
          <StatCard icon="payments" label="Total gastado" value={formatCurrency(stats.total_spent)} hint="Pagos completados, neto de reembolsos" />
          <StatCard
            icon="history"
            label="Última estadía"
            value={stats.last_stay ? formatDmy(stats.last_stay.check_out) : '—'}
            hint={stats.last_stay?.room ? `Hab. ${stats.last_stay.room.room_number}` : 'Sin estadías completadas'}
          />
          <StatCard icon="event_upcoming" label="Próximas reservas" value={stats.upcoming_count} hint={stats.cancelled ? `${stats.cancelled} canceladas` : undefined} />
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
          {/* Formulario de perfil */}
          <section aria-labelledby={fid('profile-title')} className="xl:col-span-2 bg-[#f5f3ee] border border-[#d1c5af] p-5">
            <h2 id={fid('profile-title')} className="font-serif text-xl font-bold text-[#14213d] mb-4">Datos del huésped</h2>
            <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('name', 'Nombres', { required: true, maxLength: 255, autoComplete: 'off' })}
              {field('surname', 'Apellidos', { required: true, maxLength: 255, autoComplete: 'off' })}
              <div>
                <label htmlFor={fid('document_type')} className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">Tipo de documento *</label>
                <select
                  id={fid('document_type')}
                  name="document_type"
                  value={form.document_type}
                  onChange={handleChange}
                  className={`${inputClass('document_type')} cursor-pointer`}
                >
                  {[...new Set([...DOCUMENT_TYPES, form.document_type].filter(Boolean))].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {fieldErrors.document_type && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.document_type}</p>}
              </div>
              {field('document_number', 'N° documento', { required: true, maxLength: 50 })}
              {field('email', 'Correo electrónico', { required: true, type: 'email', maxLength: 255, wide: true })}
              {field('phone', 'Teléfono', { type: 'tel', maxLength: 20 })}
              {field('birth_date', 'Fecha de nacimiento', { type: 'date' })}
              {field('nationality', 'Nacionalidad', { maxLength: 100 })}
              {field('address', 'Dirección', { maxLength: 255 })}
              <div className="sm:col-span-2">
                <label htmlFor={fid('notes')} className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">Notas internas</label>
                <textarea
                  id={fid('notes')}
                  name="notes"
                  rows={3}
                  maxLength={2000}
                  value={form.notes}
                  onChange={handleChange}
                  aria-invalid={!!fieldErrors.notes}
                  className={`${inputClass('notes')} resize-none`}
                />
                {fieldErrors.notes && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.notes}</p>}
              </div>
              {/* SHE-033: VIP y preferencias */}
              <div className="sm:col-span-2 border-t border-[#d1c5af] pt-4 space-y-3">
                <label className="inline-flex items-center gap-2 text-sm text-[#14213d] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_vip}
                    onChange={(e) => setExtra('is_vip', e.target.checked)}
                    className="w-4 h-4 accent-[#c9a227]"
                  />
                  <span className="font-semibold">Huésped VIP</span>
                </label>
                <div>
                  <label htmlFor={fid('pref')} className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">Preferencias</label>
                  <div className="flex gap-2">
                    <input
                      id={fid('pref')}
                      type="text"
                      value={prefInput}
                      maxLength={100}
                      onChange={(e) => setPrefInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPreference(); } }}
                      placeholder="Ej. Almohada firme, piso alto..."
                      className={inputClass('preferences')}
                    />
                    <button
                      type="button"
                      onClick={addPreference}
                      disabled={!prefInput.trim() || form.preferences.length >= MAX_PREFERENCES}
                      className="px-3 border border-[#d1c5af] hover:border-[#14213d] font-mono text-xs uppercase font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Añadir
                    </button>
                  </div>
                  {fieldErrors.preferences && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.preferences}</p>}
                  {form.preferences.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5 mt-2" aria-label="Preferencias registradas">
                      {form.preferences.map((p) => (
                        <li key={p} className="inline-flex items-center gap-1 bg-white border border-[#d1c5af] px-2 py-0.5 text-xs">
                          {p}
                          <button
                            type="button"
                            onClick={() => setExtra('preferences', form.preferences.filter((x) => x !== p))}
                            className="text-[#4d4635] hover:text-[#ba1a1a] cursor-pointer"
                            aria-label={`Quitar preferencia ${p}`}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* SHE-033: lista negra (solo administrador) */}
              {isAdmin && (
                <div className="sm:col-span-2 border border-[#ba1a1a]/30 bg-[#fff5f4] p-3 space-y-2">
                  <label className="inline-flex items-center gap-2 text-sm text-[#93000a] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_blacklisted}
                      onChange={(e) => setExtra('is_blacklisted', e.target.checked)}
                      className="w-4 h-4 accent-[#ba1a1a]"
                    />
                    <span className="font-semibold">Incluir en lista negra</span>
                  </label>
                  {form.is_blacklisted && (
                    <div>
                      <label htmlFor={fid('blacklist_reason')} className="block font-mono text-[11px] uppercase font-bold text-[#93000a] mb-1">Motivo *</label>
                      <textarea
                        id={fid('blacklist_reason')}
                        rows={2}
                        maxLength={500}
                        value={form.blacklist_reason}
                        onChange={(e) => setExtra('blacklist_reason', e.target.value)}
                        aria-invalid={!!fieldErrors.blacklist_reason}
                        className={`${inputClass('blacklist_reason')} resize-none`}
                      />
                      {fieldErrors.blacklist_reason && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.blacklist_reason}</p>}
                    </div>
                  )}
                </div>
              )}

              <div className="sm:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={!dirty || saving}
                  onClick={() => { setForm(toForm(guest)); setFieldErrors({}); setDirty(false); }}
                  className="px-4 py-2 border border-[#d1c5af] hover:border-[#14213d] text-[#14213d] font-mono text-xs uppercase font-bold tracking-wider disabled:opacity-40 cursor-pointer"
                >
                  Descartar
                </button>
                <button
                  type="submit"
                  disabled={!dirty || saving}
                  className="px-5 py-2 bg-[#14213d] hover:bg-[#0a1628] text-[#fbf9f4] border border-[#c9a227] font-mono text-xs uppercase font-bold tracking-wider disabled:opacity-40 cursor-pointer"
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </section>

          {/* Historial */}
          <div className="xl:col-span-3 space-y-6">
            {upcoming.length > 0 && (
              <section aria-labelledby={fid('upcoming-title')}>
                <h2 id={fid('upcoming-title')} className="font-serif text-xl font-bold text-[#14213d] mb-3">Próximas reservas</h2>
                <ul className="space-y-2">
                  {upcoming.map((b) => (
                    <li key={b.id} className="bg-white border border-[#d1c5af] border-l-4 border-l-[#c9a227] p-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs font-bold text-[#14213d]">{b.booking_code}</p>
                        <p className="text-sm text-[#4d4635]">
                          {formatDmy(b.check_in)} → {formatDmy(b.check_out)}
                          {b.room ? ` · Hab. ${b.room.room_number}` : ''}
                        </p>
                      </div>
                      <StatusBadge status={b.status} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby={fid('history-title')}>
              <h2 id={fid('history-title')} className="font-serif text-xl font-bold text-[#14213d] mb-3">Historial de estadías</h2>
              <div className="overflow-x-auto border border-[#d1c5af] bg-white">
                <table className="w-full min-w-[620px] text-left border-collapse">
                  <caption className="sr-only">Historial de reservas del huésped</caption>
                  <thead>
                    <tr className="bg-[#f0eee9] text-[#4d4635] font-mono text-[11px] uppercase tracking-widest border-b border-[#d1c5af]">
                      <th scope="col" className="p-3 font-bold">Código</th>
                      <th scope="col" className="p-3 font-bold">Habitación</th>
                      <th scope="col" className="p-3 font-bold">Fechas</th>
                      <th scope="col" className="p-3 font-bold text-right">Total</th>
                      <th scope="col" className="p-3 font-bold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {bookings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center font-mono text-xs text-[#755b00]">
                          Este huésped aún no tiene reservas registradas.
                        </td>
                      </tr>
                    ) : bookings.map((b) => {
                      const n = nightsBetween(b.check_in, b.check_out);
                      return (
                        <tr key={b.id} className="border-b border-[#e4e2dd] hover:bg-[#f5f3ee]">
                          <td className="p-3 font-mono text-xs font-bold">{b.booking_code}</td>
                          <td className="p-3">
                            {b.room ? (
                              <>
                                <span className="font-semibold">Hab. {b.room.room_number}</span>
                                <span className="block text-[11px] text-[#4d4635]">{b.room.name}</span>
                              </>
                            ) : '—'}
                          </td>
                          <td className="p-3 font-mono text-xs whitespace-nowrap">
                            {formatDmy(b.check_in)} → {formatDmy(b.check_out)}
                            <span className="block text-[10px] text-[#4d4635]">{n} {n === 1 ? 'noche' : 'noches'}</span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold whitespace-nowrap">{formatCurrency(b.total_amount)}</td>
                          <td className="p-3"><StatusBadge status={b.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <StaffLayout>
      <Toast
        isOpen={toast.open}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
      <main className="p-4 md:p-10">
        <div className="bg-[#fbf9f4] border border-[#d1c5af] shadow-sm p-4 md:p-8">
          {content}
        </div>
      </main>
      <ConfirmDialog
        isOpen={confirmDelete}
        title="Eliminar huésped"
        message="¿Eliminar definitivamente la ficha de este huésped? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </StaffLayout>
  );
}
