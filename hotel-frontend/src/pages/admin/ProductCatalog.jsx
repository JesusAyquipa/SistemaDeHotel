import { useState, useEffect, useCallback } from 'react';
import StaffSidebar from '../../components/StaffSidebar';
import Toast from '../../components/Toast';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../../services/productService';

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

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'snacks',
    price: '',
    stock: 0,
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (categoryFilter !== 'todos') filters.category = categoryFilter;
      if (search.trim()) filters.search = search;

      const data = await getProducts(filters);
      setProducts(data || []);
    } catch (err) {
      console.error('Error al cargar productos:', err);
      showNotification('❌ Error al cargar los productos');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const showNotification = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
  };

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      category: 'snacks',
      price: '',
      stock: 10,
      is_active: true,
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
      stock: prod.stock,
      is_active: prod.is_active,
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
        await updateProduct(editingProduct.id, formData);
        showNotification('✅ Producto actualizado correctamente');
      } else {
        await createProduct(formData);
        showNotification('✅ Producto creado correctamente');
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      console.error('Error al guardar producto:', err);
      const msg = err.response?.data?.message || 'Error al guardar el producto.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Estás seguro de eliminar el producto "${name}"?`)) return;

    try {
      await deleteProduct(id);
      showNotification('🗑️ Producto eliminado correctamente');
      fetchProducts();
    } catch (err) {
      console.error('Error al eliminar producto:', err);
      showNotification('❌ No se pudo eliminar el producto');
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
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre..."
                className="w-full border-b border-[#78716c] pb-1 text-sm bg-transparent focus:outline-none pl-6"
              />
              <span className="material-symbols-outlined absolute left-0 top-0 text-gray-400 text-lg">
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
              <table className="w-full text-left border-collapse">
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
                        S/ {parseFloat(prod.price).toFixed(2)}
                      </td>
                      <td className="p-4 text-center font-mono text-xs">
                        <span className={`px-2 py-0.5 rounded ${prod.stock > 5 ? 'bg-emerald-50 text-emerald-700 font-semibold' : prod.stock > 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700 font-bold'}`}>
                          {prod.stock} unids
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${prod.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>
                          {prod.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(prod)}
                          className="p-1.5 text-gray-600 hover:text-[#c9a227] transition-colors"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(prod.id, prod.name)}
                          className="p-1.5 text-gray-600 hover:text-red-600 transition-colors"
                          title="Eliminar"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
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
          <div className="bg-white w-full max-w-md p-6 shadow-xl border border-gray-200 animate-in fade-in duration-200">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-200">
              <h2 className="font-serif text-xl font-bold text-[#2d2d2a]">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-mono">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-[#78716c] mb-1">
                  Nombre del Producto / Servicio *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Inka Kola 500ml, Masaje Relajante"
                  className="w-full border border-gray-300 p-2 text-sm focus:outline-none focus:border-[#c9a227]"
                  required
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-[#78716c] mb-1">
                  Categoría *
                </label>
                <select
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
                  <label className="block font-mono text-[11px] uppercase font-bold text-[#78716c] mb-1">
                    Precio (S/) *
                  </label>
                  <input
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
                <div>
                  <label className="block font-mono text-[11px] uppercase font-bold text-[#78716c] mb-1">
                    Stock Disponible
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full border border-gray-300 p-2 text-sm font-mono focus:outline-none focus:border-[#c9a227]"
                  />
                </div>
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

      <Toast message={toastMessage} show={showToast} onClose={() => setShowToast(false)} />
    </div>
  );
}
