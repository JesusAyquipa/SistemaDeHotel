import { useState } from 'react';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import AppRoutes from './routes/AppRoutes';

function MainLayout({ children, pingStatus }) {
  const location = useLocation();

  // Si la ruta es del panel de recepcionista o staff, o la página de catálogo con su propio PublicHeader/PublicFooter
  const isStaffRoute = location.pathname.startsWith('/recepcionista') || location.pathname.startsWith('/staff');
  const isStandalonePublicRoute = location.pathname.startsWith('/habitaciones') || location.pathname === '/login';

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

export default function App() {
  const [pingStatus, setPingStatus] = useState(null);

  return (
    <Router>
      <MainLayout pingStatus={pingStatus}>
        <AppRoutes pingStatus={pingStatus} setPingStatus={setPingStatus} />
      </MainLayout>
    </Router>
  );
}
