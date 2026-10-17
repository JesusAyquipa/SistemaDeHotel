import { useEffect, useState } from 'react';
import { getPreCheckIn, savePreCheckIn } from '../../services/guestPortalService';
import { apiErrorMessage } from '../../utils/apiError';
import { formatDmy } from '../../utils/dates';
import logError from '../../utils/logError';

const DOC_TYPES = [
  { value: 'DNI', label: 'DNI' },
  { value: 'CE', label: 'Carné de extranjería' },
  { value: 'PAS', label: 'Pasaporte' },
  { value: 'OTRO', label: 'Otro' },
];

const EMPTY_COMPANION = { name: '', surname: '', document_type: 'DNI', document_number: '' };

const inputCls = 'w-full bg-white border border-[#d1c5af] px-3 py-2 text-sm text-[#1b1c19] focus:outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]';
const labelCls = 'font-mono text-[10px] uppercase tracking-wider text-[#4d4635] block mb-1';

function FieldError({ errors, name }) {
  const msg = errors?.[name]?.[0];
  return msg ? <p className="text-[11px] text-[#ba1a1a] mt-1">{msg}</p> : null;
}

/**
 * Formulario de pre check-in online (SHE-036). Se precarga con la ficha del huésped
 * y los acompañantes de la reserva; editable hasta el día de llegada.
 */
export default function PreCheckInForm({ bookingCode, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [windowInfo, setWindowInfo] = useState(null);
  const [capacity, setCapacity] = useState(0);
  const [existing, setExisting] = useState(null);
  const [form, setForm] = useState({
    arrival_time: '',
    document_type: 'DNI',
    document_number: '',
    nationality: '',
    address: '',
    special_requests: '',
    companions: [],
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPreCheckIn(bookingCode)
      .then((data) => {
        if (!active) return;
        setWindowInfo(data.window);
        setCapacity(Number(data.capacity) || 0);
        setExisting(data.pre_check_in);
        const src = data.pre_check_in || data.prefill || {};
        setForm({
          arrival_time: data.pre_check_in?.arrival_time || '',
          document_type: src.document_type || 'DNI',
          document_number: src.document_number || '',
          nationality: src.nationality || '',
          address: src.address || '',
          special_requests: data.pre_check_in?.special_requests || '',
          companions: (src.companions || []).map((c) => ({
            name: c.name || '',
            surname: c.surname || '',
            document_type: c.document_type || 'DNI',
            document_number: c.document_number || '',
          })),
        });
      })
      .catch((err) => {
        if (!active) return;
        logError('portal:pre-check-in:load', err);
        setLoadError(apiErrorMessage(err, 'No se pudo cargar el pre check-in.'));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [bookingCode]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const setCompanion = (idx, field, value) => {
    setForm((f) => ({
      ...f,
      companions: f.companions.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    }));
  };

  const maxCompanions = capacity > 0 ? capacity - 1 : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setMessage('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        arrival_time: form.arrival_time || null,
        nationality: form.nationality || null,
        address: form.address || null,
        special_requests: form.special_requests || null,
      };
      const res = await savePreCheckIn(bookingCode, payload);
      setExisting(res.pre_check_in);
      setMessage(res.message || 'Pre check-in guardado.');
      onSaved?.(res.pre_check_in);
    } catch (err) {
      setErrors(err?.response?.data?.errors || {});
      setMessage('');
      setLoadError(apiErrorMessage(err, 'No se pudo guardar el pre check-in.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-40 bg-[#eae8e3] animate-pulse border border-[#d1c5af]" aria-busy="true" />;
  }

  if (windowInfo && !windowInfo.open) {
    return (
      <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4 text-sm text-[#4d4635] flex gap-3">
        <span className="material-symbols-outlined text-[#755b00]" aria-hidden="true">schedule</span>
        <div>
          <p>{windowInfo.reason}</p>
          {existing && (
            <p className="mt-2 font-mono text-xs text-[#3F6B4F]">
              Pre check-in enviado el {formatDmy(existing.submitted_at)}.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {existing && (
        <p className="bg-[#e8f5e9] border border-[#4caf50] text-[#1b5e20] text-xs font-mono px-3 py-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">check_circle</span>
          Ya enviaste tu pre check-in ({formatDmy(existing.submitted_at)}). Puedes actualizarlo hasta tu llegada.
        </p>
      )}
      {loadError && !message && (
        <p role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/40 text-[#93000a] text-xs px-3 py-2">{loadError}</p>
      )}
      {message && (
        <p role="status" className="bg-[#e8f5e9] border border-[#4caf50] text-[#1b5e20] text-xs px-3 py-2">{message}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pc-arrival" className={labelCls}>Hora estimada de llegada</label>
          <input id="pc-arrival" type="time" value={form.arrival_time} onChange={set('arrival_time')} className={inputCls} />
          <FieldError errors={errors} name="arrival_time" />
        </div>
        <div>
          <label htmlFor="pc-nationality" className={labelCls}>Nacionalidad</label>
          <input id="pc-nationality" type="text" maxLength={100} value={form.nationality} onChange={set('nationality')} className={inputCls} />
          <FieldError errors={errors} name="nationality" />
        </div>
        <div>
          <label htmlFor="pc-doctype" className={labelCls}>Tipo de documento *</label>
          <select id="pc-doctype" value={form.document_type} onChange={set('document_type')} className={inputCls}>
            {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <FieldError errors={errors} name="document_type" />
        </div>
        <div>
          <label htmlFor="pc-docnum" className={labelCls}>Número de documento *</label>
          <input id="pc-docnum" type="text" required maxLength={50} value={form.document_number} onChange={set('document_number')} className={inputCls} />
          <FieldError errors={errors} name="document_number" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="pc-address" className={labelCls}>Dirección</label>
          <input id="pc-address" type="text" maxLength={255} value={form.address} onChange={set('address')} className={inputCls} />
          <FieldError errors={errors} name="address" />
        </div>
      </div>

      <fieldset className="border border-[#d1c5af] p-4">
        <legend className="font-mono text-[10px] uppercase tracking-wider text-[#755b00] px-1">
          Acompañantes ({form.companions.length}/{maxCompanions})
        </legend>
        {form.companions.length === 0 && (
          <p className="text-xs text-[#4d4635]">Sin acompañantes registrados.</p>
        )}
        <div className="space-y-4">
          {form.companions.map((c, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_110px_1fr_auto] gap-2 items-start">
              <div>
                <label className="sr-only" htmlFor={`pc-c${idx}-name`}>Nombre</label>
                <input id={`pc-c${idx}-name`} placeholder="Nombre" value={c.name} onChange={(e) => setCompanion(idx, 'name', e.target.value)} className={inputCls} />
                <FieldError errors={errors} name={`companions.${idx}.name`} />
              </div>
              <div>
                <label className="sr-only" htmlFor={`pc-c${idx}-surname`}>Apellidos</label>
                <input id={`pc-c${idx}-surname`} placeholder="Apellidos" value={c.surname} onChange={(e) => setCompanion(idx, 'surname', e.target.value)} className={inputCls} />
                <FieldError errors={errors} name={`companions.${idx}.surname`} />
              </div>
              <div>
                <label className="sr-only" htmlFor={`pc-c${idx}-doctype`}>Tipo de documento</label>
                <select id={`pc-c${idx}-doctype`} value={c.document_type} onChange={(e) => setCompanion(idx, 'document_type', e.target.value)} className={inputCls}>
                  {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.value}</option>)}
                </select>
              </div>
              <div>
                <label className="sr-only" htmlFor={`pc-c${idx}-docnum`}>Número de documento</label>
                <input id={`pc-c${idx}-docnum`} placeholder="N° documento" value={c.document_number} onChange={(e) => setCompanion(idx, 'document_number', e.target.value)} className={inputCls} />
                <FieldError errors={errors} name={`companions.${idx}.document_number`} />
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, companions: f.companions.filter((_, i) => i !== idx) }))}
                className="text-[#ba1a1a] hover:bg-[#ffdad6] p-2 cursor-pointer"
                aria-label={`Quitar acompañante ${idx + 1}`}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>
              </button>
            </div>
          ))}
        </div>
        <FieldError errors={errors} name="companions" />
        {form.companions.length < maxCompanions && (
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, companions: [...f.companions, { ...EMPTY_COMPANION }] }))}
            className="mt-3 font-mono text-xs uppercase font-bold text-[#14213d] border border-[#a68a4d] px-3 py-1.5 hover:bg-[#c9a227] hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">person_add</span>
            Agregar acompañante
          </button>
        )}
      </fieldset>

      <div>
        <label htmlFor="pc-requests" className={labelCls}>Solicitudes especiales</label>
        <textarea id="pc-requests" rows={3} maxLength={1000} value={form.special_requests} onChange={set('special_requests')} className={inputCls} placeholder="Cuna, piso alto, dieta especial…" />
        <FieldError errors={errors} name="special_requests" />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full sm:w-auto px-6 py-2.5 bg-[#14213d] text-white font-mono text-xs uppercase font-bold tracking-wider hover:bg-[#c9a227] hover:text-[#14213d] transition-colors disabled:opacity-60 cursor-pointer"
      >
        {saving ? 'Guardando…' : existing ? 'Actualizar pre check-in' : 'Enviar pre check-in'}
      </button>
    </form>
  );
}
