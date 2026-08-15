import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-900/40 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
        <div className="max-w-2xl">
          <span className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
            Proyecto Universitario Scrum
          </span>
          <h1 className="text-4xl font-extrabold text-white mt-4 leading-tight">
            Sistema de Gestión de Reservas de Hotel
          </h1>
          <p className="text-slate-300 mt-3 text-base leading-relaxed">
            Monorepo académico listo con <span className="text-indigo-400 font-semibold">Laravel 11 API REST</span> en el backend y <span className="text-cyan-400 font-semibold">React + Vite SPA</span> en el frontend.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              to="/recepcionista/huespedes/nuevo"
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-sm transition shadow-amber-500/30 shadow-lg flex items-center gap-2"
            >
              <span>🏨</span> Ver Pantalla: Registrar Huésped (Ledger UI)
            </Link>
            <Link
              to="/ping"
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-sm transition border border-slate-700 flex items-center gap-2"
            >
              <span>🚀</span> Probar Conexión API (/api/ping)
            </Link>
          </div>
        </div>
      </div>

      {/* Grid de Estado de Arquitectura */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backend Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>🔴</span> Backend: hotel-backend/
            </h2>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full font-mono border border-slate-700">
              Laravel 11 API
            </span>
          </div>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Laravel Sanctum (Autenticación SPA)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Spatie Permission (admin, recepcionista, cliente)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> MySQL Configurado (3306)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Laravel Reverb WebSockets
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Migraciones iniciales (rooms, bookings, payments, staff)
            </li>
          </ul>
        </div>

        {/* Frontend Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>🔵</span> Frontend: hotel-frontend/
            </h2>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full font-mono border border-slate-700">
              React + Vite SPA
            </span>
          </div>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Tailwind CSS v4 + Tema Stitch Integardo
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Pantalla /recepcionista/huespedes/nuevo
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Componentes Reutilizables (Sidebar, Toast, Form)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Menú Hamburguesa Responsive en Móvil
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> 100% Traducido al Español
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
