import { useState, useEffect, useMemo } from 'react';
import StaffSidebar from '../../components/StaffSidebar';
import Toast from '../../components/Toast';
import { 
  getProducts, 
  createProduct, 
  updateProduct, 
  deleteProduct 
} from '../../services/productService';

const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: 'apps' },
  { id: 'bebidas', label: 'Bebidas', icon: 'local_bar' },
  { id: 'snacks', label: 'Snacks', icon: 'fastfood' },
  { id: 'servicios_spa', label: 'Servicios Spa', icon: 'spa' },
  { id: 'otros', label: 'Otros Servicios', icon: 'room_service' },
];

export default function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Modal Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'bebidas',
    price: '',
    stock: 0,
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState({});

  // Delete confirmation modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error('Error fetching products:', err);
      showNotification('Error al cargar el catálogo de productos');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = products.length;
    const bebidas = products.filter(p => p.category === 'bebidas').length;
    const snacks = products.filter(p => p.category === 'snacks').length;
    const spa = products.filter(p => p.category === 'servicios_spa').length;
    const lowStock = products.filter(p => p.category !== 'servicios_spa' && p.stock < 10).length;
    return { total, bebidas, snacks, spa, lowStock };
  }, [products]);

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      name: '',
      category: activeCategory !== 'all' ? activeCategory : 'bebidas',
      price: '',
      stock: 10,
      is_active: true,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product) => {
    setIsEditing(true);
    setEditingId(product.id);
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      is_active: Boolean(product.is_active),
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'El nombre es obligatorio';
    if (!formData.category) errors.category = 'Seleccione una categoría';
    if (formData.price === '' || isNaN(formData.price) || parseFloat(formData.price) < 0) {
      errors.price = 'Ingrese un precio válido mayor o igual a 0';
    }
    if (formData.stock === '' || isNaN(formData.stock) || parseInt(formData.stock, 10) < 0) {
      errors.stock = 'El stock debe ser un número entero mayor o igual a 0';
    }
    return errors;
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock, 10),
        is_active: formData.is_active,
      };

      if (isEditing) {
        await updateProduct(editingId, payload);
        showNotification('Producto actualizado exitosamente');
      } else {
        await createProduct(payload);
        showNotification('Producto agregado al catálogo exitosamente');
      }

      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      console.error('Error saving product:', err);
      const msg = err.response?.data?.message || 'Error al guardar el producto';
      showNotification(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStockChange = async (product, delta) => {
    const newStock = Math.max(0, product.stock + delta);
    if (newStock === product.stock) return;

    try {
      // Optimistic update
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: newStock } : p));
      await updateProduct(product.id, { stock: newStock });
      showNotification(`Stock de "${product.name}" actualizado a ${newStock}`);
    } catch (err) {
      console.error('Error updating stock:', err);
      showNotification('Error al actualizar stock');
      fetchProducts();
    }
  };

  const handleToggleActive = async (product) => {
    const newStatus = !product.is_active;
    try {
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: newStatus } : p));
      await updateProduct(product.id, { is_active: newStatus });
      showNotification(`Producto "${product.name}" ${newStatus ? 'activado' : 'desactivado'}`);
    } catch (err) {
      console.error('Error toggling status:', err);
      showNotification('Error al cambiar estado del producto');
      fetchProducts();
    }
  };

  const handleDeleteClick = (product) => {
    setProductToDelete(product);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteProduct(productToDelete.id);
      showNotification(`"${productToDelete.name}" eliminado del catálogo`);
      setDeleteConfirmOpen(false);
      setProductToDelete(null);
      fetchProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      const msg = err.response?.data?.message || 'Error al eliminar el producto';
      showNotification(msg);
    }
  };

  const getCategoryBadge = (category) => {
    switch (category) {
      case 'bebidas':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]">
            <span className="material-symbols-outlined text-[13px]">local_bar</span>
            Bebidas
          </span>
        );
      case 'snacks':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#fef3c7] text-[#b45309] border border-[#fde68a]">
            <span className="material-symbols-outlined text-[13px]">fastfood</span>
            Snacks
          </span>
        );
      case 'servicios_spa':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#f3e8ff] text-[#7e22ce] border border-[#e9d5ff]">
            <span className="material-symbols-outlined text-[13px]">spa</span>
            Spa
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
            <span className="material-symbols-outlined text-[13px]">room_service</span>
            Otros
          </span>
        );
    }
  };

  return (
    <div className="bg-[#EDEBE6] text-[#1b1c19] antialiased h-screen flex flex-col md:flex-row overflow-hidden font-sans">
      <StaffSidebar />

      <main className="flex-1 p-4 sm:p-8 md:p-10 relative overflow-y-auto max-w-7xl mx-auto w-full">
        <Toast
          message={toastMessage}
          isOpen={showToast}
          onClose={() => setShowToast(false)}
        />

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl sm:text-4xl text-[#987d35]">
                inventory_2
              </span>
              <h2 className="font-serif font-bold text-2xl sm:text-3xl md:text-4xl text-[#1b1c19]">
                Catálogo de Productos y Servicios
              </h2>
            </div>
            <p className="font-mono text-xs text-[#6e685c] mt-1 tracking-wider uppercase">
              Gestión de inventario, stock y tarifas de consumo (SHE-013)
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 bg-[#987d35] hover:bg-[#7a642a] text-white px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            Nuevo Producto
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#F7F6F3] border border-[#d1c5af] p-4 rounded-xs shadow-sm">
            <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-widest block">
              Total Catálogo
            </span>
            <div className="flex items-center justify-between mt-2">
              <span className="font-serif text-3xl font-bold text-[#1b1c19]">{stats.total}</span>
              <span className="material-symbols-outlined text-[#987d35] text-2xl">category</span>
            </div>
          </div>

          <div className="bg-[#F7F6F3] border border-[#d1c5af] p-4 rounded-xs shadow-sm">
            <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-widest block">
              Bebidas & Snacks
            </span>
            <div className="flex items-center justify-between mt-2">
              <span className="font-serif text-3xl font-bold text-[#1b1c19]">{stats.bebidas + stats.snacks}</span>
              <span className="material-symbols-outlined text-[#0284c7] text-2xl">liquor</span>
            </div>
          </div>

          <div className="bg-[#F7F6F3] border border-[#d1c5af] p-4 rounded-xs shadow-sm">
            <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-widest block">
              Servicios de Spa
            </span>
            <div className="flex items-center justify-between mt-2">
              <span className="font-serif text-3xl font-bold text-[#1b1c19]">{stats.spa}</span>
              <span className="material-symbols-outlined text-[#7e22ce] text-2xl">spa</span>
            </div>
          </div>

          <div className="bg-[#F7F6F3] border border-[#d1c5af] p-4 rounded-xs shadow-sm">
            <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-widest block">
              Alerta Stock Bajo (&lt;10)
            </span>
            <div className="flex items-center justify-between mt-2">
              <span className={`font-serif text-3xl font-bold ${stats.lowStock > 0 ? 'text-[#b91c1c]' : 'text-[#15803d]'}`}>
                {stats.lowStock}
              </span>
              <span className={`material-symbols-outlined text-2xl ${stats.lowStock > 0 ? 'text-[#b91c1c]' : 'text-[#15803d]'}`}>
                warning
              </span>
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-[#F7F6F3] border border-[#d1c5af] p-4 rounded-xs shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-all cursor-pointer rounded-xs ${
                  activeCategory === cat.id
                    ? 'bg-[#987d35] text-white font-bold shadow-xs'
                    : 'bg-[#e5e3dc] text-[#554f43] hover:bg-[#dcd8cf]'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative min-w-[260px]">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#8c8270] text-sm">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre..."
              className="w-full bg-[#fbfaf8] border border-[#d1c5af] pl-9 pr-3 py-2 font-mono text-xs focus:outline-none focus:border-[#987d35] text-[#1b1c19] rounded-xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-[#8c8270] hover:text-[#1b1c19]"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-[#F7F6F3] border border-[#d1c5af] rounded-xs shadow-sm overflow-hidden mb-12">
          {loading ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-3xl animate-spin text-[#987d35]">
                progress_activity
              </span>
              <p className="font-mono text-xs text-[#78716c] mt-2">Cargando catálogo...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-[#a8a29e] mb-2">
                inventory
              </span>
              <p className="font-serif text-lg text-[#1b1c19]">No se encontraron productos</p>
              <p className="font-mono text-xs text-[#78716c] mt-1">
                {searchTerm ? 'Intenta con otro término de búsqueda' : 'Comienza agregando un nuevo ítem'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#ECEAE4] border-b border-[#d1c5af] font-mono text-[11px] uppercase tracking-wider text-[#575043]">
                    <th className="py-3 px-4">Producto / Servicio</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-right">Precio Unitario</th>
                    <th className="py-3 px-4 text-center">Stock Actual</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2dbce] font-sans text-sm">
                  {filteredProducts.map((prod) => {
                    const isSpa = prod.category === 'servicios_spa';
                    const isLow = !isSpa && prod.stock < 10 && prod.stock > 0;
                    const isOut = !isSpa && prod.stock === 0;

                    return (
                      <tr 
                        key={prod.id} 
                        className={`hover:bg-[#f1efe9] transition-colors ${!prod.is_active ? 'opacity-60 bg-[#eae7df]' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#1b1c19]">{prod.name}</div>
                          <span className="font-mono text-[10px] text-[#78716c]">ID: #{prod.id}</span>
                        </td>

                        <td className="py-3 px-4">
                          {getCategoryBadge(prod.category)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-[#1b1c19]">
                          S/ {parseFloat(prod.price).toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isSpa ? (
                            <span className="font-mono text-xs text-[#7e22ce] bg-[#f3e8ff] px-2 py-0.5 rounded-full font-bold">
                              Servicio (Bajo Demanda)
                            </span>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => handleQuickStockChange(prod, -1)}
                                disabled={prod.stock <= 0}
                                title="Disminuir stock en 1"
                                className="w-6 h-6 rounded bg-[#e2dec9] hover:bg-[#d1caa7] disabled:opacity-30 disabled:cursor-not-allowed text-[#4d4635] flex items-center justify-center font-bold text-xs"
                              >
                                -
                              </button>
                              
                              <span className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                isOut 
                                  ? 'bg-[#fee2e2] text-[#b91c1c] border border-[#fecaca]' 
                                  : isLow 
                                  ? 'bg-[#fef3c7] text-[#b45309] border border-[#fde68a]' 
                                  : 'bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0]'
                              }`}>
                                {isOut ? 'Agotado (0)' : `${prod.stock} un.`}
                              </span>

                              <button
                                onClick={() => handleQuickStockChange(prod, 1)}
                                title="Aumentar stock en 1"
                                className="w-6 h-6 rounded bg-[#e2dec9] hover:bg-[#d1caa7] text-[#4d4635] flex items-center justify-center font-bold text-xs"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleActive(prod)}
                            title="Cambiar estado activo/inactivo"
                            className={`font-mono text-xs px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                              prod.is_active
                                ? 'bg-[#e2f7e2] text-[#166534] border border-[#bbf7d0]'
                                : 'bg-[#f1f5f9] text-[#64748b] border border-[#cbd5e1]'
                            }`}
                          >
                            {prod.is_active ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleOpenEditModal(prod)}
                              className="p-1.5 text-[#554f43] hover:text-[#987d35] hover:bg-[#e6e2d8] rounded transition-colors"
                              title="Editar producto"
                            >
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteClick(prod)}
                              className="p-1.5 text-[#7A2E2E] hover:text-[#b91c1c] hover:bg-[#fee2e2] rounded transition-colors"
                              title="Eliminar producto"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Crear / Editar */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-[#F7F6F3] border border-[#d1c5af] shadow-2xl max-w-lg w-full rounded-xs overflow-hidden animate-in fade-in duration-200">
              <div className="bg-[#ECEAE4] border-b border-[#d1c5af] p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#987d35]">
                    {isEditing ? 'edit_note' : 'add_box'}
                  </span>
                  <h3 className="font-serif font-bold text-lg text-[#1b1c19]">
                    {isEditing ? 'Editar Producto / Servicio' : 'Registrar Nuevo Producto'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-[#6e685c] hover:text-[#1b1c19]"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-[#4d4635] mb-1 font-bold">
                    Nombre del Ítem *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Ej. Botella de Agua Mineral 500ml"
                    className={`w-full bg-[#fbfaf8] border p-2.5 font-sans text-sm focus:outline-none focus:border-[#987d35] rounded-xs ${
                      formErrors.name ? 'border-[#b91c1c]' : 'border-[#d1c5af]'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="text-[#b91c1c] font-mono text-xs mt-1">{formErrors.name}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#4d4635] mb-1 font-bold">
                      Categoría *
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full bg-[#fbfaf8] border border-[#d1c5af] p-2.5 font-sans text-sm focus:outline-none focus:border-[#987d35] rounded-xs"
                    >
                      <option value="bebidas">Bebidas</option>
                      <option value="snacks">Snacks</option>
                      <option value="servicios_spa">Servicios de Spa</option>
                      <option value="otros">Otros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#4d4635] mb-1 font-bold">
                      Precio (S/) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      className={`w-full bg-[#fbfaf8] border p-2.5 font-mono text-sm focus:outline-none focus:border-[#987d35] rounded-xs ${
                        formErrors.price ? 'border-[#b91c1c]' : 'border-[#d1c5af]'
                      }`}
                    />
                    {formErrors.price && (
                      <p className="text-[#b91c1c] font-mono text-xs mt-1">{formErrors.price}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#4d4635] mb-1 font-bold">
                      Stock Inicial / Disponible *
                    </label>
                    <input
                      type="number"
                      min="0"
                      name="stock"
                      value={formData.stock}
                      onChange={handleInputChange}
                      placeholder="0"
                      className={`w-full bg-[#fbfaf8] border p-2.5 font-mono text-sm focus:outline-none focus:border-[#987d35] rounded-xs ${
                        formErrors.stock ? 'border-[#b91c1c]' : 'border-[#d1c5af]'
                      }`}
                    />
                    {formErrors.stock && (
                      <p className="text-[#b91c1c] font-mono text-xs mt-1">{formErrors.stock}</p>
                    )}
                    <span className="font-mono text-[10px] text-[#78716c] block mt-0.5">
                      (Para servicios spa use 999 o stock ilimitado)
                    </span>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={formData.is_active}
                        onChange={handleInputChange}
                        className="w-4 h-4 accent-[#987d35]"
                      />
                      <span className="font-sans text-sm text-[#1b1c19] font-medium">
                        Habilitado para venta
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#d1c5af]">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-[#554f43] hover:bg-[#e5e2da] rounded-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-[#987d35] hover:bg-[#7a642a] text-white px-5 py-2 font-mono text-xs font-bold uppercase tracking-widest disabled:opacity-50 cursor-pointer shadow-sm rounded-xs"
                  >
                    {submitting ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Producto'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Confirmar Eliminación */}
        {deleteConfirmOpen && productToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-[#F7F6F3] border border-[#d1c5af] shadow-2xl max-w-md w-full p-6 rounded-xs">
              <div className="flex items-center gap-3 text-[#b91c1c] mb-4">
                <span className="material-symbols-outlined text-3xl">warning</span>
                <h3 className="font-serif font-bold text-lg text-[#1b1c19]">Confirmar Eliminación</h3>
              </div>
              <p className="font-sans text-sm text-[#4d4635] mb-6">
                ¿Está seguro de eliminar el producto{' '}
                <span className="font-bold text-[#1b1c19]">"{productToDelete.name}"</span>?
                Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-[#554f43] hover:bg-[#e5e2da] rounded-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="bg-[#b91c1c] hover:bg-[#991b1b] text-white px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest cursor-pointer rounded-xs"
                >
                  Sí, Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
