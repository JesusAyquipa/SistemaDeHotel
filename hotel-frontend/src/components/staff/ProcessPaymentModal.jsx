import { useState, useEffect } from 'react';

export default function ProcessPaymentModal({ isOpen, onClose, onProcessPayment, totalAmount }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Efectivo');

  useEffect(() => {
    if (isOpen) {
      setAmount(totalAmount > 0 ? totalAmount.toFixed(2) : '');
      setMethod('Efectivo');
    }
  }, [isOpen, totalAmount]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    
    onProcessPayment({
      amount: parseFloat(amount),
      method: method
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1c19]/50 backdrop-blur-sm">
      <div className="bg-[#e5e4de] w-full max-w-md shadow-2xl overflow-hidden border border-[#d1c5af]">
        
        {/* Header */}
        <div className="bg-[#1b1c19] px-6 py-4 flex justify-between items-center">
          <h2 className="font-serif text-xl font-bold text-white tracking-widest uppercase">
            Procesar Pago
          </h2>
          <button onClick={onClose} className="text-[#a39f96] hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="bg-[#f5e0d8] border border-[#d32f2f] text-[#d32f2f] p-4 mb-6 font-mono text-xs flex justify-between items-center">
            <span className="font-bold tracking-widest uppercase">Monto a Pagar:</span>
            <span className="text-lg font-bold">${totalAmount.toFixed(2)}</span>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block font-mono text-xs font-bold text-[#a39f96] tracking-widest uppercase mb-2">
                Método de Pago
              </label>
              <select 
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full bg-white border border-[#d1c5af] text-[#2d2d2a] font-mono text-sm px-4 py-3 focus:outline-none focus:border-[#987d35] focus:ring-1 focus:ring-[#987d35] transition-all"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta de Crédito/Débito</option>
                <option value="Transferencia">Transferencia Bancaria</option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-xs font-bold text-[#a39f96] tracking-widest uppercase mb-2">
                Monto Recibido
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-[#a39f96]">$</span>
                <input 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  max={totalAmount > 0 ? totalAmount.toFixed(2) : undefined}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white border border-[#d1c5af] text-[#2d2d2a] font-mono text-sm pl-8 pr-4 py-3 focus:outline-none focus:border-[#987d35] focus:ring-1 focus:ring-[#987d35] transition-all"
                  required
                />
              </div>
              <p className="mt-1 font-mono text-[10px] text-[#78716c]">
                El monto no puede exceder el total de la cuenta.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-8 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 bg-white hover:bg-gray-50 border border-[#d1c5af] text-[#2d2d2a] font-mono text-xs font-bold uppercase tracking-widest py-3 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 bg-[#d32f2f] hover:bg-[#b71c1c] text-white font-mono text-xs font-bold uppercase tracking-widest py-3 transition-colors"
            >
              Confirmar Pago
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
