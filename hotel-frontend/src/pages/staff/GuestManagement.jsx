import { useCallback, useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StaffLayout from '../../components/StaffLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import Toast from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { listGuests, deleteGuest } from '../../services/guestService';
import { apiErrorMessage, apiStatus } from '../../utils/apiError';
import logError from '../../utils/logError';
import { formatDmy as formatDate } from '../../utils/dates';
import GuestFlags from '../../components/staff/GuestFlags';

const SORT_OPTIONS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'name', label: 'Apellido (A-Z)' },
  { value: 'stays', label: 'Más estadías' },
];

/**
 * Panel de huéspedes (SHE-024 / SHE-025).
 * Mismo componente para admin (/admin/huespedes) y recepción (/recepcionista/huespedes);
 * solo el administrador puede eliminar.
 */
export default function GuestManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.roles?.includes('admin');
  const basePath = isAdmin ? '/admin' : '/recepcionista';
  const searchId = useId();
  const sortId = useId();
  const flagId = useId();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sort, setSort] = useState('recent');
  const [flag, setFlag] = useState('');
  // La página se reinicia a 1 cuando cambian la búsqueda o el orden (sin efecto extra)
  const queryKey = `${debouncedSearch}|${sort}|${flag}`;
  const [pageState, setPageState] = useState({ key: queryKey, page: 1 });
  const page = pageState.key === queryKey ? pageState.page : 1;
  const setPage = (updater) => setPageState({
    key: queryKey,
    page: typeof updater === 'function' ? updater(page) : updater,
  });

  const [result, setResult] = useState({ data: [], total: 0, last_page: 1, from: 0, to: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    listGuests({ search: debouncedSearch, sort, page, flag }, { signal: controller.signal })
      .then((data) => setResult(data))
      .catch((err) => {
        if (controller.signal.aborted) return;
        logError('guests:index', err);
        setError(apiErrorMessage(err, 'No se pudo cargar el listado de huéspedes.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedSearch, sort, page, flag, reloadKey]);

  const openGuest = useCallback((id) => navigate(`${basePath}/huespedes/${id}`), [navigate, basePath]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await deleteGuest(toDelete.id);
      setToast({ open: true, message: res?.message || 'Huésped eliminado.', type: 'success' });
      setToDelete(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      logError('guests:delete', err);
      const fallback = apiStatus(err) === 409
        ? 'El huésped tiene reservas registradas y no puede eliminarse.'
        : 'No se pudo eliminar el huésped.';
      setToast({ open: true, message: apiErrorMessage(err, fallback), type: 'error' });
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const guests = result.data || [];

  return (
    <StaffLayout>
      <Toast
        isOpen={toast.open}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />

      <main className="p-4 md:p-10">
        <div className="bg-[#fbf9f4] border border-[#d1c5af] shadow-sm p-4 md:p-8 space-y-6">
          {/* Encabezado */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#d1c5af] pb-4">
            <div>
              <h1 className="font-serif text-3xl font-bold text-[#755b00] tracking-tight">Huéspedes</h1>
              <p className="font-sans text-sm text-[#4d4635] mt-1">
                Fichas de huéspedes registrados, historial de estadías y datos de contacto.
              </p>
            </div>
            <Link
              to={`${basePath}/huespedes/nuevo`}
              className="inline-flex items-center justify-center gap-2 bg-[#c9a227] text-[#14213d] border border-[#a68a4d] px-5 py-2.5 font-mono text-xs uppercase tracking-wider font-bold hover:brightness-105 transition-all"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">person_add</span>
              Nuevo huésped
            </Link>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor={searchId} className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                Buscar
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[#755b00] text-lg" aria-hidden="true">search</span>
                <input
                  id={searchId}
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre, apellido, correo o documento"
                  maxLength={100}
                  className="w-full bg-white border border-[#d1c5af] pl-9 pr-3 py-2 text-sm focus:border-[#14213d] focus:outline-none"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <label htmlFor={flagId} className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                Marca
              </label>
              <select
                id={flagId}
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                className="w-full bg-white border border-[#d1c5af] px-3 py-2 text-sm focus:border-[#14213d] focus:outline-none cursor-pointer"
              >
                <option value="">Todos</option>
                <option value="vip">Solo VIP</option>
                <option value="blacklisted">Lista negra</option>
              </select>
            </div>
            <div className="sm:w-56">
              <label htmlFor={sortId} className="block font-mono text-[11px] uppercase font-bold text-[#4d4635] mb-1">
                Ordenar por
              </label>
              <select
                id={sortId}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full bg-white border border-[#d1c5af] px-3 py-2 text-sm focus:border-[#14213d] focus:outline-none cursor-pointer"
              >
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div role="alert" className="bg-[#ffdad6] text-[#93000a] p-4 text-sm font-mono border border-[#ba1a1a]/30 flex items-center justify-between gap-4">
              <span>{error}</span>
              <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="underline font-bold cursor-pointer">
                Reintentar
              </button>
            </div>
          )}

          {/* Tabla */}
          <div className="overflow-x-auto border border-[#d1c5af] bg-white">
            <table className="w-full min-w-[760px] text-left border-collapse">
              <caption className="sr-only">Listado de huéspedes</caption>
              <thead>
                <tr className="bg-[#f0eee9] text-[#4d4635] font-mono text-[11px] uppercase tracking-widest border-b border-[#d1c5af]">
                  <th scope="col" className="p-3 font-bold">Huésped</th>
                  <th scope="col" className="p-3 font-bold">Documento</th>
                  <th scope="col" className="p-3 font-bold">Teléfono</th>
                  <th scope="col" className="p-3 font-bold text-center">Estadías</th>
                  <th scope="col" className="p-3 font-bold">Última estadía</th>
                  <th scope="col" className="p-3 font-bold">Registrado</th>
                  {isAdmin && <th scope="col" className="p-3 font-bold text-right"><span className="sr-only">Acciones</span></th>}
                </tr>
              </thead>
              <tbody className="text-sm text-[#1b1c19]">
                {loading && guests.length === 0 ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="border-b border-[#e4e2dd] animate-pulse">
                      <td colSpan={isAdmin ? 7 : 6} className="p-3"><div className="h-5 bg-[#e4e2dd]" /></td>
                    </tr>
                  ))
                ) : guests.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="p-10 text-center">
                      <span className="material-symbols-outlined text-4xl text-[#c9a227]" aria-hidden="true">person_search</span>
                      <p className="font-mono text-xs text-[#755b00] mt-2">
                        {debouncedSearch ? 'No se encontraron huéspedes con ese criterio.' : 'Aún no hay huéspedes registrados.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  guests.map((g) => (
                    <tr
                      key={g.id}
                      onClick={() => openGuest(g.id)}
                      className={`border-b border-[#e4e2dd] hover:bg-[#f5f3ee] transition-colors cursor-pointer ${loading ? 'opacity-60' : ''}`}
                    >
                      <td className="p-3">
                        <Link
                          to={`${basePath}/huespedes/${g.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-[#14213d] hover:text-[#755b00] hover:underline underline-offset-2"
                        >
                          {g.surname}, {g.name}
                        </Link>
                        {' '}<GuestFlags guest={g} compact />
                        <p className="font-mono text-[11px] text-[#4d4635] break-all">{g.email || '—'}</p>
                      </td>
                      <td className="p-3 font-mono text-xs whitespace-nowrap">
                        <span className="text-[#4d4635]">{g.document_type}</span> {g.document_number}
                      </td>
                      <td className="p-3 font-mono text-xs whitespace-nowrap">{g.phone || '—'}</td>
                      <td className="p-3 text-center font-mono font-bold">
                        {g.stays_count}
                        <span className="block font-normal text-[10px] text-[#4d4635]">{g.bookings_count} reservas</span>
                      </td>
                      <td className="p-3 font-mono text-xs whitespace-nowrap">{formatDate(g.last_stay)}</td>
                      <td className="p-3 font-mono text-xs whitespace-nowrap">{formatDate(g.created_at)}</td>
                      {isAdmin && (
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setToDelete(g); }}
                            disabled={g.bookings_count > 0}
                            title={g.bookings_count > 0 ? 'No se puede eliminar: tiene reservas' : 'Eliminar huésped'}
                            aria-label={`Eliminar a ${g.name} ${g.surname}`}
                            className="p-1.5 text-[#ba1a1a] hover:bg-[#ffdad6] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <nav className="flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs text-[#4d4635]" aria-label="Paginación de huéspedes">
            <p aria-live="polite">
              {result.total > 0
                ? `Mostrando ${result.from}–${result.to} de ${result.total} huéspedes`
                : 'Sin resultados'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 border border-[#d1c5af] hover:border-[#14213d] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">chevron_left</span>
                Anterior
              </button>
              <span>Página {result.current_page || page} de {result.last_page || 1}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(result.last_page || 1, p + 1))}
                disabled={page >= (result.last_page || 1) || loading}
                className="px-3 py-1.5 border border-[#d1c5af] hover:border-[#14213d] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
              >
                Siguiente
                <span className="material-symbols-outlined text-sm" aria-hidden="true">chevron_right</span>
              </button>
            </div>
          </nav>
        </div>
      </main>

      <ConfirmDialog
        isOpen={!!toDelete}
        title="Eliminar huésped"
        message={toDelete ? `¿Eliminar definitivamente la ficha de ${toDelete.name} ${toDelete.surname}? Esta acción no se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </StaffLayout>
  );
}
