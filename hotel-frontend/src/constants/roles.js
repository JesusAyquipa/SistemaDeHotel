// Roles existentes en el sistema: admin, recepcionista, cliente.
export const ROLES = {
  ADMIN: 'admin',
  RECEPCIONISTA: 'recepcionista',
  CLIENTE: 'cliente',
};

// Página de inicio de cada rol tras iniciar sesión.
export const ROLE_HOME = {
  admin: '/admin/reservas',
  recepcionista: '/recepcionista/hoy',
  cliente: '/',
};

export function homeForUser(user) {
  const roles = user?.roles || [];
  if (roles.includes(ROLES.ADMIN)) return ROLE_HOME.admin;
  if (roles.includes(ROLES.RECEPCIONISTA)) return ROLE_HOME.recepcionista;
  return ROLE_HOME.cliente;
}
