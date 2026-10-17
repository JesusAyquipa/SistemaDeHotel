import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import { AuthContext } from '../context/AuthContext';

function LoginProbe() {
  const location = useLocation();
  return <p>Login (desde {location.state?.from?.pathname ?? '—'})</p>;
}

function renderAt(path, auth, allowedRoles) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<p>Inicio público</p>} />
          <Route path="/login" element={<LoginProbe />} />
          <Route
            path="/admin/reservas"
            element={(
              <ProtectedRoute allowedRoles={allowedRoles}>
                <p>Panel de reservas</p>
              </ProtectedRoute>
            )}
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ProtectedRoute', () => {
  it('muestra un indicador mientras se verifica la sesión', () => {
    renderAt('/admin/reservas', { user: null, loading: true }, ['admin']);
    expect(screen.getByText('Verificando credenciales...')).toBeInTheDocument();
    expect(screen.queryByText('Panel de reservas')).not.toBeInTheDocument();
  });

  it('redirige a /login sin usuario y conserva la ruta de origen', () => {
    renderAt('/admin/reservas', { user: null, loading: false }, ['admin']);
    expect(screen.getByText('Login (desde /admin/reservas)')).toBeInTheDocument();
  });

  it('redirige al inicio si el rol no está permitido', () => {
    renderAt('/admin/reservas', { user: { roles: ['recepcionista'] }, loading: false }, ['admin']);
    expect(screen.getByText('Inicio público')).toBeInTheDocument();
  });

  it('redirige al inicio a un cliente sin roles de personal', () => {
    renderAt('/admin/reservas', { user: { roles: ['cliente'] }, loading: false }, ['admin', 'recepcionista']);
    expect(screen.getByText('Inicio público')).toBeInTheDocument();
  });

  it('renderiza el contenido para un rol permitido', () => {
    renderAt('/admin/reservas', { user: { roles: ['admin'] }, loading: false }, ['admin']);
    expect(screen.getByText('Panel de reservas')).toBeInTheDocument();
  });

  it('sin allowedRoles basta con estar autenticado', () => {
    renderAt('/admin/reservas', { user: { roles: [] }, loading: false }, undefined);
    expect(screen.getByText('Panel de reservas')).toBeInTheDocument();
  });
});
