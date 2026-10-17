import { useState, useRef, useId, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Toast from './Toast';
import assetUrl from '../utils/assetUrl';
import useEscapeKey from '../hooks/useEscapeKey';

export default function ProfileModal({ isOpen, onClose }) {
  const { user, updateProfile } = useAuth();
  const baseId = useId();
  const titleId = `${baseId}-title`;

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(user?.image_url ? assetUrl(user.image_url) : null);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const closeTimerRef = useRef(null);

  useEscapeKey(() => { if (!loading) onClose(); }, isOpen);

  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  if (!isOpen) return null;

  const displayRole = user?.roles?.includes('admin') ? 'ADMINISTRADOR PRINCIPAL'
    : user?.roles?.includes('recepcionista') ? 'RECEPCIONISTA'
    : 'CLIENTE';

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const emailChanged = email !== (user?.email || '');
  const needsCurrentPassword = !!password || emailChanged;

  const handleSave = async () => {
    const errors = {};
    if (password && password.length < 8) errors.password = 'La contraseña debe tener al menos 8 caracteres.';
    if (needsCurrentPassword && !currentPassword) errors.current_password = 'Ingrese su contraseña actual para cambiar el correo o la contraseña.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const formData = new FormData();
    if (name !== user.name) formData.append('name', name);
    if (email !== user.email) formData.append('email', email);
    if (password) formData.append('password', password);
    if (imageFile) formData.append('image', imageFile);
    if (needsCurrentPassword) formData.append('current_password', currentPassword);

    // Si no cambió nada, solo cerrar
    if (formData.entries().next().done) {
      onClose();
      return;
    }

    setLoading(true);
    const res = await updateProfile(formData);
    setLoading(false);
    if (res.success) {
      setPassword('');
      setCurrentPassword('');
      setToast({ type: 'success', message: 'Perfil actualizado correctamente' });
      closeTimerRef.current = setTimeout(() => onClose(), 1500);
    } else {
      setToast({ type: 'error', message: res.error || 'Error al actualizar perfil' });
      if (res.errors) {
        setFieldErrors(Object.fromEntries(
          Object.entries(res.errors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
        ));
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <Toast
        message={toast?.message}
        isOpen={!!toast}
        type={toast?.type}
        onClose={() => setToast(null)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-[#fcfcfc] w-full max-w-[400px] border border-[#d1c5af] shadow-2xl relative animate-fadeIn"
      >
        {/* Header */}
        <div className="border-b border-[#d1c5af] p-4 flex justify-between items-center bg-white">
          <h2 id={titleId} className="font-serif font-bold text-lg text-[#2d2d2a]">Mi Perfil</h2>
          <button type="button" className="text-[#78716c] hover:text-[#2d2d2a] transition-colors" onClick={onClose} aria-label="Cerrar">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center">
          <div className="relative mb-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            <div className="w-24 h-24 rounded-xl overflow-hidden shadow-sm border border-[#d1c5af] bg-[#e4e2dd] flex items-center justify-center">
              {imagePreview ? (
                <img src={imagePreview} alt="Foto de perfil" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-4xl text-[#78716c]" aria-hidden="true">person</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Cambiar foto de perfil"
              className="absolute -bottom-2 -right-2 bg-[#987d35] rounded-full p-1.5 border-2 border-white cursor-pointer hover:bg-[#7a642a] transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-white text-[14px]" aria-hidden="true">photo_camera</span>
            </button>
          </div>

          <p className="font-mono text-[9px] uppercase tracking-widest text-[#78716c] font-bold mb-8 text-center">
            ROL: {displayRole}
          </p>

          <div className="w-full space-y-6">
            <div>
              <label htmlFor={`${baseId}-name`} className="font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c]">NOMBRE COMPLETO</label>
              <input
                id={`${baseId}-name`}
                type="text"
                autoComplete="name"
                className="w-full border-b border-[#d1c5af] bg-transparent focus:border-[#987d35] focus:outline-none py-2 text-sm text-[#2d2d2a] font-sans transition-colors"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-email`} className="font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c]">CORREO ELECTRÓNICO</label>
              <input
                id={`${baseId}-email`}
                type="email"
                autoComplete="email"
                className="w-full border-b border-[#d1c5af] bg-transparent focus:border-[#987d35] focus:outline-none py-2 text-sm text-[#2d2d2a] font-sans transition-colors"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {fieldErrors.email && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.email}</p>}
            </div>
            <div>
              <label htmlFor={`${baseId}-password`} className="font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c]">CAMBIAR CONTRASEÑA</label>
              <input
                id={`${baseId}-password`}
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                className="w-full border-b border-[#d1c5af] bg-transparent focus:border-[#987d35] focus:outline-none py-2 text-sm text-[#2d2d2a] font-sans transition-colors placeholder:text-[#a39f96]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {fieldErrors.password && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.password}</p>}
            </div>
            {needsCurrentPassword && (
              <div>
                <label htmlFor={`${baseId}-current`} className="font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c]">CONTRASEÑA ACTUAL *</label>
                <input
                  id={`${baseId}-current`}
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full border-b border-[#d1c5af] bg-transparent focus:border-[#987d35] focus:outline-none py-2 text-sm text-[#2d2d2a] font-sans transition-colors"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <p className="font-mono text-[9px] text-[#78716c] mt-1">Requerida para cambiar el correo o la contraseña.</p>
                {fieldErrors.current_password && <p className="text-[#ba1a1a] font-mono text-[10px] mt-1">{fieldErrors.current_password}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#d1c5af] p-4 flex gap-4 bg-[#fbf9f4]">
          <button
            type="button"
            disabled={loading}
            className="flex-1 bg-white border border-[#987d35] text-[#987d35] font-mono text-[10px] uppercase tracking-widest font-bold py-3 hover:bg-[#f5f3ee] transition-colors"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading}
            className="flex-1 bg-[#987d35] text-white font-mono text-[10px] uppercase tracking-widest font-bold py-3 hover:bg-[#7a642a] transition-colors disabled:opacity-50"
            onClick={handleSave}
          >
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
