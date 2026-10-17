import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import StaffSidebar from '../../components/StaffSidebar';
import CloseRegisterModal from '../../components/reports/CloseRegisterModal';
import { ROOM_TYPE_LABELS } from '../../constants/rooms';
import { getDashboardReports, getReportStats } from '../../services/reportService';
import { HOTEL_NAME } from '../../constants/hotel';
import formatCurrency from '../../utils/formatCurrency';
import { apiErrorMessage } from '../../utils/apiError';
import logError from '../../utils/logError';
import { bookingStatusLabel } from '../../utils/bookingStatus';
import { formatDmy } from '../../utils/dates';

// SHE-040: recharts, jsPDF y xlsx se cargan bajo demanda (solo en esta pantalla / al exportar).
const StatsCharts = lazy(() => import('../../components/reports/StatsCharts'));

const PAYMENT_STATUS = {
  completed: { label: 'Completado', badge: 'bg-[#e8f5e9] text-[#1b5e20]', dot: 'bg-[#4caf50]' },
  pending: { label: 'Pendiente', badge: 'bg-[#fff3e0] text-[#e65100]', dot: 'bg-[#ff9800]' },
  failed: { label: 'Fallido', badge: 'bg-[#ffdad6] text-[#93000a]', dot: 'bg-[#ba1a1a]' },
  cancelled: { label: 'Anulado', badge: 'bg-[#eeeeee] text-[#616161]', dot: 'bg-[#9e9e9e]' },
  refund_pending: { label: 'Reembolso Pendiente', badge: 'bg-[#e3f2fd] text-[#1565c0]', dot: 'bg-[#2196f3]' },
  refunded: { label: 'Reembolsado', badge: 'bg-[#ede7f6] text-[#4527a0]', dot: 'bg-[#7e57c2]' },
};
const paymentStatus = (s) => PAYMENT_STATUS[s] || { label: s || '—', badge: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' };

/**
 * Secciones tabulares de las estadísticas para las exportaciones PDF / Excel.
 * money: índices de columna con montos en soles.
 */
function statsSections(stats) {
  return [
    {
      title: 'Ingresos y ocupación por día', sheet: 'Por día',
      head: ['Fecha', 'Ingresos (S/)', 'Ocupación (%)', 'Hab. ocupadas'], money: [1],
      rows: (stats.revenue_by_day || []).map((d, i) => [
        formatDmy(d.date),
        Number(d.revenue),
        Number(stats.occupancy_by_day?.[i]?.occupancy ?? 0),
        Number(stats.occupancy_by_day?.[i]?.occupied_rooms ?? 0),
      ]),
    },
    {
      title: 'Reservas por estado', sheet: 'Estados',
      head: ['Estado', 'Reservas'],
      rows: (stats.bookings_by_status || []).map((r) => [bookingStatusLabel(r.status), Number(r.count)]),
    },
    {
      title: 'Ingresos por tipo de habitación', sheet: 'Tipos de habitación',
      head: ['Tipo', 'Ingresos (S/)', 'Reservas'], money: [1],
      rows: (stats.revenue_by_room_type || []).map((r) => [ROOM_TYPE_LABELS[r.room_type] || r.room_type, Number(r.revenue), Number(r.bookings)]),
    },
    {
      title: 'Métodos de pago', sheet: 'Métodos de pago',
      head: ['Método', 'Monto (S/)', 'Pagos'], money: [1],
      rows: (stats.payment_methods || []).map((m) => [m.method, Number(m.total), Number(m.count)]),
    },
    {
      title: 'Top 5 productos consumidos', sheet: 'Top productos',
      head: ['Producto', 'Cantidad', 'Ingresos (S/)'], money: [2],
      rows: (stats.top_products || []).map((p) => [p.name, Number(p.quantity), Number(p.revenue)]),
    },
  ];
}

export default function ReportsDashboard() {
  const [dateRange, setDateRange] = useState('30_days');
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isCloseRegisterModalOpen, setCloseRegisterModalOpen] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    setStatsError('');
    const [dashboard, statsResult] = await Promise.allSettled([
      getDashboardReports(dateRange),
      getReportStats(dateRange),
    ]);
    if (dashboard.status === 'fulfilled') {
      setData(dashboard.value);
    } else {
      logError('reports:dashboard', dashboard.reason);
      setError(apiErrorMessage(dashboard.reason, 'Error al cargar el dashboard.'));
    }
    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value);
    } else {
      logError('reports:stats', statsResult.reason);
      setStats(null);
      setStatsError(apiErrorMessage(statsResult.reason, 'No se pudieron cargar las estadísticas.'));
    }
    setLoading(false);
  }, [dateRange]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const [exporting, setExporting] = useState('');

  const runExport = async (kind, fn) => {
    if (!data || exporting) return;
    setExporting(kind);
    try {
      await fn();
    } catch (err) {
      logError(`reports:export-${kind}`, err);
      setError(`No se pudo generar el archivo ${kind === 'pdf' ? 'PDF' : 'Excel'}.`);
    } finally {
      setExporting('');
    }
  };

  const handleExportPDF = () => runExport('pdf', async () => {
    const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`${HOTEL_NAME} - Reporte de Transacciones`, 14, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Rango: ${data.startDate} al ${data.endDate}`, 14, 28);

    // Metrics
    doc.text(`Tasa de Ocupación: ${data.occupancy_rate}%`, 14, 38);
    doc.text(`Ingresos Brutos: ${formatCurrency(data.gross_revenue)}`, 14, 44);
    doc.text(`Reservas Totales: ${data.total_bookings}`, 14, 50);

    const tableData = (data.transactions || []).map(t => [
      t.date,
      t.staff,
      formatCurrency(t.amount),
      paymentStatus(t.status).label.toUpperCase()
    ]);

    let startY = 60;
    if (stats?.kpis) {
      const k = stats.kpis;
      doc.text(`Ingresos Netos: ${formatCurrency(k.net_revenue)} (reembolsos: ${formatCurrency(k.refunds)})`, 14, 56);
      doc.text(`ADR: ${formatCurrency(k.adr)}   RevPAR: ${formatCurrency(k.revpar)}   Noches vendidas: ${k.room_nights_sold}/${k.available_room_nights}`, 14, 62);
      startY = 70;
    }

    autoTable(doc, {
      startY,
      head: [['Fecha', 'Origen/Staff', 'Monto', 'Estado']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [201, 162, 39] },
    });

    if (stats) {
      statsSections(stats).forEach((section) => {
        const cols = section.head.length;
        autoTable(doc, {
          startY: (doc.lastAutoTable?.finalY ?? startY) + 10,
          head: [[{ content: section.title, colSpan: cols }], section.head],
          body: section.rows.length
            ? section.rows.map((r) => r.map((c, i) => (section.money?.includes(i) ? formatCurrency(c) : c)))
            : [[{ content: 'Sin datos', colSpan: cols }]],
          theme: 'grid',
          headStyles: { fillColor: [20, 33, 61] },
          styles: { fontSize: 9 },
        });
      });
    }

    doc.save(`Reporte_GrandLedger_${data.startDate}.pdf`);
  });

  const handleExportExcel = () => runExport('excel', async () => {
    const XLSX = await import('xlsx');

    const summary = [
      [`${HOTEL_NAME} - Reporte de Transacciones`],
      [`Rango: ${data.startDate} al ${data.endDate}`],
      [],
      ['Tasa de Ocupación', `${data.occupancy_rate}%`],
      ['Ingresos Brutos', formatCurrency(data.gross_revenue)],
      ['Reservas Totales', data.total_bookings],
      []
    ];

    const tableHeaders = ['Fecha', 'Origen/Staff', 'Monto (S/)', 'Estado'];
    const tableData = (data.transactions || []).map(t => [
      t.date,
      t.staff,
      Number(t.amount),
      paymentStatus(t.status).label.toUpperCase()
    ]);

    if (stats?.kpis) {
      const k = stats.kpis;
      summary.splice(6, 0,
        ['Ingresos Netos (S/)', Number(k.net_revenue)],
        ['Reembolsos (S/)', Number(k.refunds)],
        ['ADR (S/)', Number(k.adr)],
        ['RevPAR (S/)', Number(k.revpar)],
        ['Noches vendidas', k.room_nights_sold],
        ['Noches disponibles', k.available_room_nights],
      );
    }

    const ws = XLSX.utils.aoa_to_sheet([...summary, tableHeaders, ...tableData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");

    if (stats) {
      statsSections(stats).forEach((section) => {
        const sheet = XLSX.utils.aoa_to_sheet([section.head, ...section.rows]);
        XLSX.utils.book_append_sheet(wb, sheet, section.sheet);
      });
    }

    XLSX.writeFile(wb, `Reporte_GrandLedger_${data.startDate}.xlsx`);
  });

  return (
    <div className="flex flex-col md:flex-row w-full min-h-screen bg-[#dcdad5]">
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
                <label htmlFor="report-range" className="font-mono text-xs text-[#4d4635] uppercase tracking-widest mb-1 font-bold">Rango de Fechas</label>
                <select
                  id="report-range"
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
                disabled={loading || !!exporting}
                aria-busy={exporting === 'excel'}
                className="flex items-center gap-2 border border-[#755b00] text-[#755b00] px-4 py-2 font-mono text-sm uppercase tracking-widest hover:bg-[#755b00]/5 transition-colors group cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm group-hover:-translate-y-0.5 transition-transform">table_view</span>
                Excel
              </button>
              <button
                onClick={handleExportPDF}
                disabled={loading || !!exporting}
                aria-busy={exporting === 'pdf'}
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
                  <h2 className="font-serif text-4xl font-bold text-[#755b00]">{formatCurrency(data.gross_revenue)}</h2>
                </div>

                <div className="bg-white p-6 shadow-md border border-[#d1c5af] relative overflow-hidden group hover:shadow-lg transition-shadow">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#c9a227]/10 rounded-full blur-xl group-hover:bg-[#c9a227]/20 transition-colors"></div>
                  <p className="font-mono text-xs text-[#4d4635] uppercase tracking-widest font-bold mb-4">Reservas Totales</p>
                  <h2 className="font-serif text-4xl font-bold text-[#755b00]">{data.total_bookings}</h2>
                </div>
              </div>

              {/* KPIs de rendimiento (ADR / RevPAR) */}
              {stats?.kpis && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                  {[
                    { label: 'ADR', hint: 'Tarifa promedio por noche vendida', value: formatCurrency(stats.kpis.adr) },
                    { label: 'RevPAR', hint: 'Ingreso por habitación disponible', value: formatCurrency(stats.kpis.revpar) },
                    { label: 'Ingresos Netos', hint: `Reembolsos: ${formatCurrency(stats.kpis.refunds)}`, value: formatCurrency(stats.kpis.net_revenue) },
                    { label: 'Noches Vendidas', hint: `de ${stats.kpis.available_room_nights} disponibles`, value: stats.kpis.room_nights_sold },
                  ].map((kpi) => (
                    <div key={kpi.label} className="bg-white p-5 shadow-md border border-[#d1c5af] border-l-4 border-l-[#14213d]">
                      <p className="font-mono text-xs text-[#4d4635] uppercase tracking-widest font-bold">{kpi.label}</p>
                      <p className="font-serif text-3xl font-bold text-[#14213d] mt-2">{kpi.value}</p>
                      <p className="font-mono text-[11px] text-[#4d4635] mt-1">{kpi.hint}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Gráficos (recharts) */}
              {statsError ? (
                <div role="alert" className="bg-[#ffdad6] text-[#93000a] p-4 text-sm font-mono border border-[#ba1a1a]/30 flex items-center justify-between gap-4">
                  <span>{statsError}</span>
                  <button type="button" onClick={fetchReports} className="underline font-bold cursor-pointer">Reintentar</button>
                </div>
              ) : (
                <Suspense fallback={<div role="status" className="py-10 text-center font-mono text-sm text-[#755b00]">Cargando gráficos...</div>}>
                  <StatsCharts stats={stats} />
                </Suspense>
              )}

              <div className="h-6"></div>

              {/* Transactions Table */}
              <div className="bg-white shadow-xl mt-8 border border-[#d1c5af] relative z-10 overflow-hidden">
                <div className="p-6 bg-[#755b00] text-white">
                  <h3 className="font-serif text-xl font-bold">Reporte de Cajas y Transacciones</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left border-collapse">
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
                            <td className="p-4 text-right font-mono font-bold whitespace-nowrap">{formatCurrency(t.amount)}</td>
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold tracking-widest uppercase whitespace-nowrap ${paymentStatus(t.status).badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${paymentStatus(t.status).dot}`} aria-hidden="true"></span>
                                {paymentStatus(t.status).label}
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
          expectedAmount={Number(data?.unreconciled_revenue || 0)}
        />
      )}
    </div>
  );
}
