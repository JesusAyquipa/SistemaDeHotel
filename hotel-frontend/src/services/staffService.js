import api from './api';

/** Roles del personal que opera caja / recepción. */
export const STAFF_ROLES = ['admin', 'recepcionista'];

/**
 * Lista de cuentas del personal.
 * @param {{ role?: string }} [filters] role admite una lista separada por comas (p. ej. "admin,recepcionista").
 */
export const getStaff = async (filters = {}) => {
  const response = filters.role
    ? await api.get('/staff', { params: { role: filters.role } })
    : await api.get('/staff');
  return response.data.data;
};

/**
 * Personal con rol admin o recepcionista (para filtros por empleado).
 * Pide el filtro al servidor y además filtra en el cliente por roles, por si el servidor
 * lo ignora o devuelve otros roles. Si el servidor rechaza el filtro (422), reintenta sin él.
 */
export const getStaffMembers = async () => {
  let list;
  try {
    list = await getStaff({ role: STAFF_ROLES.join(',') });
  } catch (err) {
    if (err?.response?.status !== 422) throw err;
    list = await getStaff();
  }
  return (Array.isArray(list) ? list : []).filter((u) => {
    const roles = Array.isArray(u?.roles)
      ? u.roles.map((r) => (typeof r === 'string' ? r : r?.name))
      : [u?.primary_role].filter(Boolean);
    return roles.some((r) => STAFF_ROLES.includes(r));
  });
};

export const createStaff = async (staffData) => {
  const response = await api.post('/staff', staffData);
  return response.data;
};

export const updateStaff = async (id, staffData) => {
  const response = await api.put(`/staff/${id}`, staffData);
  return response.data;
};

export const toggleStaffStatus = async (id) => {
  const response = await api.patch(`/staff/${id}/toggle-status`);
  return response.data;
};
