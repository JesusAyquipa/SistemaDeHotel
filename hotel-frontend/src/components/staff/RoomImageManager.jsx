import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';
import assetUrl from '../../utils/assetUrl';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';
import {
  getRoomImages,
  uploadRoomImages,
  reorderRoomImages,
  setPrimaryRoomImage,
  deleteRoomImage,
  validateImageFile,
} from '../../services/roomImageService';

/**
 * Gestor de la galería de una habitación (SHE-035, solo admin):
 * subir varias imágenes (validación de tipo/tamaño en cliente), reordenar con
 * flechas, marcar principal (estrella) y eliminar con confirmación.
 */
export default function RoomImageManager({ roomId, onNotify, onChanged }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [clientErrors, setClientErrors] = useState([]);
  const fileInputRef = useRef(null);

  const notify = useCallback((message, type = 'success') => onNotify?.(message, type), [onNotify]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getRoomImages(roomId)
      .then((list) => { if (active) setImages(list); })
      .catch((err) => {
        logError('rooms:images:list', err);
        if (active) notify(apiErrorMessage(err, 'No se pudieron cargar las imágenes.'), 'error');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [roomId, notify]);

  const run = async (action, successMessage, fallback) => {
    setBusy(true);
    try {
      const list = await action();
      setImages(list);
      if (successMessage) notify(successMessage);
      onChanged?.();
    } catch (err) {
      logError('rooms:images', err);
      notify(apiErrorMessage(err, fallback), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const errors = files.map(validateImageFile).filter(Boolean);
    setClientErrors(errors);
    const valid = files.filter((f) => !validateImageFile(f));
    if (valid.length === 0) return;

    run(
      () => uploadRoomImages(roomId, valid),
      valid.length === 1 ? 'Imagen subida correctamente.' : `${valid.length} imágenes subidas correctamente.`,
      'No se pudieron subir las imágenes.',
    );
  };

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next); // optimista
    run(() => reorderRoomImages(roomId, next.map((img) => img.id)), null, 'No se pudo reordenar.');
  };

  const confirmDelete = () => {
    const image = deleteTarget;
    setDeleteTarget(null);
    if (!image) return;
    run(() => deleteRoomImage(roomId, image.id), 'Imagen eliminada.', 'No se pudo eliminar la imagen.');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="block font-bold text-[#4d4635] uppercase">Galería de imágenes</span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="px-3 py-1.5 bg-[#14213d] text-[#fbf9f4] font-bold uppercase text-[10px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">add_photo_alternate</span>
          <span>{busy ? 'Procesando…' : 'Agregar imágenes'}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFiles}
          className="hidden"
          aria-label="Seleccionar imágenes"
        />
      </div>
      <p className="text-[10px] text-[#78716c]">JPG, PNG o WEBP · máximo 4 MB por imagen. La estrella marca la imagen principal.</p>

      {clientErrors.length > 0 && (
        <ul className="bg-[#ffdad6] border border-[#ba1a1a]/40 p-2 text-[#93000a] text-[10px] list-disc pl-5" role="alert">
          {clientErrors.map((msg) => <li key={msg}>{msg}</li>)}
        </ul>
      )}

      {loading ? (
        <div className="h-20 bg-[#f5f3ee] border border-[#d1c5af] animate-pulse" />
      ) : images.length === 0 ? (
        <p className="bg-[#f5f3ee] border border-dashed border-[#d1c5af] p-3 text-center text-[11px] text-[#78716c]">
          Sin imágenes en la galería. Se usará la imagen de respaldo (URL) si existe.
        </p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((img, i) => (
            <li key={img.id} className={`border-2 bg-[#f5f3ee] ${img.is_primary ? 'border-[#c9a227]' : 'border-[#d1c5af]'}`}>
              <div className="relative">
                <img src={assetUrl(img.url)} alt={`Imagen ${i + 1}`} className="w-full h-20 object-cover" />
                {img.is_primary && (
                  <span className="absolute top-1 left-1 bg-[#c9a227] text-[#14213d] text-[9px] font-bold px-1.5 py-0.5 uppercase">Principal</span>
                )}
              </div>
              <div className="flex items-center justify-between px-1 py-0.5">
                <div className="flex">
                  <button type="button" onClick={() => move(i, -1)} disabled={busy || i === 0}
                    className="p-0.5 text-[#14213d] disabled:opacity-30 cursor-pointer" aria-label={`Mover imagen ${i + 1} antes`}>
                    <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={busy || i === images.length - 1}
                    className="p-0.5 text-[#14213d] disabled:opacity-30 cursor-pointer" aria-label={`Mover imagen ${i + 1} después`}>
                    <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_forward</span>
                  </button>
                </div>
                <div className="flex">
                  <button type="button"
                    onClick={() => run(() => setPrimaryRoomImage(roomId, img.id), 'Imagen principal actualizada.', 'No se pudo marcar como principal.')}
                    disabled={busy || img.is_primary}
                    className={`p-0.5 cursor-pointer ${img.is_primary ? 'text-[#c9a227]' : 'text-[#78716c] hover:text-[#c9a227]'}`}
                    aria-label={img.is_primary ? 'Imagen principal' : `Marcar imagen ${i + 1} como principal`}
                    aria-pressed={img.is_primary}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true"
                      style={img.is_primary ? { fontVariationSettings: "'FILL' 1" } : undefined}>star</span>
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(img)} disabled={busy}
                    className="p-0.5 text-[#b71c1c] cursor-pointer disabled:opacity-30" aria-label={`Eliminar imagen ${i + 1}`}>
                    <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar imagen"
        message="¿Eliminar esta imagen de la galería? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
