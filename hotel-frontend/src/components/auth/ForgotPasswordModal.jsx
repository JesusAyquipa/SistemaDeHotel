import { useState } from 'react';
import api from '../../services/api';
import Toast from '../Toast';

export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await api.post('/forgot-password', { email });
      setToastMessage(res.data.message);
      setTimeout(() => {
        onClose();
        setEmail('');
      }, 3000);
    } catch (err) {
      setToastMessage(err.response?.data?.message || 'Error al procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1c19]/50 backdrop-blur-sm p-4">
      <div className="bg-[#e5e4de] w-full max-w-md shadow-2xl overflow-hidden border border-[#d1c5af] relative">
        <div className="bg-[#1b1c19] px-6 py-4 flex justify-between items-center border-b-2 border-[#c9a227]">
          <div>
            <h2 className="font-serif text-xl font-bold text-white tracking-widest uppercase">
              Recuperar Contraseña
            </h2>
            <p className="font-mono text-[10px] text-[#a39f96] tracking-[0.2em] uppercase mt-1">
              Seguridad de Cuenta
            </p>
          </div>
          <button onClick={onClose} className="text-[#a39f96] hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          <p className="font-sans text-sm text-[#4d4635] mb-6">
            Ingrese el correo electrónico asociado a su cuenta. Le enviaremos un enlace seguro para restablecer su contraseña.
          </p>
          
          <div className="space-y-6">
            <div>
              <label className="block font-mono text-xs font-bold text-[#a39f96] tracking-widest uppercase mb-2">
                Correo Electrónico
              </label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full bg-white border border-[#d1c5af] text-[#2d2d2a] font-mono text-sm px-4 py-3 focus:outline-none focus:border-[#987d35] focus:ring-1 focus:ring-[#987d35] transition-all"
                required
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#c9a227] hover:bg-[#b58f1a] text-[#14213d] font-bold font-mono text-xs uppercase tracking-widest py-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-[#a68a4d]"
            >
              {loading ? 'Procesando...' : 'Enviar Enlace de Recuperación'}
            </button>
          </div>
        </form>
      </div>

      <Toast 
        message={toastMessage} 
        isOpen={!!toastMessage} 
        onClose={() => setToastMessage(null)} 
      />
    </div>
  );
}
