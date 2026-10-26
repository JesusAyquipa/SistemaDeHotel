import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../services/api';
import { normalizeCashSessionList } from '../services/cashSessionService';
import { getStaffMembers } from '../services/staffService';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() },
}));

const rows = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

describe('normalizeCashSessionList: rango mostrado', () => {
  it('usa meta.from / meta.to cuando vienen del servidor', () => {
    const res = normalizeCashSessionList({
      data: rows(5),
      meta: { current_page: 3, last_page: 3, per_page: 20, total: 45, from: 41, to: 45, totals: { expected_amount: 10 } },
    });
    expect(res.pagination).toEqual({ current_page: 3, last_page: 3, total: 45, from: 41, to: 45 });
    expect(res.totals.expected).toBe(10);
  });

  it('si faltan, los calcula con current_page y per_page', () => {
    const res = normalizeCashSessionList({
      data: rows(20),
      meta: { current_page: 2, last_page: 3, per_page: 20, total: 45 },
    });
    expect(res.pagination.from).toBe(21);
    expect(res.pagination.to).toBe(40);
  });

  it('sin resultados el rango es 0–0', () => {
    const res = normalizeCashSessionList({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });
    expect(res.pagination.from).toBe(0);
    expect(res.pagination.to).toBe(0);
  });
});

describe('getStaffMembers: filtro por empleado', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('pide admin,recepcionista al servidor y además filtra por roles en el cliente', async () => {
    api.get.mockResolvedValue({
      data: {
        data: [
          { id: 1, name: 'Admin', roles: ['admin'] },
          { id: 2, name: 'Recepción', roles: ['recepcionista'] },
          { id: 3, name: 'Cliente', roles: ['cliente'] },
          { id: 4, name: 'Sin rol', roles: [] },
          { id: 5, name: 'Legacy', primary_role: 'recepcionista' },
        ],
      },
    });
    const list = await getStaffMembers();
    expect(api.get).toHaveBeenCalledWith('/staff', { params: { role: 'admin,recepcionista' } });
    expect(list.map((u) => u.id)).toEqual([1, 2, 5]);
  });

  it('si el servidor rechaza el filtro (422), reintenta sin él y filtra en el cliente', async () => {
    api.get
      .mockRejectedValueOnce({ response: { status: 422, data: { message: 'role inválido' } } })
      .mockResolvedValueOnce({ data: { data: [{ id: 1, roles: ['admin'] }, { id: 3, roles: ['cliente'] }] } });
    const list = await getStaffMembers();
    expect(api.get).toHaveBeenLastCalledWith('/staff');
    expect(list.map((u) => u.id)).toEqual([1]);
  });

  it('propaga otros errores', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 500 } });
    await expect(getStaffMembers()).rejects.toEqual({ response: { status: 500 } });
  });
});
