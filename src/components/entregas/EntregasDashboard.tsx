import { useMemo } from 'react';
import { LayoutDashboard, CheckCircle2, AlertTriangle, Clock, XCircle } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { CustomTooltip } from '@/components/charts/CustomTooltip';
import { chartColors, axisTick, BAR_RADIUS } from '@/components/charts/chartTheme';
import { AXIS_STYLE, GRID_STYLE } from '@/components/reports/ReportCharts';
import { EmptyState as SharedEmptyState } from '@/components/shared/StoryUI';
import { parseTags, type Entrega } from '@/hooks/useEntregas';
import type { EntregaMaterialResumenRow } from '@/hooks/useEntregaMateriales';

const CARD_CLASS = 'rounded-2xl border border-border bg-card shadow-card transition-all duration-200';

// Regla del negocio: cada materia entregada implica 5 materiales (uno de cada tipo requerido).
// Se usa como estimado mientras la entrega no tiene el detalle real registrado en entrega_materiales.
const MATERIALES_POR_MATERIA = 5;

const ESTADO_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  aceptado:          { label: 'Aceptado',          color: chartColors.green, icon: CheckCircle2 },
  con_observaciones: { label: 'Con observaciones', color: chartColors.yellow, icon: AlertTriangle },
  pendiente:         { label: 'Pendiente',         color: axisTick.fill, icon: Clock },
  rechazado:         { label: 'Rechazado',         color: chartColors.coral, icon: XCircle },
};

const NIVEL_LABELS_SHORT: Record<string, string> = {
  pregrado: 'Pregrado',
  especializacion: 'Especialización',
  maestria: 'Maestría',
  doctorado: 'Doctorado',
  diplomado: 'Diplomado',
  curso_rapido: 'Curso rápido',
};

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  return `${MESES_CORTOS[parseInt(m, 10) - 1]} de ${year}`;
}

// Tick de eje Y que trunca nombres largos de escuela y muestra el nombre completo al pasar el mouse
function TruncatedYAxisTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const text = payload?.value ?? '';
  const truncated = text.length > 20 ? `${text.slice(0, 19)}…` : text;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{text}</title>
      <text x={0} y={0} dy={4} textAnchor="end" fontSize={10} fill={axisTick.fill}>
        {truncated}
      </text>
    </g>
  );
}

function SectionHeader({ tag, title }: { tag: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4">
      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md uppercase tracking-widest whitespace-nowrap">
        {tag}
      </span>
      <h2 className="text-[15px] font-black tracking-tight text-foreground">{title}</h2>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <SharedEmptyState message={message} icon={LayoutDashboard} />;
}

interface EntregasDashboardProps {
  entregas: Entrega[];
  materialesResumen: EntregaMaterialResumenRow[];
}

export function EntregasDashboard({ entregas, materialesResumen }: EntregasDashboardProps) {
  // Materiales entregados por entrega: si ya tiene el detalle real (entrega_materiales) se usa ese
  // conteo; si no, se estima con la regla de 5 materiales por cada materia entregada.
  const materialesEntregadosPorEntrega = useMemo(() => {
    const real = new Map<string, number>();
    for (const row of materialesResumen) {
      real.set(row.entrega_id, (real.get(row.entrega_id) ?? 0) + row.cantidad_entregada);
    }
    const map = new Map<string, number>();
    for (const e of entregas) {
      const conteoReal = real.get(e.id);
      const estimado = parseTags(e.materias).length * MATERIALES_POR_MATERIA;
      map.set(e.id, conteoReal && conteoReal > 0 ? conteoReal : estimado);
    }
    return map;
  }, [entregas, materialesResumen]);

  const totalMaterialesEntregados = useMemo(
    () => Array.from(materialesEntregadosPorEntrega.values()).reduce((s, v) => s + v, 0),
    [materialesEntregadosPorEntrega]
  );

  const estadoCounts = useMemo(() => {
    const counts: Record<string, number> = { aceptado: 0, con_observaciones: 0, pendiente: 0, rechazado: 0 };
    for (const e of entregas) counts[e.estado] = (counts[e.estado] ?? 0) + 1;
    return counts;
  }, [entregas]);

  const estadoData = useMemo(
    () =>
      Object.entries(estadoCounts)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ estado: k, label: ESTADO_META[k]?.label ?? k, value: v, color: ESTADO_META[k]?.color ?? chartColors.rust })),
    [estadoCounts]
  );

  // Tendencia mensual: total de entregas por mes (independiente del estado)
  const trendTotalData = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const e of entregas) {
      const month = e.fecha_entrega.slice(0, 7);
      buckets.set(month, (buckets.get(month) ?? 0) + 1);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ month, monthLabel: formatMonthLabel(month), value }));
  }, [entregas]);

  // Detalle por escuela y nivel: niveles como badges (conteo) + total, ordenado por total desc
  const byEscuelaNivelDetail = useMemo(() => {
    const map = new Map<string, { escuela: string; niveles: Map<string, number>; total: number }>();
    for (const e of entregas) {
      const key = e.escuela?.trim() || 'Sin escuela';
      const row = map.get(key) ?? { escuela: key, niveles: new Map<string, number>(), total: 0 };
      row.total += 1;
      const nivelLabel = e.nivel_programa ? NIVEL_LABELS_SHORT[e.nivel_programa] : 'Sin nivel';
      row.niveles.set(nivelLabel, (row.niveles.get(nivelLabel) ?? 0) + 1);
      map.set(key, row);
    }
    return Array.from(map.values())
      .map((row) => ({
        escuela: row.escuela,
        total: row.total,
        niveles: Array.from(row.niveles.entries())
          .sort(([, a], [, b]) => b - a)
          .map(([label, count]) => ({ label, count })),
      }))
      .sort((a, b) => b.total - a.total);
  }, [entregas]);

  // Entregas por escuela (para el bar chart) — mismo conteo que la tabla de detalle
  const byEscuelaBar = useMemo(
    () => byEscuelaNivelDetail.map((row) => ({ escuela: row.escuela, value: row.total })),
    [byEscuelaNivelDetail]
  );

  const byNivel = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entregas) {
      const key = e.nivel_programa ?? 'sin_nivel';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([nivel, value]) => ({ nivel: NIVEL_LABELS_SHORT[nivel] ?? 'Sin nivel', value }))
      .sort((a, b) => b.value - a.value);
  }, [entregas]);

  if (entregas.length === 0) {
    return (
      <div className={CARD_CLASS}>
        <EmptyState message="Aún no hay entregas registradas para mostrar en el dashboard." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ① Resumen de entregas */}
      <section>
        <SectionHeader tag="① Resumen" title="Estado de las entregas" />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <div className="rounded-xl bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4" style={{ borderTop: `3px solid ${chartColors.rust}` }}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total</p>
            <p className="text-2xl font-black leading-none" style={{ color: chartColors.rust }}>{entregas.length}</p>
            <p className="text-[10px] text-muted-foreground mt-1">entregas registradas</p>
          </div>
          <div className="rounded-xl bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4" style={{ borderTop: `3px solid ${chartColors.tealDeep}` }}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Materiales</p>
            <p className="text-2xl font-black leading-none" style={{ color: chartColors.tealDeep }}>{totalMaterialesEntregados}</p>
            <p className="text-[10px] text-muted-foreground mt-1">entregados (5 por materia)</p>
          </div>
          {(Object.keys(ESTADO_META) as (keyof typeof ESTADO_META)[]).map((k) => {
            const meta = ESTADO_META[k];
            return (
              <div key={k} className="rounded-xl bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4" style={{ borderTop: `3px solid ${meta.color}` }}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{meta.label}</p>
                <p className="text-2xl font-black leading-none" style={{ color: meta.color }}>{estadoCounts[k] ?? 0}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {entregas.length > 0 ? Math.round(((estadoCounts[k] ?? 0) / entregas.length) * 100) : 0}% del total
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Distribución por estado</CardTitle>
              <CardDescription className="text-xs">Proporción de entregas según su resultado de revisión</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={180}>
                <PieChart>
                  <Pie data={estadoData} dataKey="value" nameKey="label" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">
                    {estadoData.map((d) => <Cell key={d.estado} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {estadoData.map((d) => {
                  const Icon = ESTADO_META[d.estado]?.icon ?? Clock;
                  const pct = entregas.length > 0 ? Math.round((d.value / entregas.length) * 100) : 0;
                  return (
                    <div key={d.estado} className="flex items-center gap-2 text-xs">
                      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: d.color }} />
                      <span className="flex-1 truncate text-muted-foreground">{d.label}</span>
                      <span className="font-bold tabular-nums" style={{ color: d.color }}>{d.value}</span>
                      <span className="text-muted-foreground w-9 text-right tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tendencia mensual de entregas</CardTitle>
              <CardDescription className="text-xs">Cantidad de proyectos entregados por mes</CardDescription>
            </CardHeader>
            <CardContent>
              {trendTotalData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendTotalData} margin={{ left: -16, right: 12 }}>
                    <CartesianGrid {...GRID_STYLE} vertical={false} />
                    <XAxis dataKey="monthLabel" {...AXIS_STYLE} />
                    <YAxis {...AXIS_STYLE} allowDecimals={false} width={28} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name="Entregas"
                      stroke={chartColors.teal}
                      strokeWidth={2}
                      dot={{ r: 4, fill: chartColors.teal, strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="Sin datos suficientes para la tendencia mensual" />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ② Portafolio */}
      <section>
        <SectionHeader tag="② Portafolio" title="Entregas por escuela y nivel de programa" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Entregas por Escuela</CardTitle>
              <CardDescription className="text-xs">Total de proyectos entregados por cada escuela</CardDescription>
            </CardHeader>
            <CardContent>
              {byEscuelaBar.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, byEscuelaBar.length * 34)}>
                  <BarChart data={byEscuelaBar} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid {...GRID_STYLE} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} {...AXIS_STYLE} />
                    <YAxis
                      type="category"
                      dataKey="escuela"
                      width={150}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={<TruncatedYAxisTick />}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Entregas" fill={chartColors.teal} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} barSize={16}>
                      <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 600, fill: '#0F1A1A' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="Sin datos de escuela para mostrar" />
              )}
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Entregas por Nivel de programa</CardTitle>
              <CardDescription className="text-xs">Diplomado, curso rápido, pregrado, etc.</CardDescription>
            </CardHeader>
            <CardContent>
              {byNivel.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, byNivel.length * 48)}>
                  <BarChart data={byNivel} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid {...GRID_STYLE} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} {...AXIS_STYLE} />
                    <YAxis
                      type="category"
                      dataKey="nivel"
                      width={110}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={{ fontSize: 11, fill: axisTick.fill }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Entregas" fill={chartColors.rust} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} barSize={22}>
                      <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 600, fill: '#0F1A1A' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="Sin datos de nivel para mostrar" />
              )}
            </CardContent>
          </Card>
        </div>

        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Detalle por Escuela y Nivel</CardTitle>
            <CardDescription className="text-xs">Desglose de niveles de programa dentro de cada escuela</CardDescription>
          </CardHeader>
          <CardContent>
            {byEscuelaNivelDetail.length > 0 ? (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="text-xs w-full border-separate" style={{ borderSpacing: '0 6px' }}>
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Escuela</th>
                      <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Niveles</th>
                      <th className="text-right px-2 py-1.5 font-semibold text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byEscuelaNivelDetail.map((row) => (
                      <tr key={row.escuela}>
                        <td className="px-2 py-2 font-medium whitespace-nowrap max-w-[220px] truncate" title={row.escuela}>
                          {row.escuela}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            {row.niveles.map((n) => (
                              <span
                                key={n.label}
                                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground whitespace-nowrap"
                              >
                                {n.label} · <span className="font-semibold text-foreground">{n.count}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <span className="inline-flex items-center justify-center rounded-md bg-info/10 text-info font-bold px-2 py-0.5 tabular-nums">
                            {row.total}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="Sin datos de escuela para mostrar" />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
