import { Link } from 'react-router-dom';

export default function PublicHeader() {
  return (
    <header className="bg-[#fbf9f4] border-b border-[#d1c5af] sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1200px] mx-auto flex justify-between items-center px-4 sm:px-6 py-4">
        {/* Logo */}
        <Link to="/" className="no-underline group">
          <div className="font-serif text-xl sm:text-2xl font-bold text-[#755b00] tracking-tight group-hover:text-[#4b3a00] transition-colors">
            Sheraton Lima
          </div>
          <span className="font-mono text-[10px] text-[#4d4635] uppercase tracking-wider block">
            The Grand Ledger
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
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            to="/recepcionista/huespedes/nuevo"
            className="text-[#4d4635] font-mono text-xs uppercase tracking-wider hover:text-[#755b00] hidden sm:block"
          >
            Panel Staff
          </Link>
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
