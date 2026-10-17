import { useEffect, useState } from 'react';
import { getCancellationPolicy, updateCancellationPolicy } from '../../services/billingService';
import { DEFAULT_CANCELLATION_POLICY, policyLines } from '../../utils/cancellationPolicy';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';

const FIELDS = [
  { key: 'free_cancellation_hours', label: 'Cancelación gratuita (horas antes de la llegada)', min: 0, max: 720, suffix: 'h' },
  { key: 'late_cancellation_penalty_nights', label: 'Penalidad por cancelación tardía', min: 0, max: 30, suffix: 'noches' },
  { key: 'no_show_penalty_nights', label: 'Penalidad por no-show', min: 0, max: 30, suffix: 'noches' },
  { key: 'no_show_grace_hours', label: 'Gracia para no-show (después de las 12:00 del día siguiente)', min: 0, max: 48, suffix: 'h' },
];

/**
 * Política de cancelación y no-show (SHE-028). Edición solo para administradores.
 * Props: canEdit, onNotify(message, type)
 */
export default function CancellationPolicySettings({ canEdit = false, onNotify }) {
  const [policy, setPolicy] = useState(DEFAULT_CANCELLATION_POLICY);
  const [form, setForm] = useState(DEFAULT_CANCELLATION_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let active = true;
    getCancellationPolicy()
      .then((data) => {
        if (!active) return;
        setPolicy(data);
        setForm(data);
      })
      .catch((err) => logError('settings:policy', err))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const dirty = FIELDS.some((f) => Number(form[f.key]) !== Number(policy[f.key]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    FIELDS.forEach((f) => {
      const raw = form[f.key];
      const v = Number(raw);
      if (raw === '' || !Number.isInteger(v) || v < f.min || v > f.max) {
        nextErrors[f.key] = `Debe ser un número entero entre ${f.min} y ${f.max}.`;
      }
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const payload = Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key])]));
      const saved = await updateCancellationPolicy(payload);
      setPolicy(saved);
      setForm(saved);
      onNotify?.('Política de cancelación actualizada');
    } catch (err) {
      logError('settings:policy:update', err);
      onNotify?.(apiErrorMessage(err, 'No se pudo guardar la política.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#fcfcfc] border-l-4 border-l-[#ba1a1a] shadow-sm rounded-r-md p-6 relative">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#ba1a1a]" aria-hidden="true">event_busy</span>
          <h2 className="font-serif text-xl font-bold text-[#2d2d2a]">Política de Cancelación y No-Show</h2>
        </div>
        {loading && <span className="font-mono text-[10px] text-[#78716c] animate-pulse" role="status">Cargando...</span>}
      </div>

      <ul className="mb-6 space-y-1 font-sans text-sm text-[#4d4635] list-disc pl-5">
        {policyLines(policy).map((line) => <li key={line}>{line}</li>)}
      </ul>

      {canEdit && (
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label htmlFor={`policy-${f.key}`} className="block font-mono text-[10px] uppercase font-bold text-[#78716c] mb-1">{f.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    id={`policy-${f.key}`}
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={1}
                    value={form[f.key]}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, [f.key]: e.target.value }));
                      setErrors((prev) => ({ ...prev, [f.key]: undefined }));
                    }}
                    aria-invalid={!!errors[f.key]}
                    className="w-28 bg-white border border-[#d1c5af] px-2 py-1.5 text-sm font-mono focus:border-[#14213d] focus:outline-none"
                  />
                  <span className="font-mono text-xs text-[#78716c]">{f.suffix}</span>
                </div>
                {errors[f.key] && <p className="mt-1 font-mono text-[11px] text-[#93000a]">{errors[f.key]}</p>}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => { setForm(policy); setErrors({}); }}
              disabled={!dirty || saving}
              className="px-4 py-1.5 border border-[#d1c5af] text-[#4d4635] font-mono text-[10px] uppercase font-bold tracking-widest disabled:opacity-40"
            >
              Descartar
            </button>
            <button
              type="submit"
              disabled={!dirty || saving}
              className="px-4 py-1.5 bg-[#14213d] text-[#fbf9f4] border border-[#c9a227] font-mono text-[10px] uppercase font-bold tracking-widest disabled:opacity-40"
            >
              {saving ? 'Guardando...' : 'Guardar política'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
