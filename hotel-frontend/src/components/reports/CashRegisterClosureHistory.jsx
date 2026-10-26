import { useState, useEffect, useCallback } from 'react';
import { getCashRegisterClosures } from '../../services/reportService';
import formatCurrency from '../../utils/formatCurrency';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';

export default function CashRegisterClosureHistory() {
  const [closures, setClosures] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClosure, setSelectedClosure] = useState(null);

  // Filtros
  const [userId, setUserId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchClosures = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getCashRegisterClosures({
        user_id: userId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });

      setClosures(data?.closures?.data || []);
      if (data?.staff_members) {
        setStaffMembers(data.staff_members);
      }
    } catch (err) {
      logError('reports:closures-history', err);
      setError(apiErrorMessage(err, 'No se pudo cargar el historial de cierres de caja.'));
    } finally {
      setLoading(false);
    }
  }, [userId, dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    fetchClosures();
  }, [fetchClosures]);

  const handleResetFilters = () => {
    setUserId('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('all');
  };

  // Métricas rápidas de auditoría
  const totalClosures = closures.length;
  const balancedCount = closures.filter((c) => Math.abs(c.difference) < 0.01).length;
  const discrepancyCount = totalClosures - balancedCount;
  const netDiscrepancy = closures.reduce((acc, c) => acc + (Number(c.difference) || 0), 0);

  return (
    <div className="bg-white shadow-xl mt-8 border border-[#d1c5af] relative z-10 overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-[#14213d] text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[#c9a227]">receipt_long</span>
            Historial de Cierres de Caja y Turnos
          </h3>
          <p className="font-mono text-xs text-[#d1c5af] mt-1">
            Auditoría de turnos cerrados por recepcionista para control de descuadres (SHE-015)
          </p>
        </div>
        <button
          type="button"
          onClick={fetchClosures}
          disabled={loading}
          className="self-start sm:self-auto bg-[#c9a227] hover:bg-[#b08d20] text-[#14213d] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>
            sync
          </span>
          Actualizar
        </button>
      </div>

      {/* Métricas de Auditoría */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-[#f5f3ee] border-b border-[#d1c5af]">
        <div className="bg-white p-4 rounded border border-[#d1c5af]/60 shadow-sm">
          <span className="block font-mono text-[10px] text-[#4d4635] uppercase tracking-wider">Cierres Auditados</span>
          <span className="font-mono text-2xl font-bold text-[#14213d]">{totalClosures}</span>
        </div>
        <div className="bg-white p-4 rounded border border-[#d1c5af]/60 shadow-sm">
          <span className="block font-mono text-[10px] text-[#2e7d32] uppercase tracking-wider">Cajas Cuadradas</span>
          <span className="font-mono text-2xl font-bold text-[#2e7d32]">{balancedCount}</span>
        </div>
        <div className="bg-white p-4 rounded border border-[#d1c5af]/60 shadow-sm">
          <span className="block font-mono text-[10px] text-[#c62828] uppercase tracking-wider">Con Descuadre</span>
          <span className="font-mono text-2xl font-bold text-[#c62828]">{discrepancyCount}</span>
        </div>
        <div className="bg-white p-4 rounded border border-[#d1c5af]/60 shadow-sm">
          <span className="block font-mono text-[10px] text-[#4d4635] uppercase tracking-wider">Descuadre Neto</span>
          <span className={`font-mono text-2xl font-bold ${netDiscrepancy === 0 ? 'text-[#2e7d32]' : netDiscrepancy > 0 ? 'text-[#c9a227]' : 'text-[#c62828]'}`}>
            {netDiscrepancy > 0 ? `+${formatCurrency(netDiscrepancy)}` : formatCurrency(netDiscrepancy)}
          </span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="p-4 bg-[#eae8e3] border-b border-[#d1c5af] flex flex-wrap gap-4 items-end">
        {/* Filtro Empleado */}
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="staff-filter" className="block font-mono text-[10px] text-[#4d4635] uppercase font-bold mb-1">
            Empleado / Cajero
          </label>
          <select
            id="staff-filter"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full bg-white border border-[#d1c5af] p-2 text-xs font-mono rounded text-[#1b1c19] focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
          >
            <option value="">Todos los empleados</option>
            {staffMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} ({member.email})
              </option>
            ))}
          </select>
        </div>

        {/* Fecha Desde */}
        <div className="min-w-[140px]">
          <label htmlFor="date-from-filter" className="block font-mono text-[10px] text-[#4d4635] uppercase font-bold mb-1">
            Desde
          </label>
          <input
            id="date-from-filter"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full bg-white border border-[#d1c5af] p-2 text-xs font-mono rounded text-[#1b1c19] focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
          />
        </div>

        {/* Fecha Hasta */}
        <div className="min-w-[140px]">
          <label htmlFor="date-to-filter" className="block font-mono text-[10px] text-[#4d4635] uppercase font-bold mb-1">
            Hasta
          </label>
          <input
            id="date-to-filter"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full bg-white border border-[#d1c5af] p-2 text-xs font-mono rounded text-[#1b1c19] focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
          />
        </div>

        {/* Estado de Cuadre */}
        <div className="min-w-[160px]">
          <label htmlFor="status-filter" className="block font-mono text-[10px] text-[#4d4635] uppercase font-bold mb-1">
            Auditoría de Descuadre
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-white border border-[#d1c5af] p-2 text-xs font-mono rounded text-[#1b1c19] focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
          >
            <option value="all">Todos los cierres</option>
            <option value="balanced">Solo Cuadrados (S/ 0.00)</option>
            <option value="discrepancy">Solo con Descuadre</option>
            <option value="deficit">Con Faltante (-S/)</option>
            <option value="surplus">Con Sobrante (+S/)</option>
          </select>
        </div>

        {(userId || dateFrom || dateTo || statusFilter !== 'all') && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="bg-transparent hover:bg-white text-[#4d4635] border border-[#d1c5af] px-3 py-2 text-xs font-mono rounded transition-colors cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-[#ffdad6] text-[#93000a] text-xs font-mono border-b border-[#ba1a1a]/30">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left border-collapse">
          <thead>
            <tr className="bg-[#f0eee9] text-[#4d4635] font-mono text-[11px] uppercase tracking-widest border-b border-[#d1c5af]">
              <th className="p-4 font-bold">Fecha / Hora Cierre</th>
              <th className="p-4 font-bold">Empleado</th>
              <th className="p-4 font-bold">Turno Auditado</th>
              <th className="p-4 font-bold text-right">Esperado Sistema</th>
              <th className="p-4 font-bold text-right">Declarado Físico</th>
              <th className="p-4 font-bold text-right">Diferencia</th>
              <th className="p-4 font-bold text-center">Estado</th>
              <th className="p-4 font-bold text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="font-sans text-sm text-[#1b1c19]">
            {loading ? (
              <tr>
                <td colSpan="8" className="p-8 text-center text-[#755b00] font-mono text-xs">
                  Cargando historial de cierres...
                </td>
              </tr>
            ) : closures.length === 0 ? (
              <tr>
                <td colSpan="8" className="p-8 text-center text-[#755b00] font-mono text-xs">
                  No se encontraron cierres de caja con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              closures.map((c) => {
                const diff = Number(c.difference);
                const isBalanced = Math.abs(diff) < 0.01;
                const isSurplus = diff > 0.01;

                return (
                  <tr key={c.id} className="border-b border-[#e4e2dd] hover:bg-[#fbf9f4] transition-colors">
                    <td className="p-4 font-mono text-xs whitespace-nowrap font-bold text-[#14213d]">
                      {c.closed_at}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-sm text-[#1b1c19]">{c.staff_name}</div>
                      <div className="font-mono text-[11px] text-[#4d4635]">{c.staff_email}</div>
                    </td>
                    <td className="p-4 font-mono text-xs text-[#4d4635] whitespace-nowrap">
                      <div>Desde: {c.opened_at || 'Inicio'}</div>
                      <div>Hasta: {c.closed_at}</div>
                    </td>
                    <td className="p-4 text-right font-mono text-xs font-bold text-[#4d4635] whitespace-nowrap">
                      {formatCurrency(c.expected_amount)}
                    </td>
                    <td className="p-4 text-right font-mono text-xs font-bold text-[#14213d] whitespace-nowrap">
                      {formatCurrency(c.counted_amount)}
                    </td>
                    <td className={`p-4 text-right font-mono text-sm font-bold whitespace-nowrap ${isBalanced ? 'text-[#2e7d32]' : isSurplus ? 'text-[#c9a227]' : 'text-[#c62828]'}`}>
                      {isBalanced ? 'S/ 0.00' : isSurplus ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold tracking-wider uppercase rounded-full ${
                        isBalanced
                          ? 'bg-[#e8f5e9] text-[#2e7d32] border border-[#a5d6a7]'
                          : isSurplus
                          ? 'bg-[#fff8e1] text-[#f57f17] border border-[#ffe082]'
                          : 'bg-[#ffebee] text-[#c62828] border border-[#ef9a9a]'
                      }`}>
                        <span className="material-symbols-outlined text-[12px]">
                          {isBalanced ? 'check_circle' : isSurplus ? 'arrow_upward' : 'warning'}
                        </span>
                        {isBalanced ? 'Cuadrada' : isSurplus ? 'Sobrante' : 'Faltante'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedClosure(c)}
                        className="bg-[#14213d] hover:bg-[#1f3154] text-white px-3 py-1.5 text-xs font-mono rounded tracking-wider uppercase flex items-center justify-center gap-1 mx-auto transition-colors cursor-pointer"
                        title="Ver detalle del arqueo de caja"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        Detalle
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Detalle de Arqueo */}
      {selectedClosure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="max-w-lg w-full bg-[#fbf9f4] rounded-xl shadow-2xl p-6 relative overflow-y-auto max-h-[90vh] border border-[#d1c5af]">
            <div className="flex justify-between items-start mb-4 border-b border-[#d1c5af] pb-3">
              <div>
                <h4 className="font-serif font-bold text-xl text-[#14213d]">Detalle de Arqueo de Caja #{selectedClosure.id}</h4>
                <p className="font-mono text-xs text-[#755b00]">Realizado por {selectedClosure.staff_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClosure(null)}
                className="text-[#4d4635] hover:text-[#1b1c19] cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="bg-white p-4 rounded border border-[#d1c5af] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#4d4635]">Apertura de turno:</span>
                  <span className="font-bold text-[#1b1c19]">{selectedClosure.opened_at || 'No registrada'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#4d4635]">Cierre de turno:</span>
                  <span className="font-bold text-[#1b1c19]">{selectedClosure.closed_at}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#4d4635]">Transacciones procesadas:</span>
                  <span className="font-bold text-[#1b1c19]">{selectedClosure.totals?.payments_count ?? '—'}</span>
                </div>
              </div>

              {/* Desglose por método */}
              <div className="bg-[#f5f3ee] p-4 rounded border border-[#d1c5af] space-y-2">
                <h5 className="font-bold uppercase tracking-wider text-[#4d4635] mb-2">Desglose de Caja</h5>
                <div className="flex justify-between">
                  <span>Efectivo Esperado (Gaveta):</span>
                  <span className="font-bold">{formatCurrency(selectedClosure.totals?.cash_expected || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Efectivo Declarado (Físico):</span>
                  <span className="font-bold">{formatCurrency(selectedClosure.totals?.cash_counted || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-[#d1c5af] pt-1">
                  <span>Vouchers Esperados (Tarjetas):</span>
                  <span className="font-bold">{formatCurrency(selectedClosure.totals?.voucher_expected || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vouchers Declarados:</span>
                  <span className="font-bold">{formatCurrency(selectedClosure.totals?.voucher_counted || 0)}</span>
                </div>
              </div>

              {/* Totales y Diferencia */}
              <div className="bg-white p-4 rounded border border-[#d1c5af] space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Esperado por Sistema:</span>
                  <span className="font-bold">{formatCurrency(selectedClosure.expected_amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Contado y Declarado:</span>
                  <span className="font-bold">{formatCurrency(selectedClosure.counted_amount)}</span>
                </div>
                <div className="flex justify-between text-base border-t border-[#d1c5af] pt-2 font-bold">
                  <span>Diferencia (Descuadre):</span>
                  <span className={Math.abs(selectedClosure.difference) < 0.01 ? 'text-[#2e7d32]' : selectedClosure.difference > 0 ? 'text-[#c9a227]' : 'text-[#c62828]'}>
                    {Math.abs(selectedClosure.difference) < 0.01 ? 'S/ 0.00 (Cuadrada)' : selectedClosure.difference > 0 ? `+${formatCurrency(selectedClosure.difference)} (Sobrante)` : `${formatCurrency(selectedClosure.difference)} (Faltante)`}
                  </span>
                </div>
              </div>

              {selectedClosure.notes && (
                <div className="bg-[#fff8e1] p-3 rounded border border-[#ffe082]">
                  <span className="font-bold block text-[#f57f17] uppercase text-[10px] mb-1">Observaciones / Notas:</span>
                  <p className="text-[#1b1c19]">{selectedClosure.notes}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedClosure(null)}
                className="bg-[#14213d] hover:bg-[#1f3154] text-white px-5 py-2 font-mono text-xs font-bold uppercase rounded cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
