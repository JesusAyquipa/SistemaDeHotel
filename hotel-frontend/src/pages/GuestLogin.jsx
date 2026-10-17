import { useState, useId } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ForgotPasswordModal from '../components/auth/ForgotPasswordModal';
import { HOTEL_NAME } from '../constants/hotel';
import { homeForUser } from '../constants/roles';

// Prefijos de ruta y los roles que pueden acceder a ellos (debe coincidir con AppRoutes).
const ROUTE_ROLES = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/recepcionista', roles: ['recepcionista'] },
  { prefix: '/configuracion', roles: ['admin', 'recepcionista'] },
  { prefix: '/cliente', roles: ['cliente', 'admin', 'recepcionista'] },
];

function canAccess(user, pathname) {
  if (!pathname || pathname === '/login') return false;
  const rule = ROUTE_ROLES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return true; // ruta pública
  return (user?.roles || []).some((role) => rule.roles.includes(role));
}

export default function GuestLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const uid = useId();
  const fid = (name) => `${uid}-${name}`;

  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

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
      // Solo volver a la ruta de origen si el rol del nuevo usuario tiene acceso a ella.
      const fromLocation = location.state?.from;
      const from = fromLocation?.pathname;
      const target = from && canAccess(user, from)
        ? `${from}${fromLocation.search || ''}`
        : homeForUser(user);
      navigate(target, { replace: true });
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
              <span className="font-display-md text-3xl font-bold text-[#755b00] tracking-tight">{HOTEL_NAME}</span>
            </Link>
            <h2 className="font-display-md text-[28px] leading-[36px] font-bold text-[#1b1c19] mb-4">
              {isRegistering ? 'Crear Cuenta' : 'Bienvenido de Nuevo'}
            </h2>
            <p className="font-body-md text-base text-[#4d4635]">
              {isRegistering ? 'Regístrate para acceder a tus próximas reservas y a servicios personalizados para huéspedes.' : 'Inicia sesión para acceder al sistema.'}
            </p>
          </div>
          <div className="mt-12 z-10 hidden md:block">
            <div className="brass-plate p-6 w-full max-w-[280px]">
              <span className="material-symbols-outlined text-[#7f7663] block mb-2" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">key</span>
              <p className="font-utility-sm text-xs text-[#1b1c19] uppercase tracking-wider mb-1 font-medium">Llave de Acceso</p>
              <p className="font-body-sm text-sm text-[#4d4635]">Esperando autenticación</p>
            </div>
          </div>
          <div
            className="absolute bottom-0 right-0 w-full h-1/2 opacity-20 pointer-events-none"
            style={{
              backgroundImage: "url('/images/guestlogin-3.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'bottom right'
            }}
          ></div>
        </div>

        <div className={`w-full ${isRegistering ? 'md:w-7/12' : 'md:w-7/12'} p-6 sm:p-8 lg:p-12 xl:p-16 flex flex-col justify-center bg-[#F7F6F3] max-h-screen overflow-y-auto`}>

          {/* Opciones Adicionales */}
          <div className="flex justify-end mb-6 w-full">
            <Link to="/habitaciones" className="font-utility-sm text-xs text-[#4d4635] hover:text-[#755b00] uppercase tracking-wider font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">home</span>
              Volver al Inicio
            </Link>
          </div>

          <div className="flex border-b border-[#d1c5af] mb-8 w-max">
            <button
              type="button"
              onClick={() => { setIsRegistering(false); setError(''); }}
              className={`font-utility-md text-sm font-bold pb-2 px-4 uppercase tracking-wider transition-colors ${!isRegistering ? 'text-[#755b00] border-b-2 border-[#755b00]' : 'text-[#4d4635] hover:text-[#755b00]'}`}
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => { setIsRegistering(true); setError(''); }}
              className={`font-utility-md text-sm font-bold pb-2 px-4 uppercase tracking-wider transition-colors ${isRegistering ? 'text-[#755b00] border-b-2 border-[#755b00]' : 'text-[#4d4635] hover:text-[#755b00]'}`}
            >
              Registrarse
            </button>
          </div>

          <form className={isRegistering ? "space-y-6" : "space-y-8"} onSubmit={handleSubmit}>
            {error && (
              <div role="alert" className="bg-red-50 text-red-700 border border-red-200 p-3 rounded font-utility-sm text-xs">
                {error}
              </div>
            )}

            {isRegistering && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <label htmlFor={fid('name')} className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Nombre *</label>
                    <input value={formData.name} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full" id={fid('name')} name="name" autoComplete="given-name" placeholder="Juan" required type="text" />
                  </div>
                  <div className="relative">
                    <label htmlFor={fid('surname')} className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Apellidos *</label>
                    <input value={formData.surname} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full" id={fid('surname')} name="surname" autoComplete="family-name" placeholder="Pérez" required type="text" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <label htmlFor={fid('document_type')} className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Tipo Doc *</label>
                    <select value={formData.document_type} onChange={handleChange} id={fid('document_type')} name="document_type" className="input-ledger font-body-md text-base text-[#1b1c19] w-full bg-transparent appearance-none" required>
                      <option value="DNI">DNI</option>
                      <option value="Pasaporte">Pasaporte</option>
                      <option value="Carné de Extranjería">Carné de Extranjería</option>
                    </select>
                  </div>
                  <div className="relative">
                    <label htmlFor={fid('document_number')} className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Núm Doc *</label>
                    <input value={formData.document_number} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full" id={fid('document_number')} name="document_number" required type="text" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <label htmlFor={fid('birth_date')} className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Nacimiento</label>
                    <input value={formData.birth_date} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full" id={fid('birth_date')} name="birth_date" type="date" />
                  </div>
                  <div className="relative">
                    <label htmlFor={fid('nationality')} className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Nacionalidad</label>
                    <input value={formData.nationality} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full" id={fid('nationality')} name="nationality" placeholder="Peruano" type="text" />
                  </div>
                </div>

                <div className="relative">
                  <label htmlFor={fid('phone')} className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Teléfono</label>
                  <input value={formData.phone} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full" id={fid('phone')} name="phone" autoComplete="tel" placeholder="+51 987654321" type="tel" />
                </div>
              </>
            )}

            <div className="relative">
              <label htmlFor={fid('email')} className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Correo Electrónico *</label>
              <input value={formData.email} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full" id={fid('email')} name="email" autoComplete="email" placeholder="usuario@correo.com" required type="email" />
            </div>

            <div className="relative">
              <label htmlFor={fid('password')} className="block font-utility-sm text-xs text-[#4d4635] uppercase tracking-wider mb-1 font-medium">Contraseña *</label>
              <input value={formData.password} onChange={handleChange} className="input-ledger font-body-md text-base text-[#1b1c19] w-full pr-10" id={fid('password')} name="password" autoComplete={isRegistering ? 'new-password' : 'current-password'} placeholder="••••••••" required type={showPassword ? "text" : "password"} minLength={8} />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-0 bottom-2 text-[#4d4635] hover:text-[#755b00] transition-colors" type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>

            {!isRegistering && (
              <div className="flex items-center justify-between pt-2">
                <span />
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="font-utility-sm text-xs font-medium text-[#755b00] hover:underline uppercase tracking-wider"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            <div className="pt-2">
              <button disabled={loading} className="btn-primary w-full py-4 font-utility-md text-sm font-bold rounded flex items-center justify-center gap-2 disabled:opacity-70" type="submit">
                  {loading ? 'Procesando...' : (isRegistering ? 'Registrarse e Ingresar' : 'Iniciar Sesión')}
                  {!loading && <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="font-body-sm text-sm text-[#4d4635] flex items-center justify-center gap-2 before:content-[''] before:flex-1 before:h-[1px] before:bg-[#d1c5af] after:content-[''] after:flex-1 after:h-[1px] after:bg-[#d1c5af]">
              Acceso Seguro
            </p>
          </div>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </div>
  );
}
