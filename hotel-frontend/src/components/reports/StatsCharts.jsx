import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import formatCurrency from '../../utils/formatCurrency';
import { bookingStatusLabel } from '../../utils/bookingStatus';
import { ROOM_TYPE_LABELS } from '../../constants/rooms';

/**
 * Gráficos del dashboard de reportes (SHE-020) construidos con recharts.
 * Paleta derivada de la marca (navy / dorado) con contraste suficiente sobre blanco.
 */
const CHART_COLORS = ['#14213d', '#c9a227', '#3F6B4F', '#1565c0', '#ba1a1a', '#7e57c2', '#78716c'];

const STATUS_COLORS = {
  pending_payment: '#e65100',
  confirmed: '#3F6B4F',
  checked_in: '#1565c0',
  checked_out: '#14213d',
  cancelled: '#ba1a1a',
  expired: '#78716c',
};


const AXIS_TICK = { fill: '#4d4635', fontSize: 11, fontFamily: 'ui-monospace, monospace' };
const GRID_STROKE = '#e4e2dd';

const shortCurrency = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1000) return `S/ ${(n / 1000).toLocaleString('es-PE', { maximumFractionDigits: 1 })}k`;
  return `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
};

/** 'YYYY-MM-DD' -> 'DD/MM' */
const shortDay = (ymd) => {
  const [, m, d] = String(ymd).split('-');
  return d && m ? `${d}/${m}` : ymd;
};

const longDay = (ymd) => {
  const [y, m, d] = String(ymd).split('-');
  return d && m && y ? `${d}/${m}/${y}` : ymd;
};

function ChartTooltip({ active, payload, label, valueFormatter = (v) => v, labelFormatter = (l) => l }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#fbf9f4] border border-[#d1c5af] shadow-[2px_2px_0px_rgba(20,33,61,0.15)] px-3 py-2 font-mono text-xs text-[#1b1c19]">
      {label !== undefined && label !== null && label !== '' && (
        <p className="font-bold text-[#755b00] mb-1">{labelFormatter(label)}</p>
      )}
      {payload.map((p) => (
        <p key={`${p.name}-${p.dataKey}`} className="flex items-center gap-2">
          <span className="w-2 h-2 inline-block" style={{ background: p.color || p.payload?.fill }} aria-hidden="true" />
          <span>{p.name}:</span>
          <strong>{valueFormatter(p.value, p)}</strong>
        </p>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, isEmpty, emptyText = 'Sin datos para el rango seleccionado.', summary, children, className = '' }) {
  return (
    <figure className={`bg-white shadow-md p-5 border border-[#d1c5af] m-0 ${className}`}>
      <figcaption className="flex flex-wrap justify-between items-baseline gap-2 mb-4 border-b border-[#eae8e3] pb-3">
        <span className="font-serif text-lg font-bold text-[#755b00]">{title}</span>
        {subtitle && <span className="font-mono text-[10px] text-[#4d4635] uppercase tracking-widest font-bold">{subtitle}</span>}
      </figcaption>
      {summary && <p className="sr-only">{summary}</p>}
      {isEmpty ? (
        <div className="h-[240px] flex flex-col items-center justify-center text-center text-[#755b00]">
          <span className="material-symbols-outlined text-4xl opacity-60" aria-hidden="true">insert_chart</span>
          <p className="font-mono text-xs mt-2">{emptyText}</p>
        </div>
      ) : (
        <div className="h-[260px] w-full" aria-hidden="true">
          {children}
        </div>
      )}
    </figure>
  );
}

function DonutChart({ data, nameKey, valueKey, colorFor, valueFormatter }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          stroke="#ffffff"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {data.map((entry, i) => (
            <Cell key={entry[nameKey]} fill={colorFor(entry, i)} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
        <Legend
          verticalAlign="bottom"
          iconType="square"
          iconSize={10}
          wrapperStyle={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: '#4d4635' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default function StatsCharts({ stats }) {
  if (!stats) return null;

  const revenue = stats.revenue_by_day || [];
  const occupancy = stats.occupancy_by_day || [];
  const hasRevenue = revenue.some((d) => Number(d.revenue) > 0);
  const hasOccupancy = occupancy.some((d) => Number(d.occupancy) > 0);

  const methods = (stats.payment_methods || []).filter((m) => Number(m.total) > 0);
  const statuses = (stats.bookings_by_status || [])
    .filter((s) => Number(s.count) > 0)
    .map((s) => ({ ...s, label: bookingStatusLabel(s.status) }));
  const roomTypes = (stats.revenue_by_room_type || []).map((r) => ({
    ...r,
    label: ROOM_TYPE_LABELS[r.room_type] || r.room_type || 'Sin tipo',
  }));
  const products = stats.top_products || [];

  const many = revenue.length > 45;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <ChartCard
        title="Ingresos diarios"
        subtitle="Pagos completados"
        isEmpty={!hasRevenue}
        className="xl:col-span-2"
        summary={`Ingresos brutos del periodo: ${formatCurrency(stats.kpis?.gross_revenue)}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={revenue} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c9a227" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#c9a227" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDay} tick={AXIS_TICK} minTickGap={many ? 24 : 12} />
            <YAxis tickFormatter={shortCurrency} tick={AXIS_TICK} width={72} />
            <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v)} labelFormatter={longDay} />} />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Ingresos"
              stroke="#755b00"
              strokeWidth={2}
              fill="url(#revenueFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Ocupación diaria"
        subtitle="% de habitaciones ocupadas"
        isEmpty={!hasOccupancy}
        className="xl:col-span-2"
        summary={`Tasa de ocupación promedio: ${stats.kpis?.occupancy_rate ?? 0}%.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={occupancy} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDay} tick={AXIS_TICK} minTickGap={many ? 24 : 12} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={AXIS_TICK} width={48} />
            <Tooltip
              cursor={{ fill: '#f5f3ee' }}
              content={(
                <ChartTooltip
                  labelFormatter={longDay}
                  valueFormatter={(v, p) => `${v}% (${p?.payload?.occupied_rooms ?? 0} hab.)`}
                />
              )}
            />
            <Bar dataKey="occupancy" name="Ocupación" fill="#14213d" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Métodos de pago"
        subtitle="Monto cobrado"
        isEmpty={methods.length === 0}
        summary={methods.map((m) => `${m.method}: ${formatCurrency(m.total)}`).join('; ')}
      >
        <DonutChart
          data={methods}
          nameKey="method"
          valueKey="total"
          colorFor={(_, i) => CHART_COLORS[i % CHART_COLORS.length]}
          valueFormatter={(v, p) => `${formatCurrency(v)} (${p?.payload?.count ?? 0} pagos)`}
        />
      </ChartCard>

      <ChartCard
        title="Reservas por estado"
        subtitle="Creadas en el periodo"
        isEmpty={statuses.length === 0}
        summary={statuses.map((s) => `${s.label}: ${s.count}`).join('; ')}
      >
        <DonutChart
          data={statuses}
          nameKey="label"
          valueKey="count"
          colorFor={(entry, i) => STATUS_COLORS[entry.status] || CHART_COLORS[i % CHART_COLORS.length]}
          valueFormatter={(v) => `${v} reservas`}
        />
      </ChartCard>

      <ChartCard
        title="Ingresos por tipo de habitación"
        isEmpty={roomTypes.length === 0}
        summary={roomTypes.map((r) => `${r.label}: ${formatCurrency(r.revenue)}`).join('; ')}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={roomTypes} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} />
            <YAxis tickFormatter={shortCurrency} tick={AXIS_TICK} width={72} />
            <Tooltip cursor={{ fill: '#f5f3ee' }} content={<ChartTooltip valueFormatter={(v) => formatCurrency(v)} />} />
            <Bar dataKey="revenue" name="Ingresos" isAnimationActive={false} radius={[2, 2, 0, 0]}>
              {roomTypes.map((r, i) => <Cell key={r.label} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Top 5 productos consumidos"
        subtitle="Unidades"
        isEmpty={products.length === 0}
        emptyText="No se registraron consumos en este rango."
        summary={products.map((p) => `${p.name}: ${p.quantity} unidades`).join('; ')}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={products} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="4 4" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} />
            <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={110} />
            <Tooltip
              cursor={{ fill: '#f5f3ee' }}
              content={<ChartTooltip valueFormatter={(v, p) => `${v} u. · ${formatCurrency(p?.payload?.revenue)}`} />}
            />
            <Bar dataKey="quantity" name="Cantidad" fill="#c9a227" stroke="#755b00" radius={[0, 2, 2, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
