import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] flex flex-col font-sans">
      <PublicHeader />
      <main className="flex-grow flex items-center justify-center px-4 py-20">
        <div className="max-w-lg w-full text-center bg-[#f5f3ee] border border-[#d1c5af] shadow-[2px_2px_0px_rgba(20,33,61,0.15)] p-10">
          <span className="material-symbols-outlined text-6xl text-[#c9a227]" aria-hidden="true">explore_off</span>
          <p className="font-mono text-xs uppercase tracking-widest text-[#755b00] font-bold mt-4">Error 404</p>
          <h1 className="font-serif text-3xl font-bold text-[#14213d] mt-2">Página no encontrada</h1>
          <p className="font-sans text-sm text-[#4d4635] mt-3">
            La página que buscas no existe o fue movida. Verifica la dirección o vuelve al inicio.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="px-6 py-3 bg-[#c9a227] text-[#14213d] font-mono text-xs uppercase tracking-wider font-bold border border-[#a68a4d] hover:brightness-105 transition-all"
            >
              Volver al Inicio
            </Link>
            <Link
              to="/habitaciones"
              className="px-6 py-3 border border-[#14213d] text-[#14213d] font-mono text-xs uppercase tracking-wider font-bold hover:bg-[#eae8e3] transition-colors"
            >
              Ver Habitaciones
            </Link>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
