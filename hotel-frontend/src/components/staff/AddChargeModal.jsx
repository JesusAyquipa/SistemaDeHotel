import { useState, useEffect } from 'react';
import { getProducts } from '../../services/productService';

const DEFAULT_PRODUCTS = {
  Frigobar: [
    { name: 'Agua Mineral', price: 5.00 },
    { name: 'Coca Cola', price: 6.00 },
    { name: 'Cerveza Local', price: 12.00 },
    { name: 'Snacks / Papas', price: 8.00 },
    { name: 'Chocolate', price: 7.00 },
    { name: 'Sublime', price: 8.00 },
  ],
  Restaurante: [
    { name: 'Desayuno Buffet', price: 45.00 },
    { name: 'Almuerzo Menú', price: 35.00 },
    { name: 'Cena a la Carta', price: 60.00 },
    { name: 'Botella de Vino', price: 85.00 },
    { name: 'Café / Té', price: 10.00 },
  ],
  Lavandería: [
    { name: 'Lavado por Pieza', price: 15.00 },
    { name: 'Lavado y Planchado (Traje)', price: 45.00 },
    { name: 'Planchado de Camisa', price: 10.00 },
  ],
  Spa: [
    { name: 'Masaje Relajante (60 min)', price: 120.00 },
    { name: 'Sesión Sauna', price: 50.00 },
    { name: 'Facial Hidratante', price: 90.00 },
  ],
  Otros: [
    { name: 'Transporte al Aeropuerto', price: 75.00 },
    { name: 'Cama Adicional', price: 100.00 },
    { name: 'Late Check-out', price: 150.00 },
  ]
};

const CATEGORY_ALLOWED_MAP = {
  Frigobar: ['snacks', 'bebidas'],
  Restaurante: ['bebidas', 'otros'],
  Spa: ['servicios_spa'],
  Lavandería: ['lavanderia'],
  Otros: ['otros'],
};

export default function AddChargeModal({ isOpen, onClose, onAddCharge }) {
  const [category, setCategory] = useState('Frigobar');
  const [product, setProduct] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [showProductList, setShowProductList] = useState(false);
  const [dbProducts, setDbProducts] = useState([]);

  useEffect(() => {
    if (isOpen) {
      getProducts()
        .then((data) => {
          if (data && data.length > 0) {
            setDbProducts(data);
          }
        })
        .catch((err) => console.warn('Usando catálogo estático:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const total = quantity * (parseFloat(unitPrice) || 0);

  // Obtener la lista filtrada de productos (BD o fallback local)
  const getCurrentCategoryProducts = () => {
    if (dbProducts.length > 0) {
      const allowedCats = CATEGORY_ALLOWED_MAP[category] || ['otros'];
      const filtered = dbProducts.filter((p) => allowedCats.includes(p.category) && p.is_active);
      if (filtered.length > 0) {
        return filtered.map((p) => ({ id: p.id, name: p.name, price: parseFloat(p.price) }));
      }
    }
    return DEFAULT_PRODUCTS[category] || [];
  };

  const availableProducts = getCurrentCategoryProducts();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!product.trim() || !unitPrice) return;
    
    onAddCharge({
      date: new Date().toISOString().split('T')[0],
      product_id: selectedProductId,
      concept: `${category} - ${product}`,
      quantity: parseInt(quantity, 10),
      unitPrice: parseFloat(unitPrice),
      total: total
    });
    
    // Reset
    setCategory('Frigobar');
    setProduct('');
    setSelectedProductId(null);
    setQuantity(1);
    setUnitPrice('');
    setShowProductList(false);
    onClose();
  };

  const handleCategoryChange = (e) => {
    setCategory(e.target.value);
    setProduct('');
    setSelectedProductId(null);
    setUnitPrice('');
  };

  const handleSelectProduct = (prod) => {
    setProduct(prod.name);
    setSelectedProductId(prod.id || null);
    setUnitPrice(prod.price);
    setShowProductList(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center font-sans text-[#2d2d2a]">
      <div className="bg-white shadow-xl border border-gray-200 w-full max-w-md relative flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h2 className="font-serif text-lg font-bold">Registrar Nuevo Consumo</h2>
          <button onClick={onClose} className="text-[#a39f96] hover:text-[#2d2d2a] transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase font-bold text-[#78716c] tracking-widest">Categoría</label>
            <select 
              value={category}
              onChange={handleCategoryChange}
              className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none cursor-pointer"
            >
              <option value="Frigobar">Frigobar</option>
              <option value="Restaurante">Restaurante</option>
              <option value="Spa">Spa</option>
              <option value="Lavandería">Lavandería</option>
              <option value="Otros">Otros</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase font-bold text-[#78716c] tracking-widest">Producto / Servicio</label>
            <div className="relative">
              <input 
                type="text" 
                value={product}
                onChange={(e) => {
                  setProduct(e.target.value);
                  setSelectedProductId(null);
                }}
                onFocus={() => setShowProductList(true)}
                onBlur={() => setTimeout(() => setShowProductList(false), 200)}
                placeholder="Seleccionar o escribir producto..." 
                required
                className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 pr-8 text-xs font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none"
              />
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-sm text-[#78716c] pointer-events-none">search</span>
              
              {showProductList && (
                <div className="absolute top-full left-0 w-full bg-white border border-[#d1c5af] shadow-lg z-10 max-h-40 overflow-y-auto mt-1">
                  {availableProducts.filter(p => p.name.toLowerCase().includes(product.toLowerCase())).map((prod, idx) => (
                    <div 
                      key={idx}
                      className="px-3 py-2 hover:bg-[#eae8e3] cursor-pointer text-xs font-mono text-[#1b1c19] flex justify-between"
                      onClick={() => handleSelectProduct(prod)}
                    >
                      <span>{prod.name}</span>
                      <span className="text-[#987d35]">S/ {prod.price.toFixed(2)}</span>
                    </div>
                  ))}
                  {availableProducts.filter(p => p.name.toLowerCase().includes(product.toLowerCase())).length === 0 && (
                     <div className="px-3 py-2 text-xs font-mono text-[#78716c] italic">Puedes escribir un concepto personalizado</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase font-bold text-[#78716c] tracking-widest">Cantidad</label>
              <input 
                type="number" 
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase font-bold text-[#78716c] tracking-widest">Precio Unitario (S/)</label>
              <input 
                type="number" 
                step="0.10"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                required
                className="w-full bg-[#fbf9f4] border border-[#d1c5af] p-2 text-xs font-mono text-[#1b1c19] focus:border-[#14213d] focus:outline-none"
              />
            </div>
          </div>

          <hr className="border-t border-dashed border-[#d1c5af] my-2" />

          <div className="flex justify-between items-end mb-4">
            <span className="font-serif text-sm font-bold text-[#2d2d2a]">Total a Cargar:</span>
            <span className="font-serif text-2xl font-bold text-[#987d35]">S/ {total.toFixed(2)}</span>
          </div>

          {/* Footer / Buttons */}
          <div className="flex justify-between items-center bg-[#f5f3ee] -mx-6 -mb-6 p-4 border-t border-[#d1c5af] mt-auto">
            <button 
              type="button" 
              onClick={onClose}
              className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#78716c] hover:text-[#2d2d2a] px-4 py-2 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="bg-[#987d35] hover:bg-[#7a642a] text-white font-mono text-[10px] font-bold uppercase tracking-widest px-6 py-2.5 transition-colors shadow-sm"
            >
              Agregar a la Cuenta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
