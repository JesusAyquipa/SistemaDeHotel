import { useCallback, useEffect, useState } from 'react';
import StaffLayout from '../../components/StaffLayout';
import Toast from '../../components/Toast';
import StarRating from '../../components/reviews/StarRating';
import { getStaffReviews, publishReview, hideReview, replyReview } from '../../services/reviewService';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { apiErrorMessage } from '../../utils/apiError';
import { formatDmy } from '../../utils/dates';
import logError from '../../utils/logError';

const STATUS_META = {
  pending: { label: 'Pendiente', classes: 'bg-[#fff3e0] text-[#e65100] border-[#ff9800]' },
  published: { label: 'Publicada', classes: 'bg-[#e8f5e9] text-[#1b5e20] border-[#4caf50]' },
  hidden: { label: 'Oculta', classes: 'bg-[#eeeeee] text-[#757575] border-[#bdbdbd]' },
};

const STATUS_TABS = [
  { value: '', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'published', label: 'Publicadas' },
  { value: 'hidden', label: 'Ocultas' },
];

const labelClasses = 'block font-mono text-[10px] uppercase font-bold text-[#78716c] mb-1';
const inputClasses = 'w-full bg-[#fbf9f4] border border-[#d1c5af] px-3 py-2 text-sm focus:outline-none focus:border-[#c9a227]';

function ReplyEditor({ review, onSaved, onError }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(review.staff_reply || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await replyReview(review.id, text.trim());
      onSaved(res.review, res.message);
      setOpen(false);
    } catch (err) {
      onError(apiErrorMessage(err, 'No se pudo guardar la respuesta.'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setText(review.staff_reply || ''); setOpen(true); }}
        className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#14213d] text-[#14213d] font-mono text-[11px] uppercase font-bold hover:bg-[#eae8e3] cursor-pointer"
      >
        <span className="material-symbols-outlined text-sm" aria-hidden="true">reply</span>
        {review.staff_reply ? 'Editar respuesta' : 'Responder'}
      </button>
    );
  }

  return (
    <div className="w-full space-y-2">
      <label htmlFor={`reply-${review.id}`} className={labelClasses}>Respuesta del hotel (pública)</label>
      <textarea
        id={`reply-${review.id}`}
        rows={3}
        maxLength={1000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={inputClasses}
        placeholder="Gracias por tu visita…"
      />
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving} className="px-3 py-1.5 bg-[#14213d] text-white font-mono text-[11px] uppercase font-bold disabled:opacity-50 cursor-pointer">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 border border-[#d1c5af] font-mono text-[11px] uppercase cursor-pointer">
          Cancelar
        </button>
        <span className="ml-auto font-mono text-[10px] text-[#78716c] self-center">{text.length}/1000</span>
      </div>
    </div>
  );
}

/**
 * Moderación de reseñas (SHE-037) — solo administradores.
 */
export default function ReviewModeration() {
  const [filters, setFilters] = useState({ status: 'pending', rating: '', search: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ data: [], meta: null, counts: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });

  const search = useDebouncedValue(filters.search, 350);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getStaffReviews({ status: filters.status, rating: filters.rating, search, page, per_page: 10 });
      setData(res);
    } catch (err) {
      logError('reviews:list', err);
      setError(apiErrorMessage(err, 'No se pudieron cargar las reseñas.'));
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.rating, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const notify = (message, type = 'success') => setToast({ open: true, message, type });

  const replaceReview = (updated) => {
    setData((d) => ({ ...d, data: d.data.map((r) => (r.id === updated.id ? updated : r)) }));
  };

  const changeStatus = async (review, action) => {
    setBusyId(review.id);
    try {
      const res = action === 'publish' ? await publishReview(review.id) : await hideReview(review.id);
      notify(res.message);
      await load();
    } catch (err) {
      notify(apiErrorMessage(err, 'No se pudo actualizar la reseña.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const counts = data.counts || {};
  const meta = data.meta;

  return (
    <StaffLayout>
      <header className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4">
        <p className="text-[10px] font-mono tracking-widest text-[#78716c] uppercase font-bold mb-1">
          Experiencia del huésped · Administración
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2d2d2a] tracking-tight">Reseñas</h1>
        <p className="font-sans text-sm text-[#4d4635] mt-1">
          Revisa, publica u oculta las reseñas de los huéspedes y responde en nombre del hotel.
        </p>
      </header>

      <main className="px-4 sm:px-8 pb-8">
        <section aria-label="Filtros" className="bg-white p-4 mb-6 shadow-sm border border-[#e4e2dd] space-y-4">
          <div role="tablist" aria-label="Estado" className="flex flex-wrap gap-2">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value || 'all'}
                type="button"
                role="tab"
                aria-selected={filters.status === t.value}
                onClick={() => setFilter('status', t.value)}
                className={`px-3 py-1.5 font-mono text-[11px] uppercase font-bold border cursor-pointer ${filters.status === t.value ? 'bg-[#14213d] text-white border-[#14213d]' : 'bg-[#fbf9f4] text-[#4d4635] border-[#d1c5af] hover:bg-[#eae8e3]'}`}
              >
                {t.label}
                {t.value && <span className="ml-1 opacity-75">({counts[t.value] ?? 0})</span>}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4">
            <div>
              <label htmlFor="rv-rating" className={labelClasses}>Calificación</label>
              <select id="rv-rating" value={filters.rating} onChange={(e) => setFilter('rating', e.target.value)} className={inputClasses}>
                <option value="">Todas</option>
                {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} {r === 1 ? 'estrella' : 'estrellas'}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="rv-search" className={labelClasses}>Buscar</label>
              <input id="rv-search" type="search" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Comentario, huésped o código de reserva" className={inputClasses} />
            </div>
          </div>
        </section>

        {error && <div role="alert" className="bg-[#ffdad6] text-[#93000a] p-3 text-sm border border-[#ba1a1a]/30 mb-4">{error}</div>}

        {loading ? (
          <div className="space-y-4" aria-busy="true">
            {[1, 2, 3].map((i) => <div key={i} className="h-36 bg-[#eae8e3] animate-pulse border border-[#d1c5af]" />)}
          </div>
        ) : data.data.length === 0 ? (
          <div className="bg-white border border-[#e4e2dd] p-10 text-center">
            <span className="material-symbols-outlined text-5xl text-[#d1c5af]" aria-hidden="true">reviews</span>
            <p className="font-serif text-lg text-[#4d4635] mt-2">No hay reseñas con estos filtros.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {data.data.map((r) => {
              const status = STATUS_META[r.status] || STATUS_META.pending;
              return (
                <li key={r.id} className="bg-white border border-[#e4e2dd] shadow-sm p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StarRating value={r.rating} />
                        <span className={`px-2 py-0.5 text-[10px] uppercase font-mono font-bold border ${status.classes}`}>{status.label}</span>
                      </div>
                      <p className="font-mono text-[11px] text-[#78716c] mt-1 break-words">
                        {[r.guest?.name, r.guest?.surname].filter(Boolean).join(' ') || 'Huésped'}
                        {' · '}{r.room?.name || 'Habitación'}{r.room?.room_number ? ` (Hab. ${r.room.room_number})` : ''}
                        {' · '}{r.booking?.booking_code}
                        {' · '}{formatDmy(r.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {r.status !== 'published' && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => changeStatus(r, 'publish')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#3F6B4F] text-white font-mono text-[11px] uppercase font-bold disabled:opacity-50 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm" aria-hidden="true">visibility</span>
                          Publicar
                        </button>
                      )}
                      {r.status !== 'hidden' && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => changeStatus(r, 'hide')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#ba1a1a] text-[#ba1a1a] font-mono text-[11px] uppercase font-bold hover:bg-[#ffdad6] disabled:opacity-50 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm" aria-hidden="true">visibility_off</span>
                          Ocultar
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-[#1b1c19] whitespace-pre-line break-words">{r.comment}</p>
                  {r.staff_reply && (
                    <div className="mt-3 border-l-4 border-[#c9a227] bg-[#fbf9f4] px-3 py-2">
                      <p className="font-mono text-[10px] uppercase text-[#755b00] mb-1">Respuesta del hotel · {formatDmy(r.replied_at)}</p>
                      <p className="text-sm text-[#4d4635] whitespace-pre-line break-words">{r.staff_reply}</p>
                    </div>
                  )}
                  <div className="mt-3">
                    <ReplyEditor
                      key={`${r.id}-${r.staff_reply || ''}`}
                      review={r}
                      onSaved={(updated, msg) => { replaceReview(updated); notify(msg); }}
                      onError={(msg) => notify(msg, 'error')}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {meta && meta.last_page > 1 && (
          <nav aria-label="Paginación" className="flex items-center justify-between mt-6">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-[#d1c5af] bg-white font-mono text-xs uppercase disabled:opacity-40 cursor-pointer">
              Anterior
            </button>
            <span className="font-mono text-xs text-[#4d4635]">Página {meta.current_page} de {meta.last_page} · {meta.total} reseñas</span>
            <button type="button" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-[#d1c5af] bg-white font-mono text-xs uppercase disabled:opacity-40 cursor-pointer">
              Siguiente
            </button>
          </nav>
        )}
      </main>

      <Toast isOpen={toast.open} message={toast.message} type={toast.type} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </StaffLayout>
  );
}
