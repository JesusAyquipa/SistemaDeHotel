import { useState, useEffect, useCallback } from 'react';
import StaffSidebar from '../../components/StaffSidebar';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../../services/productService';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import useEscapeKey from '../../hooks/useEscapeKey';
import formatCurrency from '../../utils/formatCurrency';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';

const CATEGORIES = [
  { id: 'todos', label: 'Todos' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'bebidas', label: 'Bebidas' },
  { id: 'servicios_spa', label: 'Servicios de Spa' },
  { id: 'lavanderia', label: 'Lavandería' },
  { id: 'otros', label: 'Otros' },
];

export default function ProductCatalog() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  // Toast
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'snacks',
    price: '',
    stock: 0,
    is_active: true,
    tracks_stock: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (categoryFilter !== 'todos') filters.category = categoryFilter;
      if (debouncedSearch.trim()) filters.search = debouncedSearch.trim();

      const data = await getProducts(filters);
      setProducts(data || []);
    } catch (err) {
      logError('products:list', err);
      setToast({ type: 'error', message: apiErrorMessage(err, 'Error al cargar los productos') });
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, debouncedSearch]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const showNotification = (message, type = 'success') => setToast({ message, type });

  useEscapeKey(() => { if (!submitting) setIsModalOpen(false); }, isModalOpen);

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      category: 'snacks',
      price: '',
      stock: 10,
      is_active: true,
      tracks_stock: true,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (prod) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name,
      category: prod.category,
      price: prod.price,
      stock: prod.stock ?? 0,
      is_active: prod.is_active,
      tracks_stock: prod.tracks_stock ?? true,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('El nombre del producto es requerido.');
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      setFormError('El precio debe ser un número mayor a 0.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, { ...formData, stock: formData.tracks_stock ? formData.stock : 0 });
        showNotification('Producto actualizado correctamente');
      } else {
        await createProduct({ ...formData, stock: formData.tracks_stock ? formData.stock : 0 });
        showNotification('Producto creado correctamente');
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      logError('products:save', err);
      setFormError(apiErrorMessage(err, 'Error al guardar el producto.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    try {
      await deleteProduct(target.id);
      showNotification('Producto eliminado correctamente');
      fetchProducts();
    } catch (err) {
      logError('products:delete', err);
      showNotification(apiErrorMessage(err, 'No se pudo eliminar el producto'), 'error');
    }
  };

  return (
    <div className="flex h-screen bg-[#e5e4de] text-[#1b1c19] font-sans overflow-hidden">
      <StaffSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="px-8 pt-8 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono tracking-widest text-[#78716c] uppercase font-bold mb-1">
              PANEL DE ADMINISTRACIÓN
            </p>
            <h1 className="font-serif text-3xl font-bold text-[#2d2d2a] tracking-tight">
              Catálogo de Productos y Servicios
            </h1>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="btn-primary text-xs py-2.5 px-5 cursor-pointer flex items-center gap-2 self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Nuevo Producto
          </button>
        </header>

        <main className="px-8 pb-8 flex-grow flex flex-col">
          {/* Barra de Filtros */}
          <div className="bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shadow-sm border border-gray-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#c9a227] tracking-widest uppercase mr-2">
                CATEGORÍA:
              </span>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                    categoryFilter === cat.id
                      ? 'bg-[#c9a227] text-white font-bold'
                      : 'bg-gray-100 text-[#78716c] hover:bg-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <label htmlFor="product-search" className="sr-only">Buscar producto</label>
              <input
                id="product-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre..."
                className="w-full border-b border-[#78716c] pb-1 text-sm bg-transparent focus:outline-none pl-6"
              />
              <span className="material-symbols-outlined absolute left-0 top-0 text-gray-400 text-lg" aria-hidden="true">
                search
              </span>
            </div>
          </div>

          {/* Tabla de Productos */}
          {loading ? (
            <div className="bg-white p-8 rounded shadow-sm animate-pulse flex justify-center text-gray-500 font-mono text-sm">
              Cargando productos...
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white p-12 text-center rounded shadow-sm border border-gray-200">
              <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">inventory_2</span>
              <p className="font-serif text-lg font-bold text-[#2d2d2a]">No se encontraron productos</p>
              <p className="text-xs text-[#78716c] mt-1">
                Añade nuevos productos usando el botón "Nuevo Producto".
              </p>
            </div>
          ) : (
            <div className="bg-white shadow-sm border border-gray-200 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#f5f3ee] border-b border-gray-200 font-mono text-[11px] text-[#78716c] uppercase tracking-wider">
                    <th className="p-4">ID</th>
                    <th className="p-4">Nombre</th>
                    <th className="p-4">Categoría</th>
                    <th className="p-4 text-right">Precio (S/)</th>
                    <th className="p-4 text-center">Stock</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {products.map((prod) => (
                    <tr key={prod.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-4 font-mono text-xs text-gray-400">#{prod.id}</td>
                      <td className="p-4 font-serif font-bold text-[#2d2d2a]">{prod.name}</td>
                      <td className="p-4">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 text-[#4d4635] capitalize">
                          {prod.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-[#2d2d2a]">
                        {formatCurrency(prod.price)}
                      </td>
                      <td className="p-4 text-center font-mono text-xs">
                        {prod.tracks_stock === false ? (
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">Servicio</span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded ${prod.stock > 5 ? 'bg-emerald-50 text-emerald-700 font-semibold' : prod.stock > 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700 font-bold'}`}>
                            {prod.stock} unids
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${prod.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>
                          {prod.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(prod)}
                          className="p-1.5 text-gray-600 hover:text-[#c9a227] transition-colors"
                          title="Editar"
                          aria-label={`Editar ${prod.name}`}
                        >
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(prod)}
                          className="p-1.5 text-gray-600 hover:text-red-600 transition-colors"
                          title="Eliminar"
                          aria-label={`Eliminar ${prod.name}`}
                        >
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Modal Crear / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="product-modal-title" className="bg-white w-full max-w-md p-6 shadow-xl border border-gray-200 animate-in fade-in duration-200">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-200">
              <h2 id="product-modal-title" className="font-serif text-xl font-bold text-[#2d2d2a]">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Cerrar"
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-mono">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="prod-1" className="block font-mono text-[11px] uppercase font-bold text-[#78716c] mb-1">
                  Nombre del Producto / Servicio *
                </label>
                <input id="prod-1"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Inka Kola 500ml, Masaje Relajante"
                  className="w-full border border-gray-300 p-2 text-sm focus:outline-none focus:border-[#c9a227]"
                  required
                />
              </div>

              <div>
                <label htmlFor="prod-2" className="block font-mono text-[11px] uppercase font-bold text-[#78716c] mb-1">
                  Categoría *
                </label>
                <select id="prod-2"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full border border-gray-300 p-2 text-sm focus:outline-none focus:border-[#c9a227] capitalize"
                >
                  <option value="snacks">Snacks (Frigobar)</option>
                  <option value="bebidas">Bebidas (Frigobar / Rest)</option>
                  <option value="servicios_spa">Servicios de Spa</option>
                  <option value="lavanderia">Lavandería</option>
                  <option value="otros">Otros</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="prod-3" className="block font-mono text-[11px] uppercase font-bold text-[#78716c] mb-1">
                    Precio (S/) *
                  </label>
                  <input id="prod-3"
                    type="number"
                    step="0.10"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    className="w-full border border-gray-300 p-2 text-sm font-mono focus:outline-none focus:border-[#c9a227]"
                    required
                  />
                </div>
                {formData.tracks_stock ? (
                <div>
                  <label htmlFor="prod-4" className="block font-mono text-[11px] uppercase font-bold text-[#78716c] mb-1">
                    Stock Disponible
                  </label>
                  <input id="prod-4"
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full border border-gray-300 p-2 text-sm font-mono focus:outline-none focus:border-[#c9a227]"
                  />
                </div>
                ) : (
                  <div className="font-mono text-[11px] text-[#78716c] self-end pb-2">Sin control de stock (servicio)</div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="tracks_stock"
                  checked={formData.tracks_stock}
                  onChange={(e) => setFormData({ ...formData, tracks_stock: e.target.checked })}
                  className="accent-[#c9a227] w-4 h-4"
                />
                <label htmlFor="tracks_stock" className="text-xs font-mono text-[#4d4635] cursor-pointer">
                  Controla stock (desmarcar para servicios)
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="accent-[#c9a227] w-4 h-4"
                />
                <label htmlFor="is_active" className="text-xs font-mono text-[#4d4635] cursor-pointer">
                  Producto activo para venta / consumo en recepción
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-mono border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs py-2 px-5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : editingProduct ? 'Actualizar' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast message={toast?.message} isOpen={!!toast} type={toast?.type} onClose={() => setToast(null)} />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar producto"
        message={deleteTarget ? `¿Estás seguro de eliminar el producto "${deleteTarget.name}"?` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
