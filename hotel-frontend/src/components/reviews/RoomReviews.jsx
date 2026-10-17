import { useEffect, useState } from 'react';
import StarRating from './StarRating';
import { getRoomReviews } from '../../services/reviewService';
import { formatDmy } from '../../utils/dates';
import logError from '../../utils/logError';

/**
 * Resumen de calificaciones + últimas reseñas publicadas de una habitación (SHE-037).
 */
export default function RoomReviews({ roomId }) {
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    getRoomReviews(roomId, { page, perPage: 5, signal: controller.signal })
      .then((res) => {
        setSummary(res.summary);
        setMeta(res.meta);
        setReviews((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        logError('room-detail:reviews', err);
        setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [roomId, page]);

  const count = summary?.count ?? 0;

  return (
    <section aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="font-serif text-xl font-bold text-[#1b1c19] mb-4 border-b border-[#d1c5af] pb-2 flex items-center justify-between gap-3 flex-wrap">
        <span>Reseñas de huéspedes</span>
        {count > 0 && (
          <span className="flex items-center gap-2 text-base">
            <StarRating value={summary.average} label="Calificación promedio" />
            <span className="font-mono text-sm text-[#14213d]">{Number(summary.average).toFixed(1)}</span>
            <span className="font-mono text-xs text-[#4d4635] font-normal">({count})</span>
          </span>
        )}
      </h2>

      {failed && <p className="text-sm text-[#4d4635]">No se pudieron cargar las reseñas.</p>}

      {!failed && !loading && count === 0 && (
        <p className="text-sm text-[#4d4635] bg-[#f5f3ee] border border-[#d1c5af] p-4">
          Esta habitación aún no tiene reseñas publicadas.
        </p>
      )}

      {count > 0 && summary?.distribution && (
        <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 mb-5 max-w-sm">
          {[5, 4, 3, 2, 1].map((r) => {
            const n = Number(summary.distribution[r] || 0);
            const pct = count > 0 ? Math.round((n / count) * 100) : 0;
            return (
              <div key={r} className="contents">
                <dt className="font-mono text-xs text-[#4d4635]">{r} ★</dt>
                <dd className="h-2 bg-[#eae8e3] border border-[#d1c5af]" aria-label={`${n} reseñas de ${r} estrellas`}>
                  <div className="h-full bg-[#c9a227]" style={{ width: `${pct}%` }} />
                </dd>
                <dd className="font-mono text-[11px] text-[#4d4635] text-right">{n}</dd>
              </div>
            );
          })}
        </dl>
      )}

      <ul className="space-y-4">
        {reviews.map((r) => (
          <li key={r.id} className="bg-[#f5f3ee] border border-[#d1c5af] p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <span className="font-serif font-bold text-sm text-[#14213d]">{r.author}</span>
              <span className="flex items-center gap-2">
                <StarRating value={r.rating} size="text-sm" />
                <span className="font-mono text-[10px] text-[#4d4635]">{formatDmy(r.date)}</span>
              </span>
            </div>
            <p className="text-sm text-[#1b1c19] whitespace-pre-line break-words">{r.comment}</p>
            {r.staff_reply && (
              <div className="mt-3 border-l-4 border-[#c9a227] bg-white px-3 py-2">
                <p className="font-mono text-[10px] uppercase text-[#755b00] mb-1">Respuesta del hotel</p>
                <p className="text-sm text-[#4d4635] whitespace-pre-line break-words">{r.staff_reply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>

      {loading && <div className="h-20 mt-4 bg-[#eae8e3] animate-pulse border border-[#d1c5af]" aria-busy="true" />}

      {!loading && meta && meta.current_page < meta.last_page && (
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="mt-4 px-4 py-2 border border-[#14213d] text-[#14213d] font-mono text-xs uppercase font-bold hover:bg-[#eae8e3] cursor-pointer"
        >
          Ver más reseñas
        </button>
      )}
    </section>
  );
}
