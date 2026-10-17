import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import GuestLogin from '../pages/GuestLogin';
import { AuthContext } from '../context/AuthContext';

function WhereAmI() {
  const location = useLocation();
  return <p>Ruta actual: {location.pathname}{location.search}</p>;
}

function renderLogin({ loginResult, from } = {}) {
  const login = vi.fn().mockResolvedValue(loginResult);
  const register = vi.fn();
  const entry = { pathname: '/login', state: from ? { from } : undefined };
  render(
    <AuthContext.Provider value={{ user: null, loading: false, login, register }}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<GuestLogin />} />
          <Route path="*" element={<WhereAmI />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { login, register };
}

async function submit(email = 'recepcion@hotel.com', password = 'secreto123') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo Electrónico *'), email);
  await user.type(screen.getByLabelText('Contraseña *'), password);
  await user.click(screen.getByRole('button', { name: /Iniciar Sesión/ }));
}

describe('GuestLogin: redirección tras iniciar sesión', () => {
  it('recepcionista sin ruta de origen aterriza en /recepcionista/hoy', async () => {
    const { login } = renderLogin({ loginResult: { success: true, user: { roles: ['recepcionista'] } } });
    await submit();
    expect(login).toHaveBeenCalledWith({ email: 'recepcion@hotel.com', password: 'secreto123' });
    expect(await screen.findByText('Ruta actual: /recepcionista/hoy')).toBeInTheDocument();
  });

  it('admin aterriza en /admin/reservas', async () => {
    renderLogin({ loginResult: { success: true, user: { roles: ['admin'] } } });
    await submit('admin@hotel.com');
    expect(await screen.findByText('Ruta actual: /admin/reservas')).toBeInTheDocument();
  });

  it('vuelve a la ruta de origen (con query) si el rol tiene acceso', async () => {
    renderLogin({
      loginResult: { success: true, user: { roles: ['cliente'] } },
      from: { pathname: '/cliente/mis-reservas', search: '?tab=proximas' },
    });
    await submit('cliente@example.com');
    expect(await screen.findByText('Ruta actual: /cliente/mis-reservas?tab=proximas')).toBeInTheDocument();
  });

  it('ignora una ruta de origen a la que el rol no tiene acceso', async () => {
    renderLogin({
      loginResult: { success: true, user: { roles: ['cliente'] } },
      from: { pathname: '/admin/auditoria' },
    });
    await submit('cliente@example.com');
    expect(await screen.findByText('Ruta actual: /')).toBeInTheDocument();
  });

  it('muestra el error devuelto por el servidor y se queda en el login', async () => {
    renderLogin({ loginResult: { success: false, error: 'Credenciales incorrectas' } });
    await submit();
    expect(await screen.findByText('Credenciales incorrectas')).toBeInTheDocument();
    expect(screen.queryByText(/Ruta actual/)).not.toBeInTheDocument();
  });
});
