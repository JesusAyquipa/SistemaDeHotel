import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EDEBE6] flex items-center justify-center">
        <div className="text-[#755b00] font-mono animate-pulse">Verificando credenciales...</div>
      </div>
    );
  }

  if (!user) {
    // Redirigir al login si no hay usuario
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    // Comprobar si el usuario tiene al menos uno de los roles requeridos
    const hasRole = user.roles?.some(role => allowedRoles.includes(role));
    if (!hasRole) {
      // Redirigir si no tiene permiso (por ejemplo a una página de acceso denegado o home)
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
