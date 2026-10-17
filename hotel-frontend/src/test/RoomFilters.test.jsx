import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoomFilters from '../components/RoomFilters';
import { getPublicRoomTypes } from '../services/roomTypeService';

vi.mock('../services/roomTypeService', () => ({
  getPublicRoomTypes: vi.fn(),
}));

const BASE = { bed_type: 'todos', room_type: 'todos', capacity: '', min_price: '', max_price: '', search: '', sort_by: 'price_asc' };

describe('RoomFilters', () => {
  beforeEach(() => {
    getPublicRoomTypes.mockResolvedValue([
      { slug: 'suite', name: 'Suite Presidencial' },
      { slug: 'doble', name: 'Doble Clásica' },
    ]);
  });

  it('carga los tipos de habitación reales desde la API', async () => {
    render(<RoomFilters filters={BASE} onFilterChange={vi.fn()} />);
    expect(await screen.findByRole('option', { name: 'Suite Presidencial' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Doble Clásica' })).toBeInTheDocument();
    expect(getPublicRoomTypes).toHaveBeenCalledTimes(1);
  });

  it('notifica los cambios de búsqueda y de tipo', async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    render(<RoomFilters filters={BASE} onFilterChange={onFilterChange} />);
    await screen.findByRole('option', { name: 'Suite Presidencial' });

    await user.type(screen.getByPlaceholderText(/Buscar por suite/), 'v');
    expect(onFilterChange).toHaveBeenCalledWith('search', 'v');

    await user.selectOptions(screen.getByLabelText('Tipo de habitación'), 'suite');
    expect(onFilterChange).toHaveBeenCalledWith('room_type', 'suite');
  });

  it('el botón "Limpiar filtros" solo aparece con filtros activos y restablece todo', async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<RoomFilters filters={BASE} onFilterChange={onFilterChange} />);
    expect(screen.queryByText('Limpiar filtros')).not.toBeInTheDocument();

    rerender(<RoomFilters filters={{ ...BASE, capacity: '2' }} onFilterChange={onFilterChange} />);
    await user.click(screen.getByText('Limpiar filtros'));
    expect(onFilterChange).toHaveBeenCalledWith(BASE);
  });

  it('los rangos de precio sugeridos fijan mínimo y máximo', async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    render(<RoomFilters filters={BASE} onFilterChange={onFilterChange} />);

    await user.click(screen.getByRole('button', { name: /Precios/ }));
    await user.click(screen.getByRole('button', { name: 'S/ 250 - S/ 450' }));
    expect(onFilterChange).toHaveBeenCalledWith('min_price', '250');
    expect(onFilterChange).toHaveBeenCalledWith('max_price', '450');
    expect(screen.getByLabelText('Min (S/)')).toBeInTheDocument();
  });
});
