import React, { useState } from 'react';

export default function NewCouponModal({ isOpen, onClose, onSave }) {
  const [code, setCode] = useState('');
  const [type, setType] = useState('percentage');
  const [value, setValue] = useState('');
  const [limit, setLimit] = useState('');
  const [expiry, setExpiry] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!code || !value || !expiry) return;
    
    onSave({
      code: code.toUpperCase(),
      discount_type: type,
      discount_value: parseFloat(value),
      expires_at: expiry,
      max_uses: limit ? parseInt(limit, 10) : null
    });
    
    // reset
    setCode('');
    setType('percentage');
    setValue('');
    setLimit('');
    setExpiry('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <div className="bg-[#fcfcfc] w-full max-w-[500px] shadow-2xl relative animate-fadeIn border border-[#d1c5af]">
        {/* Header */}
        <div className="bg-[#14213d] text-white p-4 flex justify-between items-center border-b-2 border-[#c9a227]">
          <h2 className="font-serif font-bold text-lg">Crear Cupón Promocional</h2>
          <button className="text-[#a39f96] hover:text-white transition-colors" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 bg-[#fbf9f4] flex flex-col gap-5">
           <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c] mb-1">
                    CÓDIGO DE CUPÓN *
                 </label>
                 <input 
                   type="text" 
                   required
                   placeholder="Ej. GOLDEN20"
                   value={code}
                   onChange={e => setCode(e.target.value.toUpperCase())}
                   className="w-full bg-white border border-[#d1c5af] p-2.5 text-sm font-sans text-[#2d2d2a] focus:border-[#c9a227] focus:outline-none uppercase"
                 />
              </div>
              <div>
                 <label className="block font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c] mb-1">
                    TIPO DE DESCUENTO *
                 </label>
                 <div className="relative">
                   <select 
                     value={type}
                     onChange={e => setType(e.target.value)}
                     className="w-full bg-white border border-[#d1c5af] p-2.5 text-sm font-sans text-[#2d2d2a] focus:border-[#c9a227] focus:outline-none appearance-none cursor-pointer"
                   >
                     <option value="percentage">Porcentaje</option>
                     <option value="fixed">Monto Fijo</option>
                   </select>
                   <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[#78716c] pointer-events-none text-sm">expand_more</span>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c] mb-1">
                    VALOR DEL DESCUENTO *
                 </label>
                 <input 
                   type="number" 
                   step="0.01"
                   min="0.01"
                   required
                   placeholder="Ej. 20"
                   value={value}
                   onChange={e => setValue(e.target.value)}
                   className="w-full bg-white border border-[#d1c5af] p-2.5 text-sm font-sans text-[#2d2d2a] focus:border-[#c9a227] focus:outline-none"
                 />
              </div>
              <div>
                 <label className="block font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c] mb-1">
                    LÍMITE DE USOS (Opcional)
                 </label>
                 <input 
                   type="number"
                   min="1"
                   placeholder="Ej. 50"
                   value={limit}
                   onChange={e => setLimit(e.target.value)}
                   className="w-full bg-white border border-[#d1c5af] p-2.5 text-sm font-sans text-[#2d2d2a] focus:border-[#c9a227] focus:outline-none"
                 />
              </div>
           </div>

           <div>
              <label className="block font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c] mb-1">
                 FECHA DE CADUCIDAD *
              </label>
              <input 
                type="date" 
                required
                value={expiry}
                onChange={e => setExpiry(e.target.value)}
                className="w-full bg-white border border-[#d1c5af] p-2.5 text-sm font-sans text-[#2d2d2a] focus:border-[#c9a227] focus:outline-none"
              />
           </div>

           <div className="flex justify-end gap-4 mt-4 border-t border-[#d1c5af] pt-4">
              <button 
                type="button"
                className="bg-transparent border border-[#525e7d] text-[#525e7d] font-mono text-[10px] uppercase tracking-widest font-bold py-2.5 px-6 hover:bg-[#eae8e3] transition-colors"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="bg-[#c9a227] text-[#14213d] font-mono text-[10px] uppercase tracking-widest font-bold py-2.5 px-6 hover:bg-[#a68a4d] transition-colors shadow-sm"
              >
                Crear Cupón
              </button>
           </div>
        </form>
      </div>
    </div>
  );
}
