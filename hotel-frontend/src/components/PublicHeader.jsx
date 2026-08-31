import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function PublicHeader() {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  return (
    <header className="bg-[#fbf9f4] border-b border-[#d1c5af] sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1200px] mx-auto flex justify-between items-center px-4 sm:px-6 py-4">
        {/* Logo */}
        <Link to="/" className="no-underline group">
          <div className="font-serif text-xl sm:text-2xl font-bold text-[#755b00] tracking-tight group-hover:text-[#4b3a00] transition-colors">
            Sheraton Lima
          </div>
          <span className="font-mono text-[10px] text-[#4d4635] uppercase tracking-wider block">
            Hotel Sheraton
          </span>
        </Link>

        {/* Navegación Desktop */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            to="/habitaciones"
            className="text-[#4d4635] font-mono text-xs uppercase tracking-wider hover:text-[#755b00] font-semibold transition-colors duration-200"
          >
            Habitaciones
          </Link>
          <a
            href="#experiencia"
            className="text-[#4d4635] font-mono text-xs uppercase tracking-wider hover:text-[#755b00] transition-colors duration-200"
          >
            Experiencia
          </a>
          <a
            href="#nosotros"
            className="text-[#4d4635] font-mono text-xs uppercase tracking-wider hover:text-[#755b00] transition-colors duration-200"
          >
            Nosotros
          </a>
        </nav>

        {/* Botones de acción */}
        <div className="flex items-center gap-3 sm:gap-4 relative">
          {!user ? (
            <Link
              to="/login"
              className="text-[#4d4635] font-mono text-xs uppercase tracking-wider hover:text-[#755b00] hidden sm:flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">login</span> Iniciar Sesión
            </Link>
          ) : (
            <div className="relative">
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="text-[#4d4635] font-mono text-xs uppercase tracking-wider hover:text-[#755b00] flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">person</span> {user.name}
                <span className="material-symbols-outlined text-[14px]">{dropdownOpen ? 'expand_less' : 'expand_more'}</span>
              </button>
              
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-4 w-48 bg-[#fbf9f4] border border-[#d1c5af] shadow-[2px_2px_0px_rgba(20,33,61,0.15)] z-50 flex flex-col">
                  <div className="p-3 border-b border-[#d1c5af]">
                    <p className="font-mono text-[10px] text-[#4d4635] uppercase tracking-wider mb-1">Cuenta</p>
                    <p className="font-serif font-bold text-sm text-[#1b1c19] truncate">{user.name} {user.surname}</p>
                  </div>
                  <button 
                    onClick={() => { logout(); setDropdownOpen(false); }}
                    className="w-full text-left px-4 py-3 text-xs font-mono uppercase font-bold text-[#ba1a1a] hover:bg-[#ffdad6]/40 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          )}
          <Link
            to="/habitaciones"
            className="bg-[#c9a227] text-[#14213d] font-mono text-xs uppercase tracking-wider px-4 sm:px-6 py-2.5 sm:py-3 border border-[#a68a4d] hover:brightness-105 transition-all shadow-sm font-bold inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            <span>Reservar</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
