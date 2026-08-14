import { Link } from 'react-router-dom';

export default function Navbar({ pingStatus }) {
  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center space-x-3">
        <div className="bg-indigo-600 p-2 rounded-xl text-white font-bold text-xl shadow-indigo-500/20 shadow-lg">
          🏨
        </div>
        <div>
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            HotelReservas
          </span>
          <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            Monorepo Architecture
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        <Link to="/" className="text-slate-300 hover:text-white transition font-medium text-sm">
          Inicio
        </Link>
        <Link to="/ping" className="text-slate-300 hover:text-white transition font-medium text-sm">
          Test Conexión API
        </Link>

        {/* API Status Badge */}
        <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">
          <span className={`w-2.5 h-2.5 rounded-full ${pingStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
          <span className="text-xs font-semibold text-slate-300">
            {pingStatus?.connected ? 'API Conectada' : 'Servidor Pendiente'}
          </span>
        </div>
      </div>
    </nav>
  );
}
