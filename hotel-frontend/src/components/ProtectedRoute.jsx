import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useContext(AuthContext);

  // Esperar mientras verificamos la sesión
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-300">
        Verificando acceso...
      </div>
    );
  }

  // Sin sesión -> login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Usuario autenticado pero sin rol permitido
  const hasAllowedRole =
    allowedRoles.length === 0 ||
    user.roles?.some((role) => allowedRoles.includes(role));

  if (!hasAllowedRole) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-slate-900 border border-red-900 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">⛔</div>

          <h1 className="text-2xl font-bold text-white">
            Acceso denegado
          </h1>

          <p className="text-slate-400 mt-3">
            Tu rol no tiene permisos para acceder a este módulo.
          </p>
        </div>
      </div>
    );
  }

  return children;
}