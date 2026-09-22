import { useState, useEffect } from 'react';
import StaffSidebar from '../../components/StaffSidebar';
import CloseRegisterModal from '../../components/reports/CloseRegisterModal';
import { getDashboardReports } from '../../services/reportService';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export default function ReportsDashboard() {
  const [dateRange, setDateRange] = useState('30_days');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isCloseRegisterModalOpen, setCloseRegisterModalOpen] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getDashboardReports(dateRange);
      setData(result);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar el dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  const handleExportPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('The Grand Ledger - Reporte de Transacciones', 14, 20);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Rango: ${data.startDate} al ${data.endDate}`, 14, 28);
    
    // Metrics
    doc.text(`Tasa de Ocupación: ${data.occupancy_rate}%`, 14, 38);
    doc.text(`Ingresos Brutos: S/ ${Number(data.gross_revenue).toFixed(2)}`, 14, 44);
    doc.text(`Reservas Totales: ${data.total_bookings}`, 14, 50);

    const tableData = data.transactions.map(t => [
      t.date, 
      t.staff, 
      `S/ ${Number(t.amount).toFixed(2)}`, 
      t.status.toUpperCase()
    ]);

    doc.autoTable({
      startY: 60,
      head: [['Fecha', 'Origen/Staff', 'Monto', 'Estado']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [201, 162, 39] },
    });
    
    doc.save(`Reporte_GrandLedger_${data.startDate}.pdf`);
  };

  const handleExportExcel = () => {
    if (!data) return;
    
    const summary = [
      ['The Grand Ledger - Reporte de Transacciones'],
      [`Rango: ${data.startDate} al ${data.endDate}`],
      [],
      ['Tasa de Ocupación', `${data.occupancy_rate}%`],
      ['Ingresos Brutos', `S/ ${Number(data.gross_revenue).toFixed(2)}`],
      ['Reservas Totales', data.total_bookings],
      []
    ];
    
    const tableHeaders = ['Fecha', 'Origen/Staff', 'Monto (S/)', 'Estado'];
    const tableData = data.transactions.map(t => [
      t.date, 
      t.staff, 
      Number(t.amount), 
      t.status.toUpperCase()
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([...summary, tableHeaders, ...tableData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    
    XLSX.writeFile(wb, `Reporte_GrandLedger_${data.startDate}.xlsx`);
  };

  // Helper para generar los puntos de la gráfica SVG simple
  const renderChartPath = () => {
    if (!data || !data.chart_data || data.chart_data.length === 0) return '';
    const points = data.chart_data;
    const width = 1000;
    const height = 150; // max Y mapping (220 to 90 is roughly the area in HTML, let's map 0-100% to Y: 280 to 50)
    
    let path = `M0,300 L0,${300 - (points[0].occupancy * 2.5)}`;
    
    points.forEach((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = 300 - (point.occupancy * 2.5); // 0% = 300, 100% = 50
      if (index === 0) {
        path = `M${x},${y}`;
      } else {
        path += ` L${x},${y}`;
      }
    });
    return path;
  };

  return (
    <div className="flex w-full min-h-screen bg-[#dcdad5]">
      <StaffSidebar />
      
      <main className="flex-1 p-4 md:p-12 overflow-y-auto bg-[#dcdad5]">
        <div className="flex flex-col w-full bg-[#fbf9f4] min-h-full text-[#1b1c19] p-4 md:p-12 space-y-8 shadow-sm">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
            <div>
              <h1 className="font-serif text-4xl font-bold text-[#755b00] tracking-tight mb-2">
                Dashboard de Ocupación y Reportes
              </h1>
              <p className="font-sans text-lg text-[#4d4635] max-w-2xl">
                Análisis de rendimiento y estados financieros.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 bg-white p-4 shadow-sm border border-[#d1c5af] relative">
              <div className="flex flex-col">
                <span className="font-mono text-xs text-[#4d4635] uppercase tracking-widest mb-1 font-bold">Rango de Fechas</span>
                <select 
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="bg-transparent font-mono text-sm text-[#1b1c19] focus:outline-none focus:text-[#755b00] transition-colors appearance-none pr-8 cursor-pointer border-b-2 border-[#dcdad5] focus:border-[#755b00] pb-1"
                >
                  <option value="30_days">Últimos 30 días</option>
                  <option value="this_month">Este Mes</option>
                  <option value="last_month">Mes Anterior</option>
                  <option value="ytd">Año a la fecha</option>
                </select>
              </div>
              <div className="h-8 w-px bg-[#e4e2dd] mx-2 hidden md:block"></div>
              <button 
                onClick={handleExportExcel}
                disabled={loading}
                className="flex items-center gap-2 border border-[#755b00] text-[#755b00] px-4 py-2 font-mono text-sm uppercase tracking-widest hover:bg-[#755b00]/5 transition-colors group cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm group-hover:-translate-y-0.5 transition-transform">table_view</span>
                Excel
              </button>
              <button 
                onClick={handleExportPDF}
                disabled={loading}
                className="flex items-center gap-2 border border-[#755b00] text-[#755b00] px-4 py-2 font-mono text-sm uppercase tracking-widest hover:bg-[#755b00]/5 transition-colors group cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm group-hover:-translate-y-0.5 transition-transform">picture_as_pdf</span>
                PDF
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-[#ffdad6] text-[#93000a] p-4 text-sm font-mono border border-[#ba1a1a]/30">
              {error}
            </div>
          )}

          {loading || !data ? (
            <div className="py-20 text-center font-mono text-sm text-[#755b00]">Cargando métricas...</div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                <div className="bg-white p-6 shadow-md border border-[#d1c5af] relative overflow-hidden group hover:shadow-lg transition-shadow">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#c9a227]/10 rounded-full blur-xl group-hover:bg-[#c9a227]/20 transition-colors"></div>
                  <p className="font-mono text-xs text-[#4d4635] uppercase tracking-widest font-bold mb-4">Tasa de Ocupación</p>
                  <div className="flex items-end gap-3">
                    <h2 className="font-serif text-4xl font-bold text-[#755b00]">{data.occupancy_rate}%</h2>
                  </div>
                </div>
                
                <div className="bg-white p-6 shadow-md border border-[#d1c5af] relative overflow-hidden group hover:shadow-lg transition-shadow">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#c9a227]/10 rounded-full blur-xl group-hover:bg-[#c9a227]/20 transition-colors"></div>
                  <p className="font-mono text-xs text-[#4d4635] uppercase tracking-widest font-bold mb-4">Ingresos Brutos</p>
                  <h2 className="font-serif text-4xl font-bold text-[#755b00]">S/ {Number(data.gross_revenue).toFixed(2)}</h2>
                </div>
                
                <div className="bg-white p-6 shadow-md border border-[#d1c5af] relative overflow-hidden group hover:shadow-lg transition-shadow">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#c9a227]/10 rounded-full blur-xl group-hover:bg-[#c9a227]/20 transition-colors"></div>
                  <p className="font-mono text-xs text-[#4d4635] uppercase tracking-widest font-bold mb-4">Reservas Totales</p>
                  <h2 className="font-serif text-4xl font-bold text-[#755b00]">{data.total_bookings}</h2>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-white shadow-xl p-6 border border-[#d1c5af] relative z-10">
                <div className="flex justify-between items-center mb-6 border-b border-[#eae8e3] pb-4">
                  <h3 className="font-serif text-xl font-bold text-[#755b00]">Ocupación de Habitaciones</h3>
                  <span className="font-mono text-xs text-[#4d4635] uppercase tracking-widest font-bold">Variación de Demanda</span>
                </div>
                
                <div className="w-full h-[300px] relative">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 300">
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                        <stop offset="0%" stopColor="#ecc246" stopOpacity="0.4"></stop>
                        <stop offset="100%" stopColor="#ecc246" stopOpacity="0.0"></stop>
                      </linearGradient>
                    </defs>
                    
                    {/* Grid lines */}
                    <path d="M0,50 L1000,50 M0,150 L1000,150 M0,250 L1000,250" fill="none" stroke="#e4e2dd" strokeDasharray="4,4" strokeWidth="1"></path>
                    
                    {/* Line and area */}
                    {data.chart_data.length > 0 && (
                      <>
                        <path d={`${renderChartPath()} L1000,300 L0,300 Z`} fill="url(#chartGradient)"></path>
                        <path d={renderChartPath()} fill="none" stroke="#755b00" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
                      </>
                    )}
                  </svg>
                  
                  <div className="absolute bottom-0 left-0 w-full flex justify-between px-2 pt-2 border-t border-[#e4e2dd] font-mono text-[10px] text-[#4d4635] translate-y-full mt-1">
                    {data.chart_data.length > 0 && (
                      <>
                        <span>{data.chart_data[0].date}</span>
                        <span>{data.chart_data[Math.floor(data.chart_data.length / 2)].date}</span>
                        <span>{data.chart_data[data.chart_data.length - 1].date}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="h-6"></div>

              {/* Transactions Table */}
              <div className="bg-white shadow-xl mt-8 border border-[#d1c5af] relative z-10 overflow-hidden">
                <div className="p-6 bg-[#755b00] text-white">
                  <h3 className="font-serif text-xl font-bold">Reporte de Cajas y Transacciones</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f0eee9] text-[#4d4635] font-mono text-[11px] uppercase tracking-widest border-b border-[#d1c5af]">
                        <th className="p-4 font-bold">Fecha</th>
                        <th className="p-4 font-bold">Recepcionista / Origen</th>
                        <th className="p-4 font-bold">Referencia (Reserva)</th>
                        <th className="p-4 font-bold text-right">Monto</th>
                        <th className="p-4 font-bold">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="font-sans text-sm text-[#1b1c19]">
                      {!data?.transactions || data.transactions.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-[#755b00] font-mono text-xs">No hay transacciones en este rango de fechas.</td>
                        </tr>
                      ) : (
                        data.transactions.map((t, idx) => (
                          <tr key={t.id || idx} className="border-b border-[#e4e2dd] hover:bg-[#f5f3ee] transition-colors">
                            <td className="p-4 whitespace-nowrap">{t.date}</td>
                            <td className="p-4">{t.staff}</td>
                            <td className="p-4 font-mono text-xs">{t.booking_code}</td>
                            <td className="p-4 text-right font-mono font-bold">S/ {Number(t.amount).toFixed(2)}</td>
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold tracking-widest uppercase ${
                                t.status === 'completed' ? 'bg-[#e8f5e9] text-[#1b5e20]' : 'bg-[#fff3e0] text-[#e65100]'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'completed' ? 'bg-[#4caf50]' : 'bg-[#ff9800]'}`}></span>
                                {t.status === 'completed' ? 'Completado' : 'Pendiente'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-8 pb-4">
                <button 
                  onClick={() => setCloseRegisterModalOpen(true)}
                  className="bg-[#c9a227] text-[#14213d] font-serif font-bold text-lg px-8 py-4 shadow-md hover:shadow-xl hover:brightness-105 transition-all flex items-center gap-3 border border-[#a68a4d] cursor-pointer"
                >
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                  Realizar Cierre de Caja
                </button>
              </div>
            </>
          )}

        </div>
      </main>

      {/* Modal Cierre de Caja */}
      {isCloseRegisterModalOpen && (
        <CloseRegisterModal 
          onClose={() => setCloseRegisterModalOpen(false)}
          onSuccess={() => {
            setCloseRegisterModalOpen(false);
            // Mostrar alguna notificación de éxito y recargar si se desea
            fetchReports();
          }}
          expectedAmount={Number(data?.gross_revenue || 0)}
        />
      )}
    </div>
  );
}
