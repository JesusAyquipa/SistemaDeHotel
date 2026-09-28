import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Toast from './Toast';

export default function ProfileModal({ isOpen, onClose }) {
  const { user, updateProfile } = useAuth();
  
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(user?.image_url ? `http://localhost:8000${user.image_url}` : null);
  
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const displayRole = user?.roles?.includes('admin') ? 'ADMINISTRADOR PRINCIPAL' : 
                      user?.roles?.includes('recepcionista') ? 'RECEPCIONISTA' : 
                      user?.roles?.includes('cliente') ? 'USUARIO' : 'STAFF';

  const handleImageClick = () => {
    fileInputRef.current.click();
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const formData = new FormData();
    if (name !== user.name) formData.append('name', name);
    if (email !== user.email) formData.append('email', email);
    if (password) formData.append('password', password);
    if (imageFile) formData.append('image', imageFile);

    // If nothing changed, just close
    let isEmpty = true;
    for (let pair of formData.entries()) {
       isEmpty = false;
       break;
    }
    
    if (isEmpty) {
      onClose();
      return;
    }

    const res = await updateProfile(formData);
    setLoading(false);
    if (res.success) {
      setToastMessage('Perfil actualizado correctamente');
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setToastMessage(res.error || 'Error al actualizar perfil');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} type={toastMessage.includes('Error') ? 'error' : 'success'} />
      )}
      
      <div className="bg-[#fcfcfc] w-full max-w-[400px] border border-[#d1c5af] shadow-2xl relative animate-fadeIn">
        {/* Header */}
        <div className="border-b border-[#d1c5af] p-4 flex justify-between items-center bg-white">
          <h2 className="font-serif font-bold text-lg text-[#2d2d2a]">Mi Perfil</h2>
          <button className="text-[#78716c] hover:text-[#2d2d2a] transition-colors" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 flex flex-col items-center">
           {/* Image */}
           <div className="relative mb-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageChange} 
                accept="image/*" 
                className="hidden" 
              />
              <div 
                className="w-24 h-24 rounded-xl overflow-hidden shadow-sm border border-[#d1c5af] bg-[#e4e2dd] flex items-center justify-center"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-4xl text-[#78716c]">person</span>
                )}
              </div>
              <div 
                onClick={handleImageClick}
                className="absolute -bottom-2 -right-2 bg-[#987d35] rounded-full p-1.5 border-2 border-white cursor-pointer hover:bg-[#7a642a] transition-colors shadow-sm"
              >
                 <span className="material-symbols-outlined text-white text-[14px]">photo_camera</span>
              </div>
           </div>

           {/* Role */}
           <p className="font-mono text-[9px] uppercase tracking-widest text-[#78716c] font-bold mb-8 text-center">
             ROL: {displayRole}
           </p>
           
           <div className="w-full space-y-6">
              <div>
                <label className="font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c]">NOMBRE COMPLETO</label>
                <input 
                  type="text" 
                  className="w-full border-b border-[#d1c5af] bg-transparent focus:border-[#987d35] focus:outline-none py-2 text-sm text-[#2d2d2a] font-sans transition-colors" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                />
              </div>
              <div>
                <label className="font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c]">CORREO ELECTRÓNICO</label>
                <input 
                  type="email" 
                  className="w-full border-b border-[#d1c5af] bg-transparent focus:border-[#987d35] focus:outline-none py-2 text-sm text-[#2d2d2a] font-sans transition-colors" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                />
              </div>
              <div>
                <label className="font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c]">CAMBIAR CONTRASEÑA</label>
                <input 
                  type="password" 
                  placeholder="********" 
                  className="w-full border-b border-[#d1c5af] bg-transparent focus:border-[#987d35] focus:outline-none py-2 text-sm text-[#2d2d2a] font-sans transition-colors placeholder:text-[#a39f96]" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                />
              </div>
           </div>
        </div>
        
        {/* Footer */}
        <div className="border-t border-[#d1c5af] p-4 flex gap-4 bg-[#fbf9f4]">
           <button 
             disabled={loading}
             className="flex-1 bg-white border border-[#987d35] text-[#987d35] font-mono text-[10px] uppercase tracking-widest font-bold py-3 hover:bg-[#f5f3ee] transition-colors" 
             onClick={onClose}
           >
             Cancelar
           </button>
           <button 
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
