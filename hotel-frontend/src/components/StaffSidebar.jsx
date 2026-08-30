import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function StaffSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  const activePath = location.pathname;

  const toggleMobileMenu = () => {
    setMobileOpen(!mobileOpen);
  };

  // Format role
  const displayRole = user?.roles?.includes('admin') ? 'Administrador' : 
                      user?.roles?.includes('recepcionista') ? 'Recepción' : 'Staff';
  const displayName = user?.name || 'Cargando...';

  const navContent = (
    <div className="flex flex-col h-full p-4 w-64 bg-[#f5f3ee] border-r border-[#d1c5af] text-[#1b1c19] shadow-key-tag">
      {/* Header Logo */}
      <div className="mb-6 p-2 flex items-center justify-between">
        <Link to="/" className="no-underline">
          <h1 className="font-serif font-bold text-xl tracking-tight text-[#1b1c19]">
            Sheraton Lima
          </h1>
          <span className="font-mono text-[10px] text-[#4d4635] uppercase tracking-wider block">
            Sistema Hotelero
          </span>
        </Link>
        {/* Botón cerrar en móvil */}
        <button
          onClick={toggleMobileMenu}
          className="md:hidden text-[#4d4635] hover:text-[#1b1c19] p-1"
          aria-label="Cerrar menú"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* User Info / Shift Badge */}
      <div className="mb-6 px-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-[#e4e2dd] flex items-center justify-center overflow-hidden border border-[#d1c5af] flex-shrink-0">
            <span className="material-symbols-outlined text-[#525e7d]">account_circle</span>
          </div>
          <div className="truncate">
            <div className="font-serif font-semibold text-sm text-[#1b1c19] truncate">{displayRole}</div>
            <div className="font-mono text-xs text-[#4d4635] truncate">{displayName}</div>
          </div>
        </div>
        <button className="w-full mt-3 btn-primary text-xs py-2">
          + Nueva Reserva
        </button>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto">
        <ul className="space-y-1 px-1">
          <li>
            <Link
              to="/recepcionista/habitaciones"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all ${activePath.includes('/habitaciones')
                  ? 'bg-[#c9a227] text-[#4b3a00] font-bold border-r-4 border-[#755b00]'
                  : 'text-[#4d4635] hover:bg-[#eae8e3]'
                }`}
            >
              <span className="material-symbols-outlined">door_front</span>
              <span className="font-mono text-xs uppercase tracking-wider">Habitaciones</span>
            </Link>
          </li>
          <li>
            <Link
              to="/recepcionista/reservas"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all ${activePath.includes('/reservas')
                  ? 'bg-[#c9a227] text-[#4b3a00] font-bold border-r-4 border-[#755b00]'
                  : 'text-[#4d4635] hover:bg-[#eae8e3]'
                }`}
            >
              <span className="material-symbols-outlined">calendar_month</span>
              <span className="font-mono text-xs uppercase tracking-wider">Reservas</span>
            </Link>
          </li>
          <li>
            <Link
              to="/recepcionista/huespedes/nuevo"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all ${activePath.includes('/huespedes')
                  ? 'bg-[#c9a227] text-[#4b3a00] font-bold border-r-4 border-[#755b00] shadow-sm'
                  : 'text-[#4d4635] hover:bg-[#eae8e3]'
                }`}
            >
              <span className="material-symbols-outlined">group</span>
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">Huéspedes</span>
            </Link>
          </li>
          <li>
            <Link
              to="/recepcionista/reportes"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all ${activePath.includes('/reportes')
                  ? 'bg-[#c9a227] text-[#4b3a00] font-bold border-r-4 border-[#755b00]'
                  : 'text-[#4d4635] hover:bg-[#eae8e3]'
                }`}
            >
              <span className="material-symbols-outlined">analytics</span>
              <span className="font-mono text-xs uppercase tracking-wider">Reportes</span>
            </Link>
          </li>
          <li>
            <Link
              to="/recepcionista/personal"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all ${activePath.includes('/personal')
                  ? 'bg-[#c9a227] text-[#4b3a00] font-bold border-r-4 border-[#755b00]'
                  : 'text-[#4d4635] hover:bg-[#eae8e3]'
                }`}
            >
              <span className="material-symbols-outlined">manage_accounts</span>
              <span className="font-mono text-xs uppercase tracking-wider">Personal</span>
            </Link>
          </li>
        </ul>
      </div>

      {/* Footer Navigation */}
      <div className="mt-auto pt-4 border-t border-[#d1c5af] px-1">
        <ul className="space-y-1">
          <li>
            <Link
              to="/configuracion"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded text-[#4d4635] hover:bg-[#eae8e3] transition-all"
            >
              <span className="material-symbols-outlined">settings</span>
              <span className="font-mono text-xs uppercase tracking-wider">Configuración</span>
            </Link>
          </li>
          <li>
            <button
              onClick={() => {
                setMobileOpen(false);
                logout();
              }}
              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded text-[#4d4635] hover:bg-[#eae8e3] transition-all"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="font-mono text-xs uppercase tracking-wider">Cerrar Sesión</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <>
      {/* Botón Hamburguesa Móvil (Visible solo en < md) */}
      <div className="md:hidden bg-[#f5f3ee] border-b border-[#d1c5af] p-3 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMobileMenu}
            className="p-2 text-[#1b1c19] hover:bg-[#eae8e3] rounded-lg transition"
            aria-label="Abrir menú"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
          <span className="font-serif font-bold text-sm text-[#1b1c19]">HOTEL SHERATON</span>
        </div>
        <span className="font-mono text-xs bg-[#c9a227]/20 text-[#755b00] px-2 py-0.5 rounded font-semibold">
          {displayRole}
        </span>
      </div>

      {/* Drawer Overlay Móvil */}
      {mobileOpen && (
        <div
          onClick={toggleMobileMenu}
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* Sidebar Móvil (Drawer Deslizante) */}
      <div
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 transform transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {navContent}
      </div>

      {/* Sidebar Escritorio (Fijo en md+) */}
      <aside className="hidden md:flex flex-shrink-0 h-screen sticky top-0 z-20">
        {navContent}
      </aside>
    </>
  );
}
