import { useState, useEffect, useMemo } from 'react';
import { getProducts } from '../../services/productService';

const CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'bebidas', label: 'Bebidas' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'servicios_spa', label: 'Spa' },
  { id: 'otros', label: 'Otros' },
];

export default function AddChargeModal({ isOpen, onClose, onAddCharge }) {
  const [productsList, setProductsList] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [category, setCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customConcept, setCustomConcept] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [showProductList, setShowProductList] = useState(false);
  const [stockError, setStockError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen]);

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const data = await getProducts({ active_only: true });
      setProductsList(data);
    } catch (err) {
      console.error('Error loading products for modal:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Filtered dropdown items
  const filteredProducts = useMemo(() => {
    return productsList.filter(p => {
      const matchCat = category === 'all' || p.category === category;
      const matchQuery = customConcept
        ? p.name.toLowerCase().includes(customConcept.toLowerCase())
        : true;
      return matchCat && matchQuery;
    });
  }, [productsList, category, customConcept]);

  if (!isOpen) return null;

  const total = quantity * (parseFloat(unitPrice) || 0);

  const handleSelectProduct = (prod) => {
    if (prod.stock <= 0 && prod.category !== 'servicios_spa') {
      setStockError(`El producto "${prod.name}" está agotado (Stock: 0).`);
      return;
    }

    setSelectedProduct(prod);
    setCustomConcept(prod.name);
    setUnitPrice(parseFloat(prod.price).toFixed(2));
    setStockError('');
    setShowProductList(false);

    // Validate quantity against available stock
    const qty = parseInt(quantity, 10) || 1;
    if (prod.category !== 'servicios_spa' && qty > prod.stock) {
      setStockError(`Stock insuficiente. Solo quedan ${prod.stock} unidades disponibles.`);
    }
  };

  const handleQuantityChange = (val) => {
    const qty = parseInt(val, 10) || 0;
    setQuantity(val);

    if (selectedProduct && selectedProduct.category !== 'servicios_spa') {
      if (qty > selectedProduct.stock) {
        setStockError(`Stock insuficiente. Stock disponible: ${selectedProduct.stock}.`);
      } else {
        setStockError('');
      }
    } else {
      setStockError('');
    }
  };

  const handleConceptChange = (val) => {
    setCustomConcept(val);
    if (selectedProduct && selectedProduct.name !== val) {
      // User typed something custom
      setSelectedProduct(null);
      setStockError('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const conceptText = customConcept.trim();
    if (!conceptText || !unitPrice) return;

    const qty = parseInt(quantity, 10);
    if (qty <= 0) return;

    // Local validation for stock
    if (selectedProduct && selectedProduct.category !== 'servicios_spa' && qty > selectedProduct.stock) {
      setStockError(`No se puede registrar: Stock insuficiente (${selectedProduct.stock} disponibles).`);
      return;
    }

    onAddCharge({
      product_id: selectedProduct ? selectedProduct.id : null,
      date: new Date().toISOString().split('T')[0],
      concept: selectedProduct ? selectedProduct.name : conceptText,
      quantity: qty,
      unitPrice: parseFloat(unitPrice),
      total: total
    });

    // Reset state
    setSelectedProduct(null);
    setCustomConcept('');
    setQuantity(1);
    setUnitPrice('');
    setStockError('');
    setShowProductList(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center font-sans text-[#2d2d2a] p-4">
      <div className="bg-[#F7F6F3] shadow-2xl border border-[#d1c5af] w-full max-w-lg relative flex flex-col rounded-xs overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 bg-[#ECEAE4] border-b border-[#d1c5af]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#987d35]">room_service</span>
            <h2 className="font-serif text-lg font-bold text-[#1b1c19]">Registrar Nuevo Consumo</h2>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-[#78716c] hover:text-[#1b1c19] transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {/* Categoría Selector */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase font-bold text-[#78716c] tracking-widest">
              Filtrar por Categoría
            </label>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-3 py-1 font-mono text-xs rounded-xs transition-colors ${
                    category === cat.id
                      ? 'bg-[#987d35] text-white font-bold'
                      : 'bg-[#e7e4dc] text-[#554f43] hover:bg-[#dcd8ce]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Producto / Servicio Input with Autocomplete */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[10px] uppercase font-bold text-[#78716c] tracking-widest">
                Producto o Servicio *
              </label>
              {selectedProduct && selectedProduct.category !== 'servicios_spa' && (
                <span className={`font-mono text-[11px] font-bold ${
                  selectedProduct.stock > 0 ? 'text-[#15803d]' : 'text-[#b91c1c]'
                }`}>
                  Stock disponible: {selectedProduct.stock} un.
                </span>
              )}
            </div>
            
            <div className="relative">
              <input 
                type="text" 
                value={customConcept}
                onChange={(e) => handleConceptChange(e.target.value)}
                onFocus={() => setShowProductList(true)}
                placeholder="Seleccionar del catálogo o escribir concepto personalizado..." 
                required
                className="w-full bg-[#fbfaf8] border border-[#d1c5af] p-2.5 pr-8 text-xs font-mono text-[#1b1c19] focus:border-[#987d35] focus:outline-none rounded-xs"
              />
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-[#78716c] pointer-events-none">
                search
              </span>
              
              {showProductList && (
                <div 
                  className="absolute top-full left-0 w-full bg-white border border-[#d1c5af] shadow-xl z-20 max-h-52 overflow-y-auto mt-1 rounded-xs"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {loadingProducts ? (
                    <div className="p-3 text-xs font-mono text-[#78716c] text-center">Cargando catálogo...</div>
                  ) : filteredProducts.length > 0 ? (
                    filteredProducts.map((prod) => {
                      const isSpa = prod.category === 'servicios_spa';
                      const isOutOfStock = !isSpa && prod.stock <= 0;

                      return (
                        <div 
                          key={prod.id}
                          className={`px-3 py-2.5 border-b border-[#f1efe9] text-xs font-mono flex items-center justify-between transition-colors ${
                            isOutOfStock
                              ? 'bg-[#fef2f2] opacity-60 cursor-not-allowed text-[#991b1b]'
                              : 'hover:bg-[#f5f3ee] cursor-pointer text-[#1b1c19]'
                          }`}
                          onClick={() => handleSelectProduct(prod)}
                        >
                          <div className="flex flex-col">
                            <span className="font-bold">{prod.name}</span>
                            <span className="text-[10px] text-[#78716c] uppercase">
                              {prod.category} {isSpa ? '• Servicio' : `• Stock: ${prod.stock}`}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[#987d35] font-bold block">
                              S/ {parseFloat(prod.price).toFixed(2)}
                            </span>
                            {isOutOfStock && (
                              <span className="text-[10px] text-[#b91c1c] font-bold uppercase">
                                Agotado
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-3 py-3 text-xs font-mono text-[#78716c] italic text-center">
                      No coincide con el catálogo. Se registrará como concepto libre.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Warning Stock Error */}
          {stockError && (
            <div className="bg-[#fee2e2] border border-[#fecaca] text-[#b91c1c] px-3 py-2 text-xs font-mono rounded-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{stockError}</span>
            </div>
          )}

          {/* Cantidad y Precio */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase font-bold text-[#78716c] tracking-widest">
                Cantidad *
              </label>
              <input 
                type="number" 
                min="1"
                max={selectedProduct && selectedProduct.category !== 'servicios_spa' ? selectedProduct.stock : undefined}
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                required
                className="w-full bg-[#fbfaf8] border border-[#d1c5af] p-2 text-xs font-mono text-[#1b1c19] focus:border-[#987d35] focus:outline-none rounded-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase font-bold text-[#78716c] tracking-widest">
                Precio Unitario (S/) *
              </label>
              <input 
                type="number" 
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                required
                className="w-full bg-[#fbfaf8] border border-[#d1c5af] p-2 text-xs font-mono text-[#1b1c19] focus:border-[#987d35] focus:outline-none rounded-xs"
              />
            </div>
          </div>

          <hr className="border-t border-dashed border-[#d1c5af] my-1" />

          {/* Total Display */}
          <div className="flex justify-between items-end py-1">
            <span className="font-serif text-sm font-bold text-[#2d2d2a]">Total a Cargar:</span>
            <span className="font-serif text-2xl font-bold text-[#987d35]">
              S/ {total.toFixed(2)}
            </span>
          </div>

          {/* Footer / Buttons */}
          <div className="flex justify-between items-center bg-[#ECEAE4] -mx-6 -mb-6 p-4 border-t border-[#d1c5af] mt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="font-mono text-xs font-bold uppercase tracking-wider text-[#78716c] hover:text-[#2d2d2a] px-3 py-2 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={Boolean(stockError)}
              className="bg-[#987d35] hover:bg-[#7a642a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-mono text-xs font-bold uppercase tracking-widest px-6 py-2.5 transition-colors shadow-sm rounded-xs cursor-pointer"
            >
              Agregar a la Cuenta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
