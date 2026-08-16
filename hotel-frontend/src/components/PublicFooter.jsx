import { Link } from 'react-router-dom';

export default function PublicFooter() {
  return (
    <footer className="bg-[#e4e2dd] border-t border-[#d1c5af] mt-auto">
      <div className="max-w-[1200px] mx-auto py-10 sm:py-12 px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <div className="font-serif text-lg font-bold text-[#1b1c19] tracking-tight text-center md:text-left">
            Sheraton Lima
          </div>
          <p className="font-mono text-xs text-[#4d4635] mt-1 text-center md:text-left">
            The Grand Ledger • Sistema de Gestión Hotelera
          </p>
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
