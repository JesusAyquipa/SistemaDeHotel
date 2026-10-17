import { useState } from 'react';
import StarRating from '../reviews/StarRating';
import { submitReview } from '../../services/guestPortalService';
import { apiErrorMessage } from '../../utils/apiError';

const REVIEW_STATUS = {
  pending: { label: 'En revisión', cls: 'bg-[#fff3e0] text-[#e65100] border-[#ff9800]' },
  published: { label: 'Publicada', cls: 'bg-[#e8f5e9] text-[#1b5e20] border-[#4caf50]' },
  hidden: { label: 'No publicada', cls: 'bg-[#eeeeee] text-[#757575] border-[#bdbdbd]' },
};

/**
 * Reseña del huésped (SHE-037): formulario si aún no existe; si existe, la muestra.
 */
export default function ReviewForm({ bookingCode, review, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  if (review) {
    const meta = REVIEW_STATUS[review.status] || REVIEW_STATUS.pending;
    return (
      <div className="bg-[#f5f3ee] border border-[#d1c5af] p-4 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <StarRating value={review.rating} label="Tu calificación" />
          <span className={`px-2 py-0.5 text-[10px] uppercase font-mono font-bold border ${meta.cls}`}>{meta.label}</span>
        </div>
        <p className="text-sm text-[#1b1c19] whitespace-pre-line break-words">{review.comment}</p>
        {review.staff_reply && (
          <div className="border-l-4 border-[#c9a227] bg-white px-3 py-2">
            <p className="font-mono text-[10px] uppercase text-[#755b00] mb-1">Respuesta del hotel</p>
            <p className="text-sm text-[#4d4635] whitespace-pre-line">{review.staff_reply}</p>
          </div>
        )}
      </div>
    );
  }

  const length = comment.trim().length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    if (rating < 1) {
      setFieldErrors({ rating: ['Selecciona una calificación de 1 a 5 estrellas.'] });
      return;
    }
    if (length < 10) {
      setFieldErrors({ comment: ['El comentario debe tener al menos 10 caracteres.'] });
      return;
    }
    setSaving(true);
    try {
      const res = await submitReview(bookingCode, { rating, comment: comment.trim() });
      onSubmitted?.(res.review, res.message);
    } catch (err) {
      setFieldErrors(err?.response?.data?.errors || {});
      setError(apiErrorMessage(err, 'No se pudo enviar la reseña.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <p role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/40 text-[#93000a] text-xs px-3 py-2">{error}</p>}
      <div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#4d4635] block mb-1">Tu calificación *</span>
        <StarRating value={rating} onChange={setRating} size="text-3xl" label="Calificación de tu estadía" />
        {fieldErrors.rating && <p className="text-[11px] text-[#ba1a1a] mt-1">{fieldErrors.rating[0]}</p>}
      </div>
      <div>
        <label htmlFor="review-comment" className="font-mono text-[10px] uppercase tracking-wider text-[#4d4635] block mb-1">Comentario *</label>
        <textarea
          id="review-comment"
          rows={4}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full bg-white border border-[#d1c5af] px-3 py-2 text-sm focus:outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]"
          placeholder="Cuéntanos qué te gustó y qué podríamos mejorar."
          aria-describedby="review-comment-count"
        />
        <div className="flex justify-between">
          {fieldErrors.comment ? <p className="text-[11px] text-[#ba1a1a]">{fieldErrors.comment[0]}</p> : <span />}
          <span id="review-comment-count" className={`font-mono text-[10px] ${length > 0 && length < 10 ? 'text-[#ba1a1a]' : 'text-[#4d4635]'}`}>
            {comment.length}/1000
          </span>
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="px-6 py-2.5 bg-[#14213d] text-white font-mono text-xs uppercase font-bold tracking-wider hover:bg-[#c9a227] hover:text-[#14213d] transition-colors disabled:opacity-60 cursor-pointer"
      >
        {saving ? 'Enviando…' : 'Publicar reseña'}
      </button>
      <p className="text-[11px] text-[#4d4635]">Tu reseña se publicará tras una breve revisión del hotel.</p>
    </form>
  );
}
