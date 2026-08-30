import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function GuestLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    document_type: 'DNI',
    document_number: '',
    birth_date: '',
    nationality: '',
    phone: '',
    email: '',
    password: ''
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let result;
    if (isRegistering) {
      result = await register(formData);
    } else {
      result = await login({ email: formData.email, password: formData.password });
    }
    
    if (result.success) {
      const user = result.user;
      const hasStaffRole = user?.roles?.some(role => ['admin', 'recepcionista'].includes(role));
      
      const from = location.state?.from?.pathname || (hasStaffRole ? '/recepcionista/habitaciones' : '/habitaciones');
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Ocurrió un error. Verifica tus datos.');
    }
    setLoading(false);
  };

  return (
    <div className="bg-[#EDEBE6] text-[#1b1c19] min-h-screen flex items-center justify-center p-4 md:p-12 relative overflow-hidden">
      <style>{`
        .brass-plate {
            background: linear-gradient(135deg, #f5f3ee 0%, #e4e2dd 100%);
            border: 1px solid #d1c5af;
            box-shadow: 2px 2px 0px rgba(20, 33, 61, 0.1);
        }
        .bg-pattern {
            background-image: radial-gradient(#d1c5af 1px, transparent 1px);
            background-size: 24px 24px;
        }
      `}</style>
      
      <div className="absolute inset-0 pointer-events-none opacity-50 mix-blend-multiply bg-pattern"></div>
      
      <div className="relative w-full max-w-[1000px] flex flex-col md:flex-row bg-[#F7F6F3] border border-[#d1c5af] rounded shadow-[2px_2px_0px_rgba(20,33,61,0.1)] overflow-hidden z-10">
        
        {/* Left Side (Decorative) - Hidden on mobile if registering to save space */}
        <div className={`w-full md:w-5/12 bg-[#f5f3ee] border-b md:border-b-0 md:border-r border-[#d1c5af] p-8 lg:p-12 flex flex-col justify-between relative ${isRegistering ? 'hidden md:flex' : 'flex'}`}>
          <div className="z-10">
            <Link to="/habitaciones" className="inline-block mb-12 hover:opacity-80 transition-opacity">
              <span className="font-display-md text-3xl font-bold text-[#755b00] tracking-tight">Hotel Sheraton</span>
            </Link>
            <h2 className="font-display-md text-[28px] leading-[36px] font-bold text-[#1b1c19] mb-4">
              {isRegistering ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="font-body-md text-base text-[#4d4635]">
              {isRegistering ? 'Please register to access your upcoming reservations and personalized guest services.' : 'Please sign in to access the system.'}
            </p>
          </div>
          <div className="mt-12 z-10 hidden md:block">
            <div className="brass-plate p-6 w-full max-w-[280px]">
              <span className="material-symbols-outlined text-[#7f7663] block mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>key</span>
              <p className="font-utility-sm text-xs text-[#1b1c19] uppercase tracking-wider mb-1 font-medium">Access Key</p>
              <p className="font-body-sm text-sm text-[#4d4635]">Awaiting Authentication</p>
            </div>
          </div>
          <div 
            className="absolute bottom-0 right-0 w-full h-1/2 opacity-20 pointer-events-none" 
            style={{ 
              backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCCwGT6QoOxT2v5uJad2OfDFXQ5vhctf809i1wLOiXkBcTr35tUBnSDVM3_oPhp4s-DmbUBhJvmcLX6w1FeOUjzbN75B5wRzUIG3h79T_YR6_gQ_jv5RUwbalNtfDmoNGIdI2FxtsHuir-dXWBafjnPTjqQ20X0KiPyKh40fDdd8_vm1Gzf6IHNksPNQW2szR3waKCxDUKqi3fjBkZj0GBuKFRbsKUzNur0On6cwsaikiD2o_7z5cHy')", 
              backgroundSize: 'cover', 
              backgroundPosition: 'bottom right' 
            }}
          ></div>
        </div>

        <div className={`w-full ${isRegistering ? 'md:w-7/12' : 'md:w-7/12'} p-6 sm:p-8 lg:p-12 xl:p-16 flex flex-col justify-center bg-[#F7F6F3] max-h-screen overflow-y-auto`}>
          
          {/* Opciones Adicionales */}
          <div className="absolute top-4 right-4 z-20">
            <Link to="/habitaciones" className="font-utility-sm text-xs text-[#4d4635] hover:text-[#755b00] uppercase tracking-wider font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">home</span>
              Return to Home
            </Link>
          </div>

          <div className="flex border-b border-[#d1c5af] mb-8 w-max">
            <button 
              type="button"
              onClick={() => { setIsRegistering(false); setError(''); }}
              className={`font-utility-md text-sm font-bold pb-2 px-4 uppercase tracking-wider transition-colors ${!isRegistering ? 'text-[#755b00] border-b-2 border-[#755b00]' : 'text-[#4d4635] hover:text-[#755b00]'}`}
            >
              Login
            </button>
            <button 
              type="button"
              onClick={() => { setIsRegistering(true); setError(''); }}
              className={`font-utility-md text-sm font-bold pb-2 px-4 uppercase tracking-wider transition-colors ${isRegistering ? 'text-[#755b00] border-b-2 border-[#755b00]' : 'text-[#4d4635] hover:text-[#755b00]'}`}
            >
              Register
            </button>
          </div>
          
          <form className={isRegistering ? "space-y-6" : "space-y-8"} onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded font-utility-sm text-xs">
                {error}
              </div>
            )}
            
            {isRegistering && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Nombre *</label>
                    <input value={formData.name} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full" name="name" placeholder="John" required type="text" />
                  </div>
                  <div className="relative">
                    <label className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Apellidos *</label>
                    <input value={formData.surname} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full" name="surname" placeholder="Doe" required type="text" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Tipo Doc *</label>
                    <select value={formData.document_type} onChange={handleChange} name="document_type" className="input-ledger font-body-md text-base text-[#1b1c19] w-full bg-transparent appearance-none" required>
                      <option value="DNI">DNI</option>
                      <option value="Pasaporte">Pasaporte</option>
                      <option value="Carné de Extranjería">Carné de Extranjería</option>
                    </select>
                  </div>
                  <div className="relative">
                    <label className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Núm Doc *</label>
                    <input value={formData.document_number} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full" name="document_number" required type="text" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Nacimiento</label>
                    <input value={formData.birth_date} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full" name="birth_date" type="date" />
                  </div>
                  <div className="relative">
                    <label className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Nacionalidad</label>
                    <input value={formData.nationality} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full" name="nationality" placeholder="Peruano" type="text" />
                  </div>
                </div>

                <div className="relative">
                  <label className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Teléfono</label>
                  <input value={formData.phone} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full" name="phone" placeholder="+51 987654321" type="text" />
                </div>
              </>
            )}

            <div className="relative">
              <label className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Email Address *</label>
              <input value={formData.email} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full" name="email" placeholder="user@hotel.com" required type="email" />
            </div>
            
            <div className="relative">
              <label className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Password *</label>
              <input value={formData.password} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full" name="password" placeholder="••••••••" required type="password" minLength={8} />
              <button className="absolute right-0 bottom-2 text-[#4d4635] hover:text-[#755b00] transition-colors" type="button">
                <span className="material-symbols-outlined text-[20px]">visibility</span>
              </button>
            </div>
            
            {!isRegistering && (
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center cursor-pointer">
                  <input className="h-4 w-4 text-[#755b00] border-[#d1c5af] rounded-sm focus:ring-[#755b00] bg-[#fbf9f4] mr-2" type="checkbox" />
                  <span className="font-body-sm text-sm text-[#4d4635]">Remember me</span>
                </label>
                <a className="font-utility-sm text-xs font-medium text-[#755b00] hover:underline uppercase tracking-wider" href="#">Forgot Password?</a>
              </div>
            )}
            
            <div className="pt-2">
              <button disabled={loading} className="btn-primary w-full py-4 font-utility-md text-sm font-bold rounded flex items-center justify-center gap-2 disabled:opacity-70" type="submit">
                  {loading ? 'Processing...' : (isRegistering ? 'Register & Sign In' : 'Sign In')}
                  {!loading && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
              </button>
            </div>
          </form>
          
          <div className="mt-8 text-center">
            <p className="font-body-sm text-sm text-[#4d4635] flex items-center justify-center gap-2 before:content-[''] before:flex-1 before:h-[1px] before:bg-[#d1c5af] after:content-[''] after:flex-1 after:h-[1px] after:bg-[#d1c5af]">
              Secure Entry
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
