import { useState } from 'react';
import { closeRegister } from '../../services/reportService';

export default function CloseRegisterModal({ onClose, onSuccess, expectedAmount = 0 }) {
  const [cashAmount, setCashAmount] = useState('');
  const [voucherAmount, setVoucherAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Calculate difference
  const numCash = Number(cashAmount) || 0;
  const numVoucher = Number(voucherAmount) || 0;
  const totalEntered = numCash + numVoucher;
  const difference = totalEntered - expectedAmount;

  const isDifferenceZero = Math.abs(difference) < 0.01;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await closeRegister({
        cash_amount: numCash,
        voucher_amount: numVoucher,
        expected_amount: expectedAmount,
        difference: difference,
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al procesar el cierre de caja.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="max-w-2xl w-full bg-[#fbf9f4] rounded-xl shadow-md p-6 relative overflow-y-auto max-h-[95vh]">
        {/* Decoración */}
        <div className="absolute -top-6 -left-6 w-24 h-24 bg-[#c9a227]/20 rounded-full blur-2xl z-0 pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6 border-b border-[#d1c5af] pb-2">
            <h1 className="font-serif font-bold text-2xl text-[#1b1c19]">
              Declaración de Caja
              <span className="block font-mono text-[10px] text-[#755b00] tracking-widest mt-1 uppercase font-bold">
                Cierre de Turno
              </span>
            </h1>
            <button onClick={onClose} className="text-[#4d4635] hover:text-[#1b1c19]">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="bg-[#ffdad6] text-[#93000a] p-3 text-xs font-mono font-bold mb-4 border border-[#ba1a1a]/30">
                {error}
              </div>
            )}

            <div className="bg-[#f5f3ee] rounded-lg p-6 mb-6 flex flex-col gap-2 shadow-sm border border-[#d1c5af]">
              <h2 className="font-serif font-bold text-[#4d4635] uppercase tracking-wider text-xs mb-2">Resumen del Turno</h2>
              <div className="flex justify-between items-center pb-2 border-b border-[#d1c5af]/50">
                <span className="font-mono text-xs text-[#1b1c19]">Fondo Inicial</span>
                <span className="font-mono text-sm text-[#1b1c19] font-bold">S/ 0.00</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#d1c5af]/50">
                <span className="font-mono text-xs text-[#1b1c19]">Ingresos en Sistema</span>
                <span className="font-mono text-sm text-[#1b1c19] font-bold">S/ {expectedAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-mono text-sm text-[#1b1c19] font-bold">Total Esperado</span>
                <span className="font-mono text-[#755b00] font-bold text-lg">S/ {expectedAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-6 mb-8">
              <div className="relative">
                <label className="block font-mono text-[11px] text-[#4d4635] uppercase font-bold mb-1" htmlFor="efectivo">
                  Efectivo en Gaveta
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[#4d4635]">S/</span>
                  <input 
                    id="efectivo" 
                    type="number" 
                    step="0.01"
                    min="0"
                    placeholder="0.00" 
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    required
                    className="w-full bg-[#fbf9f4] border-b-2 border-[#d1c5af] focus:border-[#755b00] outline-none py-3 pl-8 pr-4 font-mono text-sm text-[#1b1c19] transition-colors shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]" 
                  />
                </div>
              </div>

              <div className="relative">
                <label className="block font-mono text-[11px] text-[#4d4635] uppercase font-bold mb-1" htmlFor="vouchers">
                  Total en Vouchers (Visa/MC)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[#4d4635]">S/</span>
                  <input 
                    id="vouchers" 
                    type="number" 
                    step="0.01"
                    min="0"
                    placeholder="0.00" 
                    value={voucherAmount}
                    onChange={(e) => setVoucherAmount(e.target.value)}
                    required
                    className="w-full bg-[#fbf9f4] border-b-2 border-[#d1c5af] focus:border-[#755b00] outline-none py-3 pl-8 pr-4 font-mono text-sm text-[#1b1c19] transition-colors shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]" 
                  />
                </div>
              </div>

              <div className={`mt-4 p-4 rounded border relative overflow-hidden transition-colors ${isDifferenceZero ? 'bg-[#e8f5e9] border-[#81c784]' : 'bg-[#e4e2dd]/30 border-[#d1c5af]/50'}`}>
                <div className="relative flex justify-between items-center z-10">
                  <span className="font-mono text-xs font-bold text-[#4d4635] uppercase tracking-wider">
                    Diferencia {difference > 0.01 ? '(Sobrante)' : difference < -0.01 ? '(Faltante)' : '(Cuadre Perfecto)'}
                  </span>
                  <span className={`font-mono font-bold text-lg ${difference > 0.01 ? 'text-[#e65100]' : difference < -0.01 ? 'text-[#ba1a1a]' : 'text-[#2e7d32]'}`}>
                    S/ {difference > 0 ? '+' : ''}{difference.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#c9a227] text-[#14213d] font-mono text-sm font-bold py-4 px-6 uppercase tracking-wider shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] active:translate-y-[1px] transition-all hover:bg-[#c9a227]/90 rounded-sm flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Procesando...' : 'Confirmar Cierre de Caja'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
