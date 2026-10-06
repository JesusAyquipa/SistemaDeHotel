import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import Toast from '../components/Toast';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !email) {
      setError('El enlace es inválido o está incompleto.');
    }
  }, [token, email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== passwordConfirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const res = await api.post('/reset-password', {
        token,
        email,
        password,
        password_confirmation: passwordConfirmation
      });
      
      setToastMessage(res.data.message);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#dcdad5] p-4 relative overflow-hidden">
      <div className="w-full max-w-md bg-[#fbf9f4] shadow-2xl overflow-hidden border border-[#d1c5af] relative z-10">
        
        <div className="bg-[#1b1c19] text-center py-10 px-8 border-b-[6px] border-[#c9a227] relative">
          <h1 className="font-serif text-3xl font-bold text-white tracking-widest uppercase relative z-10">
            Sheraton Lima Hotel
          </h1>
          <p className="font-mono text-xs text-[#a39f96] mt-3 tracking-[0.2em] uppercase relative z-10">
            Restablecer Contraseña
          </p>
        </div>

        <div className="p-8 md:p-10">
          {error && (
            <div className="mb-6 p-4 bg-[#ffdad6] border border-[#ba1a1a]/30 text-[#93000a] text-sm font-mono flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <p>{error}</p>
            </div>
          )}

          {(!token || !email) ? (
            <div className="text-center">
              <p className="font-sans text-sm text-[#4d4635] mb-6">
                El enlace de recuperación parece estar dañado. Por favor, vuelva a solicitar uno.
              </p>
              <Link to="/login" className="text-[#c9a227] font-bold font-mono text-xs uppercase hover:underline">
                Volver al Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-[#f5f3ee] border border-[#e4e2dd] p-4 mb-6">
                <span className="block font-mono text-xs font-bold text-[#a39f96] tracking-widest uppercase mb-1">
                  Cuenta
                </span>
                <span className="font-sans font-bold text-[#1b1c19]">{email}</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block font-mono text-xs font-bold text-[#a39f96] tracking-widest uppercase mb-2">
                    Nueva Contraseña
                  </label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-[#d1c5af] text-[#2d2d2a] font-mono text-sm px-4 py-3 focus:outline-none focus:border-[#987d35] focus:ring-1 focus:ring-[#987d35] transition-all"
                    placeholder="••••••••"
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs font-bold text-[#a39f96] tracking-widest uppercase mb-2">
                    Confirmar Contraseña
                  </label>
                  <input 
                    type="password" 
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    className="w-full bg-white border border-[#d1c5af] text-[#2d2d2a] font-mono text-sm px-4 py-3 focus:outline-none focus:border-[#987d35] focus:ring-1 focus:ring-[#987d35] transition-all"
                    placeholder="••••••••"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-[#c9a227] hover:bg-[#b58f1a] text-[#14213d] font-bold font-mono text-xs uppercase tracking-widest py-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-[#a68a4d] flex items-center justify-center gap-2"
              >
                {loading ? 'Guardando...' : 'Cambiar Contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>

      <Toast 
        message={toastMessage} 
        isOpen={!!toastMessage} 
        onClose={() => setToastMessage(null)} 
      />
    </div>
  );
}
