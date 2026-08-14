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
              to="/ping"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition shadow-indigo-600/30 shadow-lg flex items-center gap-2"
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
              <span className="text-emerald-400">✓</span> Migraciones iniciales (rooms, bookings, payments)
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
              <span className="text-emerald-400">✓</span> Tailwind CSS v4 Configurado
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Axios con BaseURL (http://localhost:8000/api)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Laravel Echo & WebSockets Client
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> React Router DOM
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Estructura modular (components, pages, services, context)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
