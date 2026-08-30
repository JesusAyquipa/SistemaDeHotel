import { Link } from 'react-router-dom';

export default function PublicFooter() {
  return (
    <footer className="bg-[#e4e2dd] border-t border-[#d1c5af] mt-auto">
      <div className="max-w-[1200px] mx-auto py-10 sm:py-12 px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="mb-4 md:mb-0">
          <div className="font-serif text-xl font-bold text-[#755b00] tracking-tight mb-1">
            Sheraton Lima
          </div>
          <div className="font-mono text-[10px] text-[#4d4635] uppercase tracking-wider">
            Hotel Sheraton • Sistema de Gestión Hotelera
          </div>
        </div>

        <div className="flex gap-4 sm:gap-6 items-center flex-wrap justify-center text-[#4d4635] font-mono text-xs uppercase tracking-wider">
          <a href="#privacidad" className="hover:text-[#755b00] transition-colors">
            Privacidad
          </a>
          <span className="text-[#d1c5af]">|</span>
          <a href="#terminos" className="hover:text-[#755b00] transition-colors">
            Términos
          </a>
          <span className="text-[#d1c5af]">|</span>
          <Link
            to="/recepcionista/huespedes/nuevo"
            className="hover:text-[#755b00] transition-colors text-[#525e7d] font-semibold"
          >
            Acceso Personal
          </Link>
        </div>

        <div className="font-mono text-xs text-[#4d4635] text-center md:text-right">
          © {new Date().getFullYear()} Sheraton Lima Hospitality
        </div>
      </div>
    </footer>
  );
}
