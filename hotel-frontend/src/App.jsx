import { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';

<<<<<<< HEAD
=======
function MainLayout({ children, pingStatus }) {
  const location = useLocation();

  // Si la ruta es del panel de recepcionista, admin o staff, o la página de catálogo con su propio PublicHeader/PublicFooter
  const isStaffRoute = location.pathname.startsWith('/recepcionista') || location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff');
  const isStandalonePublicRoute = location.pathname.startsWith('/habitaciones') || location.pathname === '/login' || location.pathname.startsWith('/cliente') || location.pathname === '/mis-reservas';

  if (isStaffRoute || isStandalonePublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar pingStatus={pingStatus} />
      <main className="flex-1 py-8">{children}</main>
      <footer className="bg-slate-900 border-t border-slate-800 text-center py-4 text-xs text-slate-500">
        Monorepo Sistema de Reservas de Hotel • Equipo 3 Personas (Scrum)
      </footer>
    </div>
  );
}

>>>>>>> 437319e6f6f6b7efdb5a3d32b0394d6486dfc930
export default function App() {
  const [pingStatus, setPingStatus] = useState(null);

  return (
    <Router>
      <AppRoutes pingStatus={pingStatus} setPingStatus={setPingStatus} />
    </Router>
  );
}
