import { Component, ReactNode, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Package, Clock, BarChart3, CalendarDays, AlertTriangle, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from 'recharts';
import {
  useReportOverview,
  useReportProjectsProgress,
  useReportTimeDistribution,
  useReportWorkflowTransitions,
  useReportWorkloadByCargo,
  useReportProjectCategories,
  useReportTasksWeeklyTrend,
  useUserMiniReport,
  type UserMiniReport,
  useReportProjectsTimeline,
  useReportTeamByCargo,
  useReportWeeklyByCargo,
  useReportUnassignedMaterials,
  useReportIndividualPerformance,
  useReportTimeByPhase,
  useReportTasksDetail,
  type IndividualPerformance,
  type TimeByPhase,
  type TaskDetail,
  useReportPersonMetrics,
  useReportCapacityForecast,
  useReportThroughput,
  type ReportScopeFilters,
  type PersonMetric,
} from '@/hooks/useReports';
import { useProjects, type ProjectWithDetails } from '@/hooks/useProjects';
import {
  CHART_COLORS, SERIES_COLORS, STATUS_COLORS, BAR_RADIUS,
  formatDuration, formatHours,
  AXIS_STYLE, GRID_STYLE,
} from '@/components/reports/ReportCharts';
import { axisTick, gridColor, chartColors } from '@/components/charts/chartTheme';
import { CustomTooltip } from '@/components/charts/CustomTooltip';
import { PersonSparkline } from '@/components/reports/PersonSparkline';
import PolarAreaChart from '@/components/reports/PolarAreaChart';
import SankeyDiagram from '@/components/reports/SankeyDiagram';
import { HeroBanner, StatTile, SpotlightCard, AttentionItem } from '@/components/shared/StoryUI';

// Snapshot Operativo style
const CARD_CLASS = 'rounded-2xl border border-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200';

// Ranking colors for top collaborators
const RANKING_COLORS = ['#FBBF24', '#4F46E5', '#0DD9D0', '#6366F1', '#BFEFF0'];

// ---------- Shared band-color helpers (puntualidad primaria, eficiencia de horas secundaria) ----------
function punctualityBandColor(pct: number | null): string {
  if (pct == null) return 'text-muted-foreground';
  if (pct >= 90) return 'text-emerald-600';
  if (pct >= 80) return 'text-amber-600';
  return 'text-red-600';
}

// Two-sided: both over- and under-running the estimate are signals, not just "faster = better".
function efficiencyBandColor(pct: number | null): string {
  if (pct == null) return 'text-muted-foreground';
  if (pct >= 80 && pct <= 120) return 'text-emerald-600';
  if ((pct >= 60 && pct < 80) || (pct > 120 && pct <= 150)) return 'text-amber-600';
  return 'text-red-600';
}

const RISK_BADGE_CLASSES: Record<string, string> = {
  available: 'bg-sky-50 text-sky-700 border-sky-200',
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  over: 'bg-red-50 text-red-700 border-red-200',
};

// Shared date-range control — used by any tab needing a completion-time window.
// Labels are honest about what they actually select (rolling N days, not calendar
// "this week/month" as the previous copy implied).
const REPORT_RANGES = ['7d', '30d', '90d', 'all'] as const;
type ReportRangeKey = typeof REPORT_RANGES[number];

function resolveRange(key: ReportRangeKey): { date_from?: string; date_to?: string } {
  if (key === 'all') return {};
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 90;
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - days);
  return { date_from: from.toISOString().split('T')[0], date_to: now.toISOString().split('T')[0] };
}

function ReportScopeFilterBar({
  projectId, onProjectChange, rangeKey, onRangeChange,
}: {
  projectId: string;
  onProjectChange: (v: string) => void;
  rangeKey: ReportRangeKey;
  onRangeChange: (v: ReportRangeKey) => void;
}) {
  const { data: projects = [] } = useProjects();
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <Select value={projectId} onValueChange={onProjectChange}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Todos los proyectos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los proyectos</SelectItem>
          {projects.map((p: ProjectWithDetails) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={rangeKey} onValueChange={(v) => onRangeChange(v as ReportRangeKey)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Últimos 7 días</SelectItem>
          <SelectItem value="30d">Últimos 30 días</SelectItem>
          <SelectItem value="90d">Últimos 90 días</SelectItem>
          <SelectItem value="all">Todo el tiempo</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// Compact forward-looking capacity strip: one bar per upcoming week, risk-colored.
function CapacityWeekStrip({ weeks }: { weeks: { week_start: string; horas: number; utilizacion_pct: number; risk_color: string; risk_label: string }[] }) {
  if (!weeks || weeks.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {weeks.map((w) => {
        const barColor =
          w.risk_color === 'red' ? CHART_COLORS.coral
          : w.risk_color === 'amber' ? CHART_COLORS.yellow
          : w.risk_color === 'sky' ? chartColors.info
          : CHART_COLORS.green;
        const heightPct = Math.max(8, Math.min(100, w.utilizacion_pct));
        const d = new Date(w.week_start + 'T12:00:00');
        const label = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
        return (
          <div
            key={w.week_start}
            className="flex flex-col items-center gap-0.5"
            title={`Sem. ${label} · ${formatHours(w.horas)} (${w.utilizacion_pct}% · ${w.risk_label})`}
          >
            <div className="h-8 w-3 bg-gray-100 rounded-sm overflow-hidden flex items-end">
              <div className="w-full rounded-sm" style={{ height: `${heightPct}%`, backgroundColor: barColor }} />
            </div>
            <span className="text-[8px] text-muted-foreground">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Error Boundary (evita pantalla en blanco por errores no capturados) ----------
class ReportsErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Error al cargar reportes' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-container flex flex-col items-center justify-center py-16 text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mb-4 text-amber-500" />
          <h2 className="text-lg font-semibold text-foreground mb-1">No se pudo cargar la página de Reportes</h2>
          <p className="text-sm max-w-md text-center mb-2">{this.state.message}</p>
          <p className="text-xs mb-4">Revisa que el backend esté en marcha (puerto 3001) y que hayas iniciado sesión.</p>
          <p className="text-xs text-muted-foreground">Abre la pestaña <strong>Console</strong> (F12) para ver el detalle del error.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------- Tab: Resumen ----------
function TabResumen() {
  const { data: overview, isLoading, isError, error } = useReportOverview();
  const { data: projectsProgress = [] } = useReportProjectsProgress();
  const { data: categories = [] } = useReportProjectCategories();
  const { data: weeklyTrend = [] } = useReportTasksWeeklyTrend();
  const { data: personMetrics } = useReportPersonMetrics();

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertTriangle className="h-10 w-10 mb-3" />
        <p className="text-sm">No se pudo cargar el resumen. {(error as Error)?.message || 'Error de conexión.'}</p>
      </div>
    );
  }

  if (!overview) {
    return <LoadingState />;
  }

  const tasks = overview.tasks ?? {};
  const byStatus = tasks.by_status ?? [];
  // "Activas" = no completadas todavía — tasks.total incluye tareas de proyectos ya
  // finalizados hace tiempo, lo que infla el número sin decir nada sobre el trabajo real.
  const activeTasksCount = byStatus.filter(s => !s.is_completed).reduce((acc, s) => acc + (s.count ?? 0), 0);
  const projectsData = overview.projects ?? { total: 0, active: 0 };
  const materialsData = overview.materials ?? { total: 0, completed: 0, completion_rate: 0 };
  const teamData = overview.team ?? { active_members: 0 };

  // Polar area chart data (solo valores numéricos válidos)
  const statusData = byStatus
    .map((s: { name?: string; count?: number }) => ({
      name: String(s?.name ?? ''),
      value: Number(s?.count ?? 0) || 0,
      color: STATUS_COLORS[s?.name ?? ''] || CHART_COLORS.muted,
    }))
    .filter(s => s.name);

  // Top 5 collaborators by hours delivered (not raw task count — a raw count rewards
  // whoever picks the easiest work; horas_completadas is weighted by real complexity).
  const topPeople = [...(personMetrics?.people ?? [])]
    .sort((a, b) => b.horas_completadas - a.horas_completadas)
    .slice(0, 5);
  const top5 = topPeople.map((t, i) => ({
    name: (t.full_name || 'Sin nombre').split(' ').slice(0, 2).join(' ') || 'Usuario',
    horas: t.horas_completadas,
    puntualidad: t.puntualidad_pct,
    color: RANKING_COLORS[i] || CHART_COLORS.muted,
  }));

  const teamBarConfig: ChartConfig = {
    horas: { label: 'Horas entregadas', color: CHART_COLORS.teal },
  };

  // Project progress for stacked bar
  const projectBarData = (projectsProgress.slice(0, 8) ?? []).map(p => {
    const total = Number(p.total_tasks ?? 0);
    const completed = Number(p.completed_tasks ?? 0);
    const inProgress = Number(p.in_progress_tasks ?? 0);
    const inReview = Number(p.in_review_tasks ?? 0);
    return {
      name: p.key,
      completadas: completed,
      en_progreso: inProgress,
      en_revision: inReview,
      pendientes: Math.max(0, total - completed - inProgress - inReview),
    };
  });

  const projectBarConfig: ChartConfig = {
    completadas: { label: 'Completadas', color: CHART_COLORS.teal },
    en_progreso: { label: 'En progreso', color: CHART_COLORS.indigo },
    en_revision: { label: 'En revisión', color: CHART_COLORS.yellow },
    pendientes: { label: 'Pendientes', color: CHART_COLORS.muted },
  };

  // Packed bubbles data (simple flex layout of bubbles by category)
  const mappedCategories = (categories || []).map(c => {
    let label = 'Sin categoría';
    if (c.category === 'academico') label = 'Académico';
    else if (c.category === 'marketing') label = 'Marketing';
    else if (c.category === 'otros') label = 'Otros';
    else if (c.category === 'desarrollo') label = 'Desarrollo';
    return {
      ...c,
      label,
    };
  });

  // Weekly trend data formatted for chart
  const weeklyData = (weeklyTrend || []).map(p => ({
    week: p.week,
    created: p.created,
    completed: p.completed,
  }));

  const puntualidadGlobal = personMetrics?.overall.puntualidad_pct ?? null;
  const puntualidadTone = puntualidadGlobal == null ? 'info' : puntualidadGlobal >= 90 ? 'good' : puntualidadGlobal >= 80 ? 'warning' : 'critical';

  return (
    <div className="space-y-8">
      <HeroBanner
        eyebrow="Resumen operativo"
        story={
          <>
            <b className="text-white">{projectsData.active}</b> proyectos activos generan{' '}
            <b className="text-white">{activeTasksCount} tareas activas</b>, con{' '}
            <b className="text-white">{puntualidadGlobal != null ? `${puntualidadGlobal}% de puntualidad` : 'puntualidad aún sin datos suficientes'}</b>{' '}
            en las entregas evaluables del equipo.
          </>
        }
        stats={[
          { value: projectsData.active, label: `Proyectos activos de ${projectsData.total}` },
          { value: puntualidadGlobal != null ? `${puntualidadGlobal}%` : '—', label: 'Puntualidad global' },
          { value: teamData.active_members, label: 'Personas activas' },
        ]}
      />
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        <StatTile label="Proyectos activos" value={projectsData.active} sub={`${projectsData.total} totales`} />
        <StatTile label="Tareas totales" value={tasks.total ?? 0} sub={`${overview.recent_completed_30d ?? 0} completadas (30d)`} />
        <StatTile
          label="Materiales"
          value={`${materialsData.completion_rate ?? 0}%`}
          sub={`${materialsData.completed} de ${materialsData.total} completados`}
        />
        <StatTile
          label="Puntualidad global"
          value={puntualidadGlobal != null ? `${puntualidadGlobal}%` : '—'}
          sub={personMetrics ? `${personMetrics.overall.entregas_a_tiempo} de ${personMetrics.overall.entregas_evaluables} a tiempo` : 'Cargando...'}
          pill={{ tone: puntualidadTone, label: puntualidadTone === 'good' ? 'Sólido' : puntualidadTone === 'warning' ? 'Atención' : puntualidadTone === 'critical' ? 'Riesgo' : 'Sin datos' }}
        />
        <StatTile
          label="Equipo activo"
          value={teamData.active_members}
          sub={overview.avg_completion_seconds > 0 ? `Entrega promedio: ${formatDuration(overview.avg_completion_seconds)}` : 'Sin datos de tiempo aún'}
        />
      </div>

      {/* Row 2: Polar Area + Project Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribución de Tareas</CardTitle>
            <CardDescription>Por estado actual · escala logarítmica (para que se vean las categorías pequeñas)</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.some(s => s.value > 0) ? (
              <PolarAreaChart data={statusData} height={280} logScale />
            ) : (
              <EmptyState message="No hay tareas registradas" />
            )}
          </CardContent>
        </Card>

        <Card className={`lg:col-span-2 ${CARD_CLASS}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Progreso por Proyecto</CardTitle>
            <CardDescription>Tareas por estado en cada proyecto</CardDescription>
          </CardHeader>
          <CardContent>
            {projectBarData.length > 0 ? (
              <ChartContainer config={projectBarConfig} className="h-[280px] w-full">
                <BarChart data={projectBarData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid horizontal={false} {...GRID_STYLE} />
                  <XAxis type="number" {...AXIS_STYLE} />
                  <YAxis type="category" dataKey="name" {...AXIS_STYLE} width={55} tick={{ fill: axisTick.fill, fontSize: 12 }} />
                  <ChartTooltip content={<CustomTooltip />} />
                  <Bar dataKey="completadas" stackId="a" fill={CHART_COLORS.teal} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="en_progreso" stackId="a" fill={CHART_COLORS.indigo} />
                  <Bar dataKey="en_revision" stackId="a" fill={CHART_COLORS.yellow} />
                  <Bar dataKey="pendientes" stackId="a" fill={CHART_COLORS.muted} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyState message="No hay proyectos con tareas" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Categorías de proyecto + tendencia semanal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Proyectos por tipo</CardTitle>
            <CardDescription>Académico, Marketing, Otros y Desarrollo</CardDescription>
          </CardHeader>
          <CardContent>
            {mappedCategories.length === 0 ? (
              <EmptyState message="No hay proyectos registrados" />
            ) : (
              <div className="flex flex-wrap gap-4 justify-center pt-2">
                {mappedCategories.map(c => {
                  const size = 60 + Math.min(c.total_projects * 15, 80);
                  const color =
                    c.category === 'academico'
                      ? CHART_COLORS.indigo
                      : c.category === 'marketing'
                        ? CHART_COLORS.teal
                        : c.category === 'otros'
                          ? CHART_COLORS.yellow
                          : c.category === 'desarrollo'
                            ? CHART_COLORS.green
                            : CHART_COLORS.muted;
                  return (
                    <div key={c.category} className="flex flex-col items-center gap-1">
                      <div
                        className="flex items-center justify-center rounded-full shadow-sm text-sm font-semibold text-white cursor-pointer transition-transform duration-200 hover:scale-110 hover:shadow-[0_12px_30px_rgba(15,23,42,0.35)]"
                        style={{ width: size, height: size, background: color }}
                        title={`${c.label}\nProyectos: ${c.total_projects}\nTareas: ${c.total_tasks}`}
                      >
                        {c.total_projects}
                      </div>
                      <span className="text-xs text-muted-foreground">{c.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={`lg:col-span-2 ${CARD_CLASS}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tendencia diaria</CardTitle>
            <CardDescription>Tareas creadas vs. finalizadas (últimos 12 días)</CardDescription>
          </CardHeader>
          <CardContent>
            {weeklyData.length === 0 ? (
              <EmptyState message="No hay datos de tareas recientes" />
            ) : (
              <ChartContainer
                config={{
                  created: { label: 'Creadas', color: CHART_COLORS.indigo },
                  completed: { label: 'Finalizadas', color: CHART_COLORS.teal },
                }}
                className="h-[260px] w-full"
              >
                <LineChart data={weeklyData} margin={{ left: 10, right: 10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" {...GRID_STYLE} />
                  <XAxis
                    dataKey="week"
                    {...AXIS_STYLE}
                    tickFormatter={(v) => {
                      const d = new Date(v + 'T00:00:00');
                      return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
                    }}
                    tick={{ fontSize: 10 }}
                    interval={0}
                  />
                  <YAxis {...AXIS_STYLE} />
                  <ChartTooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="created"
                    stroke={CHART_COLORS.indigo}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke={CHART_COLORS.teal}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Top Collaborators by hours delivered, with punctuality as a second signal */}
      {top5.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <SpotlightCard
            tag="Top colaborador"
            name={top5[0].name}
            metricValue={formatHours(top5[0].horas)}
            metricUnit="entregadas"
            note={top5[0].puntualidad != null ? `${top5[0].puntualidad}% de puntualidad` : 'Sin datos de puntualidad'}
          />
        <Card className={`lg:col-span-2 ${CARD_CLASS}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top colaboradores</CardTitle>
            <CardDescription>Por horas entregadas (ponderado por complejidad, no por conteo de tareas)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={teamBarConfig} className="h-[200px] w-full">
              <BarChart data={top5} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid horizontal={false} {...GRID_STYLE} />
                <XAxis type="number" {...AXIS_STYLE} />
                <YAxis type="category" dataKey="name" {...AXIS_STYLE} width={110} tick={{ fill: axisTick.fill, fontSize: 12 }} />
                <ChartTooltip content={<CustomTooltip />} />
                <Bar dataKey="horas" radius={[0, BAR_RADIUS, BAR_RADIUS, 0]}>
                  {top5.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            <div className="mt-2 space-y-1">
              {top5.map((p) => (
                <div key={p.name} className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>{p.name}</span>
                  <span>{p.puntualidad != null ? `${p.puntualidad}% puntualidad` : 'sin datos de puntualidad'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  );
}

// ---------- Tab: Proyectos ----------
function TabProyectos() {
  const { data: projects = [], isLoading } = useReportProjectsProgress();
  const { data: timeline = [] } = useReportProjectsTimeline();

  if (isLoading) return <LoadingState />;

  if (projects.length === 0) return <EmptyState message="No hay proyectos registrados" />;

  const bgForRate = (n: number) =>
    n >= 70 ? 'bg-emerald-50 text-emerald-700'
      : n >= 40 ? 'bg-amber-50 text-amber-700'
        : 'bg-red-50 text-red-700';

  // Map projects by id for quick lookup in timeline / heatmap
  const projectsById = new Map(projects.map(p => [p.id, p]));

  // Solo proyectos activos en el timeline
  const activeProjects = projects.filter(p => p.status === 'active');
  const validTimeline = (timeline || []).filter(p =>
    (p.start_date || p.estimated_end_date || p.target_date) &&
    projectsById.get(p.id)?.status === 'active'
  );

  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  validTimeline.forEach(p => {
    const start = p.start_date ? new Date(p.start_date + 'T00:00:00') : null;
    const endBase = p.estimated_end_date || p.target_date;
    const end = endBase ? new Date(endBase + 'T00:00:00') : null;
    if (start) {
      if (!minDate || start < minDate) minDate = start;
      if (!maxDate || start > maxDate) maxDate = start;
    }
    if (end) {
      if (!minDate || end < minDate) minDate = end;
      if (!maxDate || end > maxDate) maxDate = end;
    }
  });

  const totalSpan =
    minDate && maxDate
      ? Math.max(maxDate.getTime() - minDate.getTime(), 1)
      : 1;

  const formatShortDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
  };

  const tickDates: string[] = [];
  if (minDate && maxDate) {
    const steps = 4;
    for (let i = 0; i <= steps; i += 1) {
      const t = new Date(minDate.getTime() + (totalSpan * i) / steps);
      tickDates.push(t.toISOString().split('T')[0]);
    }
  }

  const atRiskCount = projects.filter(p => (p.overdue_tasks ?? 0) > 0).length;
  const avgCompletion = projects.length > 0
    ? Math.round(projects.reduce((acc, p) => acc + (p.completion_rate ?? 0), 0) / projects.length)
    : 0;

  return (
    <div className="space-y-8">
      <HeroBanner
        eyebrow="Proyectos"
        story={
          <>
            <b className="text-white">{activeProjects.length} proyectos activos</b> avanzan a un{' '}
            <b className="text-white">{avgCompletion}% de progreso promedio</b>.{' '}
            {atRiskCount > 0
              ? <><b className="text-white">{atRiskCount} {atRiskCount === 1 ? 'está' : 'están'} en riesgo</b> por tareas vencidas.</>
              : 'Ninguno tiene tareas vencidas en este momento.'}
          </>
        }
        stats={[
          { value: projects.length, label: 'Proyectos totales' },
          { value: `${avgCompletion}%`, label: 'Progreso promedio' },
          { value: atRiskCount, label: 'En riesgo' },
        ]}
      />
      {/* Línea de tiempo estimada */}
      {validTimeline.length > 0 && minDate && maxDate && (() => {
        const today = new Date();
        const todayPct = Math.max(0, Math.min(
          ((today.getTime() - minDate!.getTime()) / totalSpan) * 100,
          100
        ));
        const showToday = todayPct > 0 && todayPct < 100;

        return (
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Línea de tiempo</CardTitle>
              <CardDescription>Barra verde = completado · gris/rojo = pendiente · línea = hoy</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[480px]">
                  {/* Column headers */}
                  <div className="flex items-center gap-3 mb-2 px-2">
                    <div className="w-36 flex-shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">Proyecto</div>
                    <div className="flex-1 text-[10px] uppercase tracking-wide text-muted-foreground">Progreso</div>
                    <div className="w-20 flex-shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground text-right">Finaliza</div>
                  </div>

                  <div className="space-y-1">
                    {validTimeline.map(p => {
                      const start = p.start_date ? new Date(p.start_date + 'T00:00:00') : null;
                      const endBase = p.estimated_end_date || p.target_date;
                      const end = endBase ? new Date(endBase + 'T00:00:00') : null;
                      if (!start || !end || !minDate || !maxDate) return null;

                      const startPct = ((start.getTime() - minDate!.getTime()) / totalSpan) * 100;
                      const endPct = Math.min(((end.getTime() - minDate!.getTime()) / totalSpan) * 100, 100);
                      const barWidth = Math.max(endPct - startPct, 1);
                      const completion = Math.max(0, Math.min(p.completion_rate, 100));
                      const completedBarWidth = barWidth * (completion / 100);
                      const remainingBarWidth = barWidth - completedBarWidth;

                      const project = projectsById.get(p.id);
                      const overdue = project?.overdue_tasks ?? p.overdue_tasks ?? 0;
                      const isPastDeadline = end < today && completion < 100;
                      const isAtRisk = overdue > 0 || isPastDeadline;

                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/30 ${isAtRisk ? 'bg-red-50/40' : ''}`}
                        >
                          {/* Project name */}
                          <div className="w-36 flex-shrink-0">
                            <p className="text-xs font-medium truncate text-foreground leading-tight">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground leading-tight">{p.key} · {completion}%</p>
                          </div>

                          {/* Bar track */}
                          <div className="flex-1 relative h-7">
                            {/* Background track */}
                            <div className="absolute inset-0 rounded-md bg-muted/20" />

                            {/* Completed segment */}
                            {completedBarWidth > 0.5 && (
                              <div
                                className="absolute top-0 bottom-0 rounded-l-md flex items-center overflow-hidden"
                                style={{
                                  left: `${startPct}%`,
                                  width: `${completedBarWidth}%`,
                                  background: `linear-gradient(90deg, ${CHART_COLORS.teal}, ${CHART_COLORS.indigo})`,
                                  borderRadius: remainingBarWidth < 0.5 ? '6px' : '6px 0 0 6px',
                                }}
                              >
                                {completedBarWidth > 10 && (
                                  <span className="px-1.5 text-[10px] font-semibold text-white whitespace-nowrap">
                                    {completion}%
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Remaining segment */}
                            {remainingBarWidth > 0.5 && (
                              <div
                                className="absolute top-0 bottom-0"
                                style={{
                                  left: `${startPct + completedBarWidth}%`,
                                  width: `${remainingBarWidth}%`,
                                  backgroundColor: isAtRisk ? CHART_COLORS.coral : CHART_COLORS.muted,
                                  opacity: isAtRisk ? 0.35 : 0.2,
                                  borderRadius: completedBarWidth < 0.5 ? '6px' : '0 6px 6px 0',
                                }}
                              />
                            )}

                            {/* Today line */}
                            {showToday && (
                              <div
                                className="absolute top-0 bottom-0 w-px bg-foreground/50 z-10"
                                style={{ left: `${todayPct}%` }}
                              >
                                <div className="absolute -top-5 -translate-x-1/2 text-[9px] font-semibold text-foreground/70 whitespace-nowrap bg-background px-0.5 rounded">
                                  Hoy
                                </div>
                              </div>
                            )}
                          </div>

                          {/* End date + risk */}
                          <div className="w-20 flex-shrink-0 text-right">
                            {endBase ? (
                              <>
                                <p className={`text-[11px] font-medium leading-tight ${isPastDeadline ? 'text-red-600' : 'text-muted-foreground'}`}>
                                  {formatShortDate(endBase)}
                                </p>
                                {overdue > 0 && (
                                  <p className="text-[10px] text-red-500 leading-tight">{overdue} vencidas</p>
                                )}
                                {isPastDeadline && overdue === 0 && (
                                  <p className="text-[10px] text-red-400 leading-tight">Tarde</p>
                                )}
                              </>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">Sin fecha</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Date axis */}
                  {tickDates.length > 0 && (
                    <div className="mt-3 ml-[153px] mr-[84px]">
                      <div className="h-px bg-border mb-1" />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        {tickDates.map(d => (
                          <span key={d}>{formatShortDate(d)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
        {activeProjects.map(p => (
          <Card key={p.id} className={CARD_CLASS}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{p.key}</Badge>
                    {p.tipo_programa && (
                      <Badge variant="secondary" className="text-xs capitalize">{p.tipo_programa}</Badge>
                    )}
                    {p.overdue_tasks > 0 && (
                      <Badge className="text-[10px] px-1.5 py-0.5 border border-red-200 bg-red-50 text-red-700">
                        ⚠ {p.overdue_tasks} vencidas
                      </Badge>
                    )}
                    {p.due_soon_tasks > 0 && p.overdue_tasks === 0 && (
                      <Badge className="text-[10px] px-1.5 py-0.5 border border-amber-200 bg-amber-50 text-amber-700">
                        {p.due_soon_tasks} vencen pronto
                      </Badge>
                    )}
                  </CardDescription>
                </div>
                <div className="text-2xl font-bold" style={{ color: CHART_COLORS.indigo }}>
                  {p.completion_rate}%
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={p.completion_rate} className="h-2" />
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <p className="font-semibold text-sm">{p.total_tasks}</p>
                  <p className="text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: CHART_COLORS.teal }}>{p.completed_tasks}</p>
                  <p className="text-muted-foreground">Listas</p>
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: CHART_COLORS.indigo }}>{p.in_progress_tasks}</p>
                  <p className="text-muted-foreground">En curso</p>
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: CHART_COLORS.yellow }}>{p.in_review_tasks}</p>
                  <p className="text-muted-foreground">Revisión</p>
                </div>
              </div>
              {p.total_materials > 0 && (
                <div className="flex items-center gap-2 pt-2 border-t text-xs text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  <span>{p.completed_materials} de {p.total_materials} materiales completados</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Matriz de riesgo */}
      <Card className={CARD_CLASS}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Matriz de riesgo</CardTitle>
          <CardDescription>Avance vs tareas vencidas — tamaño = volumen total</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <div className="min-w-[320px] h-[300px]">
              <ScatterChart width={600} height={280} margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Avance"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  label={{
                    value: 'Avance (%)',
                    position: 'insideBottom',
                    offset: -10,
                    fontSize: 11,
                    fill: axisTick.fill,
                  }}
                  {...AXIS_STYLE}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Vencidas"
                  label={{
                    value: 'Tareas vencidas',
                    angle: -90,
                    position: 'insideLeft',
                    fontSize: 11,
                    fill: axisTick.fill,
                  }}
                  {...AXIS_STYLE}
                />
                <ZAxis type="number" dataKey="z" range={[40, 400]} />
                <ReferenceLine x={50} stroke={CHART_COLORS.muted} strokeDasharray="4 4" />
                <ReferenceLine y={0} stroke={CHART_COLORS.muted} />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as {
                      name: string;
                      completion_rate: number;
                      overdue_tasks: number;
                      total_tasks: number;
                    };
                    return (
                      <div className="rounded-lg border bg-background p-2 text-xs shadow-md">
                        <p className="font-semibold">{d.name}</p>
                        <p>Avance: {d.completion_rate}%</p>
                        <p>Vencidas: {d.overdue_tasks}</p>
                        <p>Total tareas: {d.total_tasks}</p>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={projects.map(p => ({
                    x: p.completion_rate,
                    y: p.overdue_tasks,
                    z: Math.max((p.total_tasks || 0) * 8, 40),
                    name: p.key,
                    completion_rate: p.completion_rate,
                    overdue_tasks: p.overdue_tasks,
                    total_tasks: p.total_tasks,
                  }))}
                  fill={CHART_COLORS.indigo}
                  opacity={0.75}
                >
                  {projects.map((p, index) => {
                    const y = p.overdue_tasks;
                    const x = p.completion_rate;
                    const fill =
                      y >= 3 || x < 20
                        ? CHART_COLORS.coral
                        : y > 0
                          ? CHART_COLORS.yellow
                          : x >= 70
                            ? CHART_COLORS.teal
                            : CHART_COLORS.indigo;
                    return <Cell // eslint-disable-line react/no-array-index-key
                      key={index}
                      fill={fill}
                    />;
                  })}
                </Scatter>
              </ScatterChart>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>🔴 Crítico (vencidas ≥ 3 o avance &lt; 20%)</span>
            <span>🟡 En riesgo (tiene vencidas)</span>
            <span>🟢 En buen camino (avance ≥ 70%)</span>
            <span>🔵 Normal</span>
          </div>
        </CardContent>
      </Card>

      {/* Salud de proyectos */}
      <Card className={CARD_CLASS}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Salud de proyectos</CardTitle>
          <CardDescription>Indicadores clave por proyecto</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 px-2 font-medium">Proyecto</th>
                  <th className="text-center py-2 px-2 font-medium">Avance</th>
                  <th className="text-center py-2 px-2 font-medium">Vencidas</th>
                  <th className="text-center py-2 px-2 font-medium">Pronto</th>
                  <th className="text-center py-2 px-2 font-medium">Materiales</th>
                  <th className="text-center py-2 px-2 font-medium">Riesgo</th>
                </tr>
              </thead>
              <tbody>
                {activeProjects.map(p => {
                  const materialsRate =
                    p.total_materials > 0
                      ? Math.round((p.completed_materials / p.total_materials) * 100)
                      : 0;
                  const risk =
                    p.overdue_tasks >= 3 || p.completion_rate < 20
                      ? 'crítico'
                      : p.overdue_tasks > 0 || p.due_soon_tasks > 2
                        ? 'riesgo'
                        : p.completion_rate >= 70
                          ? 'ok'
                          : 'normal';

                  const riskClass =
                    risk === 'crítico'
                      ? 'border-red-200 bg-red-50 text-red-700 text-[11px]'
                      : risk === 'riesgo'
                        ? 'border-amber-200 bg-amber-50 text-amber-700 text-[11px]'
                        : risk === 'ok'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px]'
                          : 'border-slate-200 bg-slate-50 text-slate-600 text-[11px]';

                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-2">
                        <div className="flex flex-col">
                          <span className="font-medium text-xs truncate">{p.name}</span>
                          <span className="text-[11px] text-muted-foreground">{p.key}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${bgForRate(p.completion_rate)}`}>
                          {p.completion_rate}%
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className={
                            p.overdue_tasks > 0
                              ? 'inline-flex px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px]'
                              : 'text-muted-foreground text-[11px]'
                          }
                        >
                          {p.overdue_tasks}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className={
                            p.due_soon_tasks > 0
                              ? 'inline-flex px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px]'
                              : 'text-muted-foreground text-[11px]'
                          }
                        >
                          {p.due_soon_tasks}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${bgForRate(materialsRate)}`}>
                          {materialsRate}%
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full border ${riskClass}`}>
                          {risk}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Tab: Equipo ----------
function TabEquipo() {
  const { data: personMetrics, isLoading: loadingPeople } = useReportPersonMetrics();
  const { data: capacity, isLoading: loadingCapacity } = useReportCapacityForecast({ weeks: 4 });
  const { data: workload = [] } = useReportWorkloadByCargo();
  const { data: throughput = [] } = useReportThroughput({ bucket: 'week', group_by: 'person' });

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cargoFilter, setCargoFilter] = useState<string>('all');
  const { data: userReport, isLoading: loadingUserReport } = useUserMiniReport(selectedUserId);

  if (loadingPeople || loadingCapacity) return <LoadingState />;

  const people = personMetrics?.people ?? [];
  if (people.length === 0) return <EmptyState message="No hay datos de equipo" />;

  const peopleById = new Map(people.map(p => [p.id, p]));

  const workloadConfig: ChartConfig = {
    completed_tasks: { label: 'Completadas', color: CHART_COLORS.teal },
    pending_tasks: { label: 'Pendientes', color: CHART_COLORS.indigo },
  };

  const workloadData = workload.map(w => ({
    name: w.cargo,
    completed_tasks: w.completed_tasks,
    pending_tasks: w.total_tasks - w.completed_tasks,
    team_count: w.team_count,
  }));

  const capacityMembers = capacity?.members ?? [];
  const overall = capacity?.overall;

  const overallHolguraDisplay = overall
    ? overall.holgura_horas >= 0
      ? `Holgura ${formatHours(overall.holgura_horas)}`
      : `Exceso ${formatHours(Math.abs(overall.holgura_horas))}`
    : '0h';

  // Weekly throughput (hours), stacked by top-5 people + "Otros" — replaces the old
  // raw monthly task-count chart.
  const throughputWeeks = Array.from(new Set(throughput.map(t => t.bucket_start))).sort((a, b) => a.localeCompare(b));
  const hoursByPerson = new Map<string, number>();
  throughput.forEach(t => hoursByPerson.set(t.key, (hoursByPerson.get(t.key) ?? 0) + t.horas));
  const topThroughputPeople = Array.from(hoursByPerson.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => key);
  const extraThroughputPeople = Array.from(hoursByPerson.keys()).filter(k => !topThroughputPeople.includes(k));
  const labelByKey = new Map(throughput.map(t => [t.key, t.label]));

  const throughputData = throughputWeeks.map(week => {
    const base: Record<string, number | string> = {
      week: new Date(week + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
    };
    topThroughputPeople.forEach(key => {
      const label = labelByKey.get(key) ?? key;
      const match = throughput.find(t => t.bucket_start === week && t.key === key);
      base[label] = match ? match.horas : 0;
    });
    if (extraThroughputPeople.length > 0) {
      base.Otros = throughput
        .filter(t => t.bucket_start === week && extraThroughputPeople.includes(t.key))
        .reduce((sum, t) => sum + t.horas, 0);
    }
    return base;
  });
  const throughputSeriesNames = [
    ...topThroughputPeople.map(k => labelByKey.get(k) ?? k),
    ...(extraThroughputPeople.length > 0 ? ['Otros'] : []),
  ];
  const throughputBarConfig: ChartConfig = throughputSeriesNames.reduce((acc, name, idx) => {
    acc[name] = { label: name, color: RANKING_COLORS[idx % RANKING_COLORS.length] };
    return acc;
  }, {} as ChartConfig);

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-8">
      {/* Capacity Section */}
      {capacity && capacityMembers.length > 0 && (
        <>
          {/* Global team capacity indicator */}
          {overall && (
            <>
              <HeroBanner
                eyebrow="Equipo · compromiso semana actual"
                story={
                  <>
                    El equipo está al <b className="text-white">{overall.utilizacion_pct}% de utilización</b> esta semana —{' '}
                    <b className="text-white">{formatHours(overall.carga_semana_actual)}</b> comprometidas de{' '}
                    <b className="text-white">{formatHours(overall.capacidad_total)}</b> disponibles.{' '}
                    {overall.risk_counts.over > 0
                      ? <><b className="text-white">{overall.risk_counts.over} {overall.risk_counts.over === 1 ? 'persona está sobrecargada' : 'personas están sobrecargadas'}</b>.</>
                      : 'Nadie está sobrecargado en este momento.'}{' '}
                    {overall.unidades_semana_actual_sin_estimacion > 0 && (
                      <>
                        Ojo: <b className="text-white">{overall.unidades_semana_actual_sin_estimacion} {overall.unidades_semana_actual_sin_estimacion === 1 ? 'tarea activa' : 'tareas activas'} de esta semana no {overall.unidades_semana_actual_sin_estimacion === 1 ? 'tiene' : 'tienen'} horas estimadas</b>, así que no cuentan en este % — la utilización real puede ser más alta.
                      </>
                    )}
                  </>
                }
                stats={[
                  { value: `${overall.utilizacion_pct}%`, label: 'Utilización semana actual' },
                  { value: overallHolguraDisplay, label: 'Holgura / exceso' },
                  { value: overall.risk_counts.available, label: 'Con espacio disponible' },
                ]}
              />
              <div className="flex flex-wrap gap-2">
                {overall.risk_counts.available > 0 && (
                  <Badge variant="outline" className={`px-2 py-0.5 text-[11px] ${RISK_BADGE_CLASSES.available}`}>
                    Disponible · {overall.risk_counts.available}
                  </Badge>
                )}
                {overall.risk_counts.ok > 0 && (
                  <Badge variant="outline" className={`px-2 py-0.5 text-[11px] ${RISK_BADGE_CLASSES.ok}`}>
                    OK · {overall.risk_counts.ok}
                  </Badge>
                )}
                {overall.risk_counts.warning > 0 && (
                  <Badge variant="outline" className={`px-2 py-0.5 text-[11px] ${RISK_BADGE_CLASSES.warning}`}>
                    Riesgo · {overall.risk_counts.warning}
                  </Badge>
                )}
                {overall.risk_counts.over > 0 && (
                  <Badge variant="outline" className={`px-2 py-0.5 text-[11px] ${RISK_BADGE_CLASSES.over}`}>
                    Sobrecargado · {overall.risk_counts.over}
                  </Badge>
                )}
                {overall.unidades_semana_actual_sin_estimacion > 0 && (
                  <Badge variant="outline" className="px-2 py-0.5 text-[11px] bg-amber-50 text-amber-700 border-amber-200">
                    Sin horas estimadas · {overall.unidades_semana_actual_sin_estimacion}
                  </Badge>
                )}
              </div>
            </>
          )}

          {/* Schedule info bar */}
          <Card className={`${CARD_CLASS} border-teal-200 bg-teal-50/50`}>
            <CardContent className="flex flex-wrap items-center gap-4 py-3 text-xs">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-teal-600" />
                <span className="font-medium text-teal-900">Jornada laboral:</span>
              </div>
              {capacity.schedule && (
                <>
                  <span className="text-teal-700">Lun-Jue: {capacity.schedule.mon_thu_hours}h</span>
                  <span className="text-teal-700">Vie: {capacity.schedule.friday_hours}h</span>
                  <span className="text-teal-700 font-semibold">Semanal: {capacity.schedule.weekly_hours}h</span>
                  <span className="text-teal-700">Promedio diario: {capacity.schedule.avg_daily_hours}h</span>
                </>
              )}
            </CardContent>
          </Card>

          {/* Attention panel: overloaded people, most severe first */}
          {(() => {
            const overloaded = [...capacityMembers]
              .filter(m => m.current.risk_level === 'over')
              .sort((a, b) => b.current.utilizacion_pct - a.current.utilizacion_pct)
              .slice(0, 5);
            if (overloaded.length === 0) return null;
            return (
              <div className="space-y-2">
                {overloaded.map(m => (
                  <AttentionItem
                    key={m.id}
                    severity="critical"
                    title={m.full_name || 'Sin nombre'}
                    description={`${m.current.utilizacion_pct}% de utilización esta semana · ${formatHours(Math.abs(m.current.holgura_horas))} de exceso`}
                    cta="Ver detalle"
                    onClick={() => { setSelectedUserId(String(m.id)); setDrawerOpen(true); }}
                  />
                ))}
              </div>
            );
          })()}

          {/* Cargo filter */}
          {(() => {
            const cargos = Array.from(
              new Set(capacityMembers.map(m => m.cargo || 'Sin cargo'))
            ).sort();
            return (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-muted-foreground font-medium">Filtrar por cargo:</span>
                <button
                  onClick={() => setCargoFilter('all')}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    cargoFilter === 'all'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-muted'
                  }`}
                >
                  Todos ({capacityMembers.length})
                </button>
                {cargos.map(cargo => {
                  const count = capacityMembers.filter(m => (m.cargo || 'Sin cargo') === cargo).length;
                  return (
                    <button
                      key={cargo}
                      onClick={() => setCargoFilter(cargoFilter === cargo ? 'all' : cargo)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        cargoFilter === cargo
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:bg-muted'
                      }`}
                    >
                      {cargo} ({count})
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Capacity cards per person */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {capacityMembers.filter(m =>
              cargoFilter === 'all' || (m.cargo || 'Sin cargo') === cargoFilter
            ).map(member => {
              const pm = peopleById.get(member.id);
              const isOverloaded = member.current.utilizacion_pct > 100;
              const barPct = Math.min(member.current.utilizacion_pct, 200) / 2; // Scale: 200% = full bar
              const riskBadgeClass = RISK_BADGE_CLASSES[member.current.risk_level] ?? RISK_BADGE_CLASSES.ok;

              const holgura = member.current.holgura_horas;
              const gapText = holgura !== 0
                ? holgura < 0
                  ? `Exceso +${formatHours(Math.abs(holgura))}`
                  : `Holgura ${formatHours(holgura)}`
                : null;

              const onClick = () => {
                setSelectedUserId(String(member.id));
                setDrawerOpen(true);
              };

              return (
                <Card key={member.id} className={CARD_CLASS}>
                  <button
                    type="button"
                    onClick={onClick}
                    className="w-full text-left pt-5 pb-4 px-4 space-y-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-2xl hover:bg-muted/40 transition-colors"
                  >
                    {/* Header: Avatar + Name + Risk badge */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.avatar_url || ''} />
                        <AvatarFallback className="text-xs">
                          {(member.full_name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('') || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">{member.full_name || 'Sin nombre'}</p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 border ${riskBadgeClass}`}>
                            {member.current.risk_label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{member.cargo || 'Sin cargo'}</p>
                      </div>
                    </div>

                    {/* Metrics row */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold" style={{ color: CHART_COLORS.indigo }}>
                          {pm?.unidades_pendientes ?? '-'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Pendientes</p>
                      </div>
                      <div>
                        <p className={`text-lg font-bold ${punctualityBandColor(pm?.puntualidad_pct ?? null)}`}>
                          {pm?.puntualidad_pct != null ? `${pm.puntualidad_pct}%` : '-'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Puntualidad</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold" style={{ color: isOverloaded ? CHART_COLORS.coral : CHART_COLORS.teal }}>
                          {member.backlog.dias_para_vaciar > 0 ? `${member.backlog.dias_para_vaciar}d` : '-'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Días backlog</p>
                      </div>
                    </div>

                    {/* Utilization bar + gap */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">Compromiso semana actual</span>
                        <span className={`font-semibold ${isOverloaded ? 'text-red-500' : ''}`}>
                          {member.current.utilizacion_pct}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(barPct, 100)}%`,
                            background: isOverloaded
                              ? `linear-gradient(90deg, ${CHART_COLORS.yellow}, ${CHART_COLORS.coral})`
                              : `linear-gradient(90deg, ${CHART_COLORS.indigo}, ${CHART_COLORS.tealDark})`,
                          }}
                        />
                      </div>
                      {gapText && (
                        <div className="flex justify-between text-[10px] mt-1">
                          <span className="text-muted-foreground">Gap semana actual</span>
                          <span className={`font-medium ${holgura < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {gapText}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Proyección próximas semanas */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[9px] text-muted-foreground">Próximas semanas</span>
                      <CapacityWeekStrip weeks={member.weeks} />
                    </div>

                    {/* Footer: backlog drain estimate + warnings */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t">
                      {member.backlog.fecha_backlog_vacio ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          <span>Backlog libre ~{formatDate(member.backlog.fecha_backlog_vacio)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sin backlog pendiente</span>
                      )}
                      {(member.backlog.unidades_sin_estimacion > 0 || member.backlog.horas_sin_fecha > 0) && (
                        <div className="flex items-center gap-1 text-amber-500" title="Trabajo sin estimación u sin fecha límite">
                          <AlertTriangle className="h-3 w-3" />
                          <span className="text-[10px]">
                            {member.backlog.unidades_sin_estimacion > 0 && `${member.backlog.unidades_sin_estimacion} sin est.`}
                            {member.backlog.unidades_sin_estimacion > 0 && member.backlog.horas_sin_fecha > 0 && ' · '}
                            {member.backlog.horas_sin_fecha > 0 && `${formatHours(member.backlog.horas_sin_fecha)} sin fecha`}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Workload by Cargo Chart */}
      {workloadData.length > 0 && (
        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Carga por Cargo</CardTitle>
            <CardDescription>Tareas completadas vs pendientes por rol</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={workloadConfig} className="h-[220px] w-full">
              <BarChart data={workloadData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid horizontal={false} {...GRID_STYLE} />
                <XAxis type="number" {...AXIS_STYLE} />
                <YAxis type="category" dataKey="name" {...AXIS_STYLE} width={130} tick={{ fill: axisTick.fill, fontSize: 12 }} />
                <ChartTooltip content={<CustomTooltip />} />
                <Bar dataKey="completed_tasks" stackId="a" fill={CHART_COLORS.teal} radius={[0, 0, 0, 0]} />
                <Bar dataKey="pending_tasks" stackId="a" fill={CHART_COLORS.indigo} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Velocidad del equipo (horas entregadas) */}
      {throughputData.length > 0 && (
        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Velocidad del equipo (horas entregadas)</CardTitle>
            <CardDescription>Horas de trabajo completadas por semana, por colaborador</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={throughputBarConfig} className="h-[240px] w-full">
              <BarChart data={throughputData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="week" {...AXIS_STYLE} />
                <YAxis {...AXIS_STYLE} tickFormatter={(v) => `${v}h`} />
                <ChartTooltip content={<CustomTooltip />} />
                {throughputSeriesNames.map((name, idx) => (
                  <Bar
                    key={name}
                    dataKey={name}
                    stackId="a"
                    fill={RANKING_COLORS[idx % RANKING_COLORS.length]}
                    radius={idx === throughputSeriesNames.length - 1 ? [BAR_RADIUS, BAR_RADIUS, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Drawer lateral de mini-reporte por usuario */}
      <Dialog open={drawerOpen} onOpenChange={open => setDrawerOpen(open)}>
        <DialogContent className="sm:max-w-[480px] sm:ml-auto sm:mr-4 w-full h-[90vh] sm:h-[90vh] flex flex-col p-0 border-l shadow-xl">
          <DialogHeader className="px-4 pt-4 pb-2 border-b">
            <DialogTitle className="text-base">
              {userReport?.user.full_name || 'Detalle de colaborador'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Resumen de carga, riesgos y tareas en curso.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
            {loadingUserReport && (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cargando resumen del colaborador...
              </div>
            )}

            {!loadingUserReport && userReport && (
              <>
                {/* Encabezado con avatar y badge de salud */}
                <ColaboradorHeader report={userReport} />

                {/* Distribución de tareas por estado */}
                <TareasPorEstadoChart report={userReport} />

                {/* Alertas clave */}
                <AlertasClave report={userReport} />

                {/* Tareas en curso */}
                <TareasCriticasList report={userReport} />

                {/* Capacidad y planificación */}
                <CapacidadResumen report={userReport} />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Team Table */}
      <Card className={CARD_CLASS}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rendimiento del Equipo</CardTitle>
          <CardDescription>Puntualidad primero — la señal principal de eficiencia real</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 px-2 font-medium">Colaborador</th>
                  <th className="text-left py-3 px-2 font-medium">Cargo</th>
                  <th className="text-center py-3 px-2 font-medium">Puntualidad</th>
                  <th className="text-center py-3 px-2 font-medium">Unidades</th>
                  <th className="text-center py-3 px-2 font-medium">Horas entregadas</th>
                  <th className="text-center py-3 px-2 font-medium">Est./Efectivo</th>
                  <th className="text-center py-3 px-2 font-medium">Sin estimación</th>
                </tr>
              </thead>
              <tbody>
                {[...people].sort((a, b) => b.horas_completadas - a.horas_completadas).map(member => (
                  <tr key={member.id} className="border-b last:border-0 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={member.avatar_url || ''} />
                          <AvatarFallback className="text-xs">
                            {(member.full_name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('') || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate max-w-[150px]">{member.full_name || 'Sin nombre'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-muted-foreground text-xs">{member.cargo || '-'}</span>
                    </td>
                    <td className={`py-3 px-2 text-center font-semibold ${punctualityBandColor(member.puntualidad_pct)}`}>
                      {member.puntualidad_pct != null ? `${member.puntualidad_pct}%` : '-'}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {member.unidades_completadas} / {member.unidades_asignadas}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span style={{ color: CHART_COLORS.teal }} className="font-medium">
                        {member.horas_completadas > 0 ? formatHours(member.horas_completadas) : '-'}
                      </span>
                    </td>
                    <td className={`py-3 px-2 text-center ${efficiencyBandColor(member.eficiencia_horas_pct)}`}>
                      {member.eficiencia_horas_pct != null ? `${member.eficiencia_horas_pct}%` : '—'}
                    </td>
                    <td className="py-3 px-2 text-center text-muted-foreground">{member.unidades_sin_estimacion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Componentes auxiliares para el drawer de Equipo ----------

function ColaboradorHeader({ report }: { report: UserMiniReport }) {
  const { user, summary, health } = report;

  const healthClasses =
    health.color === 'red'
      ? 'border-red-200 bg-red-50 text-red-700'
      : health.color === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : health.color === 'slate'
          ? 'border-slate-200 bg-slate-50 text-slate-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  const shortReasons = health.reasons.slice(0, 2).join(' · ');

  return (
    <Card className="border border-border/80 shadow-none">
      <CardContent className="pt-3 pb-3 px-3 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatar_url || ''} />
            <AvatarFallback className="text-xs">
              {(user.full_name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('') || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm truncate">{user.full_name || 'Sin nombre'}</p>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${healthClasses}`}>
                {health.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {user.cargo || 'Sin cargo asignado'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Resumen rápido</p>
            <p className="text-[11px] text-foreground">
              {summary.pending_tasks} pendientes, {summary.overdue_tasks} vencidas,{' '}
              {summary.today_tasks} para hoy.
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Capacidad semanal</p>
            <p className="text-[11px] text-foreground">
              Utilización {summary.utilization_pct}% ·{' '}
              {summary.holgura_horas > 0
                ? `Holgura ${formatHours(summary.holgura_horas)}`
                : `Exceso ${formatHours(Math.abs(summary.capacity_gap_hours))}`}
            </p>
          </div>
        </div>

        {shortReasons && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
            {shortReasons}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TareasPorEstadoChart({ report }: { report: UserMiniReport }) {
  const data = report.tasks_by_status
    .filter(b => b.count > 0)
    .map(b => ({
      name: b.status_name,
      count: b.count,
      is_completed: b.is_completed,
    }));

  if (data.length === 0) {
    return <EmptyState message="No hay tareas asignadas a este colaborador" />;
  }

  const config: ChartConfig = {
    count: { label: 'Tareas', color: CHART_COLORS.indigo },
  };

  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Estado de tareas</CardTitle>
        <CardDescription className="text-xs">Distribución por estado actual</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[200px] w-full">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
          >
            <CartesianGrid horizontal={false} {...GRID_STYLE} />
            <XAxis type="number" {...AXIS_STYLE} />
            <YAxis
              type="category"
              dataKey="name"
              {...AXIS_STYLE}
              width={90}
              tick={{ fill: axisTick.fill, fontSize: 11 }}
            />
            <ChartTooltip content={<CustomTooltip />} />
            <Bar dataKey="count" fill={CHART_COLORS.indigo} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]}>
              {data.map((item, idx) => (
                <Cell
                  // eslint-disable-next-line react/no-array-index-key
                  key={idx}
                  fill={item.is_completed ? CHART_COLORS.teal : CHART_COLORS.indigo}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function AlertasClave({ report }: { report: UserMiniReport }) {
  const { summary } = report;

  const items: { label: string; value: number; tone: 'red' | 'amber' | 'slate' | 'teal' }[] = [
    { label: 'Vencidas', value: summary.overdue_tasks, tone: 'red' },
    { label: 'Vencen hoy', value: summary.today_tasks, tone: 'amber' },
    { label: 'Sin estimación', value: summary.tasks_sin_estimacion, tone: 'amber' },
    { label: 'Alta prioridad', value: summary.high_priority_tasks, tone: 'red' },
  ];

  const visible = items.filter(i => i.value > 0);

  if (visible.length === 0) {
    return null;
  }

  const toneClass = (tone: 'red' | 'amber' | 'slate' | 'teal') => {
    if (tone === 'red') return 'border-red-200 bg-red-50 text-red-700';
    if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (tone === 'teal') return 'border-teal-200 bg-teal-50 text-teal-700';
    return 'border-slate-200 bg-slate-50 text-slate-700';
  };

  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Alertas clave</CardTitle>
        <CardDescription className="text-xs">
          Indicadores para priorizar conversaciones y ajustes de carga.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {visible.map(item => (
          <Badge
            key={item.label}
            variant="outline"
            className={`px-2 py-1 text-[11px] font-medium ${toneClass(item.tone)}`}
          >
            {item.label}: {item.value}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

function TareasCriticasList({ report }: { report: UserMiniReport }) {
  const tasks = report.top_tasks;

  if (!tasks || tasks.length === 0) {
    return null;
  }

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  const priorityLabel: Record<string, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    urgent: 'Urgente',
  };

  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Tareas en curso</CardTitle>
        <CardDescription className="text-xs">
          Tareas actualmente en proceso, en revisión o en pausa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map(task => (
          <div
            key={task.id}
            className="border border-border/60 rounded-lg px-2.5 py-2 text-xs flex flex-col gap-1 bg-background/80"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium truncate">{task.title}</p>
              <span className="text-[11px] text-muted-foreground">
                {task.project.key || ''} {task.project.name}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="px-1.5 py-0.5 text-[10px]">
                  {task.status_name}
                </Badge>
                {task.priority && (
                  <Badge
                    variant="outline"
                    className={`px-1.5 py-0.5 text-[10px] ${
                      task.priority === 'high' || task.priority === 'urgent'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-sky-200 bg-sky-50 text-sky-700'
                    }`}
                  >
                    {priorityLabel[task.priority] || task.priority}
                  </Badge>
                )}
                {task.horas_estimadas == null && (
                  <Badge
                    variant="outline"
                    className="px-1.5 py-0.5 text-[10px] border-amber-200 bg-amber-50 text-amber-700"
                  >
                    Sin estimación
                  </Badge>
                )}
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] text-muted-foreground">
                  Compromiso: {formatDateShort(task.due_date)}
                </span>
                {task.horas_estimadas != null && task.horas_estimadas > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    Est.: {formatHours(task.horas_estimadas)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CapacidadResumen({ report }: { report: UserMiniReport }) {
  const { summary } = report;

  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Capacidad y planificación</CardTitle>
        <CardDescription className="text-xs">
          Relación entre horas asignadas, capacidad semanal y días de trabajo aproximados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Capacidad semanal</p>
            <p className="text-[11px] font-medium">
              {formatHours(summary.weekly_hours_capacity)} disponibles
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Horas pendientes</p>
            <p className="text-[11px] font-medium">
              {summary.pending_horas > 0 ? formatHours(summary.pending_horas) : '0h'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Utilización</p>
            <p className="text-[11px] font-medium">{summary.utilization_pct}%</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Gap / Holgura</p>
            <p className="text-[11px] font-medium">
              {summary.capacity_gap_hours < 0
                ? `Holgura ${formatHours(Math.abs(summary.capacity_gap_hours))}`
                : `Exceso ${formatHours(summary.capacity_gap_hours)}`}
            </p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Este resumen usa las mismas horas semanales configuradas en la sección de capacidad del
          equipo.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------- Tab: Eficiencia — helpers ----------

function EficSectionHeader({ tag, title }: { tag: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-5">
      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md uppercase tracking-widest whitespace-nowrap">
        {tag}
      </span>
      <h2 className="text-[15px] font-black tracking-tight text-foreground">{title}</h2>
    </div>
  );
}

function BulletBar({ label, value, meta = 85 }: { label: string; value: number | null; meta?: number }) {
  const v = value ?? 0;
  const fillPct = Math.min(v, 100);
  const color = v >= meta ? CHART_COLORS.green : v >= 60 ? CHART_COLORS.yellow : CHART_COLORS.coral;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="font-medium truncate max-w-[60%]">{label}</span>
        <span className="font-bold tabular-nums" style={{ color }}>{value != null ? `${v}%` : '—'}</span>
      </div>
      <div className="relative h-4 rounded overflow-hidden flex">
        <div className="h-full bg-red-100" style={{ width: '60%' }} />
        <div className="h-full bg-amber-100" style={{ width: '20%' }} />
        <div className="h-full bg-emerald-100" style={{ width: '20%' }} />
        <div className="absolute inset-y-1 left-0 rounded transition-all" style={{ width: `${fillPct}%`, backgroundColor: color, opacity: 0.7 }} />
        <div className="absolute top-0 bottom-0 w-[2px] bg-gray-700/40" style={{ left: `${meta}%` }} />
      </div>
      <div className="flex text-[9px] text-muted-foreground mt-0.5 relative">
        <span>0%</span>
        <span className="absolute" style={{ left: `${meta - 3}%` }}>meta {meta}%</span>
        <span className="ml-auto">100%</span>
      </div>
    </div>
  );
}

function PhaseAnatomyBar({ person, phases }: { person: string; phases: TimeByPhase['phases'] }) {
  const total = phases.reduce((s, p) => s + p.avg_hours, 0);
  if (total === 0) return null;
  return (
    <div className="mb-3">
      <div className="text-[11px] font-medium mb-1 truncate">{person}</div>
      <div className="flex h-5 rounded overflow-hidden gap-px">
        {phases.map((p) => {
          const pct = (p.avg_hours / total) * 100;
          if (pct < 1) return null;
          return (
            <div
              key={p.status_name}
              className="flex items-center justify-center overflow-hidden"
              style={{ width: `${pct}%`, backgroundColor: p.status_color || axisTick.fill }}
              title={`${p.status_name}: ${p.avg_hours.toFixed(1)}h (${pct.toFixed(0)}%)`}
            >
              {pct > 10 && <span className="text-[8px] font-bold text-white/90 px-1 truncate">{pct.toFixed(0)}%</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PersonCard({ person }: { person: IndividualPerformance }) {
  const completionRate = person.total_tareas > 0
    ? Math.round((person.tareas_completadas / person.total_tareas) * 100) : null;
  const semCls = (v: number | null) =>
    v == null ? 'bg-slate-100 text-slate-500' :
    v >= 85 ? 'bg-emerald-100 text-emerald-800' :
    v >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
  return (
    <Card className={CARD_CLASS}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={person.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{person.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate leading-tight">{person.full_name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{person.cargo ?? '—'}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {([
            { label: 'Eficiencia', value: person.eficiencia_pct },
            { label: 'Puntualidad', value: person.puntualidad_pct },
            { label: 'Completadas', value: completionRate },
            { label: 'Total tareas', value: person.total_tareas, noUnit: true },
          ] as { label: string; value: number | null; noUnit?: boolean }[]).map((d) => (
            <div key={d.label} className={`rounded-lg px-2 py-2 text-center ${semCls(d.value)}`}>
              <p className="text-lg font-black leading-none">{d.value != null ? `${d.value}${d.noUnit ? '' : '%'}` : '—'}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wide mt-0.5 opacity-80">{d.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Tab: Eficiencia ----------
function TabEficiencia() {
  const { data: overview } = useReportOverview();
  const { data: timeDist = [], isLoading: loadingTime } = useReportTimeDistribution();
  const { data: transitions = [], isLoading: loadingTrans } = useReportWorkflowTransitions();
  const { data: teamByCargo = [], isLoading: loadingCargo } = useReportTeamByCargo();
  const { data: weeklyByCargo = [] } = useReportWeeklyByCargo();
  const { data: unassignedMaterials = [] } = useReportUnassignedMaterials();
  const { data: timeByPhase = [], isLoading: loadingPhase } = useReportTimeByPhase();
  const { data: indPerf = [], isLoading: loadingIndPerf } = useReportIndividualPerformance();
  const { data: tasks = [], isLoading: loadingTasks } = useReportTasksDetail();
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [filterCargo, setFilterCargo] = useState<string>('all');
  const [taskSearch, setTaskSearch] = useState('');
  const [sortCol, setSortCol] = useState<keyof TaskDetail>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Solo bloquea con spinner si los datos de encabezado aún no llegaron
  if (loadingCargo && loadingTime && loadingTrans) return <LoadingState />;

  // ── Filtro por cargo ────────────────────────────────────────────────────
  // Número de personas por cargo (no suma de tareas)
  const cargoGroups = teamByCargo.reduce<Record<string, number>>((acc, m) => {
    const c = m.cargo || 'Sin cargo';
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});
  const totalAllPersons = teamByCargo.length;

  const filteredTeam    = filterCargo === 'all' ? teamByCargo   : teamByCargo.filter((m) => m.cargo === filterCargo);
  const filteredIndPerf = filterCargo === 'all' ? indPerf       : indPerf.filter((p) => p.cargo === filterCargo);
  const filteredPhase   = filterCargo === 'all' ? timeByPhase   : timeByPhase.filter((p) => {
    const member = teamByCargo.find((m) => m.full_name === p.full_name);
    return member?.cargo === filterCargo;
  });

  // ── ① Resumen ──────────────────────────────────────────────────────────
  const activeProjects = overview?.projects?.active ?? 0;
  const totalTasks = overview?.tasks?.total ?? 0;
  const finalizadas30d = overview?.recent_completed_30d ?? 0;
  const perfWithEf = filteredIndPerf.filter((p) => p.eficiencia_pct != null);
  const perfWithPunt = filteredIndPerf.filter((p) => p.puntualidad_pct != null);
  const avgEficiencia = perfWithEf.length > 0
    ? Math.round(perfWithEf.reduce((s, p) => s + (p.eficiencia_pct ?? 0), 0) / perfWithEf.length) : null;
  const avgPuntualidad = perfWithPunt.length > 0
    ? Math.round(perfWithPunt.reduce((s, p) => s + (p.puntualidad_pct ?? 0), 0) / perfWithPunt.length) : null;

  const stackData = filteredTeam.filter((m) => m.total_tasks > 0).map((m) => ({
    name: m.full_name.split(/\s+/).slice(0, 2).join(' '),
    completadas: Math.round((m.completed_tasks / m.total_tasks) * 100),
    en_curso: Math.round((Math.max(0, m.active_tasks - m.overdue_tasks) / m.total_tasks) * 100),
    vencidas: Math.round((m.overdue_tasks / m.total_tasks) * 100),
  }));

  const avgTimeData = timeDist.filter((d) => d.count > 0).map((d) => ({
    name: d.status_name, promedio: d.stats.mean, color: STATUS_COLORS[d.status_name] || CHART_COLORS.muted,
  }));
  const bottleneck = avgTimeData.length > 0
    ? avgTimeData.reduce((prev, curr) => curr.promedio > prev.promedio ? curr : prev) : null;
  const overdueMembers = filteredTeam.filter((m) => m.overdue_tasks > 0);
  const totalOverdue = overdueMembers.reduce((s, m) => s + m.overdue_tasks, 0);

  // ── ② Flujo ────────────────────────────────────────────────────────────
  const topTransitions = [...transitions].sort((a, b) => b.count - a.count).slice(0, 12);
  const maxTrans = topTransitions[0]?.count || 1;
  const totalTransitions = transitions.reduce((s, t) => s + t.count, 0);
  const tasksByStatus = (overview?.tasks?.by_status ?? []).filter((s) => s.count > 0);

  // Sankey: construir nodos desde la unión de transitions + timeDist.
  // transitions siempre tiene datos (no filtra por duration_seconds),
  // timeDist puede estar vacío si no hay duraciones registradas.
  const timeDistMap   = new Map(timeDist.map((d) => [d.status_name, d]));
  const transColorMap = new Map<string, string>([
    ...transitions.map((t) => [t.from_status, t.from_color] as [string, string]),
    ...transitions.map((t) => [t.to_status,   t.to_color]   as [string, string]),
  ]);
  const allSankeyIds = new Set([
    ...transitions.map((t) => t.from_status),
    ...transitions.map((t) => t.to_status),
  ]);
  const sankeyNodes: SankeyNodeInput[] = Array.from(allSankeyIds).map((id) => {
    const td = timeDistMap.get(id);
    return {
      id,
      color:         td?.color ?? transColorMap.get(id) ?? axisTick.fill,
      avg_hours:     td ? (td.stats?.mean ?? 0) : undefined,
      task_count:    td?.count,
      display_order: td?.display_order ?? 99,
    };
  });
  const sankeyLinks = transitions.map((t) => ({
    source: t.from_status,
    target: t.to_status,
    value:  t.count,
  }));

  // ── ③ Tiempos ──────────────────────────────────────────────────────────
  const allStatuses = [...new Set(filteredPhase.flatMap((p) => p.phases.map((ph) => ph.status_name)))];
  const phaseChartData = filteredPhase.map((p) => {
    const row: Record<string, string | number> = { name: p.full_name.split(/\s+/).slice(0, 2).join(' ') };
    allStatuses.forEach((s) => { row[s] = p.phases.find((x) => x.status_name === s)?.avg_hours ?? 0; });
    return row;
  });

  // ── ④ Radar ────────────────────────────────────────────────────────────
  const radarPersons = filteredIndPerf.slice(0, 5).map((p) => p.full_name.split(/\s+/).slice(0, 2).join(' '));
  const radarData = ['Cumplimiento', 'Velocidad', 'Calidad', 'Estabilidad'].map((dim) => {
    const entry: Record<string, string | number> = { subject: dim };
    filteredIndPerf.slice(0, 5).forEach((p) => {
      const name = p.full_name.split(/\s+/).slice(0, 2).join(' ');
      let v = 0;
      if (dim === 'Cumplimiento') v = p.puntualidad_pct ?? 0;
      else if (dim === 'Velocidad') v = p.total_tareas > 0 ? Math.round((p.tareas_completadas / p.total_tareas) * 100) : 0;
      else if (dim === 'Calidad') v = Math.min(p.eficiencia_pct ?? 0, 100);
      else {
        const m = teamByCargo.find((t) => t.id === p.id);
        const rework = m && m.total_tasks > 0 ? (m.ajustes_count / m.total_tasks) * 100 : 0;
        v = Math.max(0, Math.round(100 - rework));
      }
      entry[name] = Math.round(v);
    });
    return entry;
  });
  const radarConfig: ChartConfig = Object.fromEntries(
    radarPersons.map((name, i) => [name, { label: name, color: SERIES_COLORS[i % SERIES_COLORS.length] }])
  );

  // ── ⑥ Tabla de tareas ─────────────────────────────────────────────────
  const toggleSort = (col: keyof TaskDetail) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('desc'); }
  };
  const cargoMemberNames = new Set(filteredTeam.map((m) => m.full_name));
  const filteredTasks = tasks
    .filter((t) => filterCargo === 'all' || cargoMemberNames.has(t.assignee_name))
    .filter((t) => {
      if (!taskSearch) return true;
      const q = taskSearch.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.assignee_name.toLowerCase().includes(q) || t.project_name.toLowerCase().includes(q);
    });
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const av = a[sortCol] as string | number | boolean | null;
    const bv = b[sortCol] as string | number | boolean | null;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : Number(av) - Number(bv);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // ── ⑤ Individual ──────────────────────────────────────────────────────
  const activePerson = filteredIndPerf.find((p) => p.id === selectedPerson)?.id ?? filteredIndPerf[0]?.id ?? null;
  const activePersonData = filteredIndPerf.find((p) => p.id === activePerson);

  return (
    <div className="space-y-12">

      {/* ── Barra de filtros por cargo ── */}
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <span className="text-xs text-muted-foreground font-medium mr-1">Filtrar por cargo:</span>
        <button
          onClick={() => { setFilterCargo('all'); setSelectedPerson(null); }}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filterCargo === 'all' ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border hover:border-primary/40'}`}
        >
          Todos ({totalAllPersons})
        </button>
        {Object.entries(cargoGroups).sort((a, b) => b[1] - a[1]).map(([cargo, count]) => (
          <button
            key={cargo}
            onClick={() => { setFilterCargo(cargo); setSelectedPerson(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filterCargo === cargo ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border hover:border-primary/40'}`}
          >
            {cargo} ({count})
          </button>
        ))}
      </div>

      {/* ① RESUMEN */}
      <section>
        <EficSectionHeader tag="① Resumen" title="Estado actual del equipo" />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {([
            { label: 'Proyectos activos', value: activeProjects, ctx: `de ${overview?.projects?.total ?? 0} total`, color: CHART_COLORS.blue },
            { label: 'Tareas totales', value: totalTasks, ctx: 'en el sistema', color: CHART_COLORS.magenta },
            { label: 'Finalizadas (30d)', value: finalizadas30d, ctx: 'último mes', color: CHART_COLORS.green },
            { label: 'Puntualidad prom.', value: avgPuntualidad != null ? `${avgPuntualidad}%` : '—', ctx: 'entregas a tiempo', color: avgPuntualidad != null && avgPuntualidad >= 85 ? CHART_COLORS.green : CHART_COLORS.yellow },
            { label: 'Eficiencia prom.', value: avgEficiencia != null ? `${avgEficiencia}%` : '—', ctx: 'est. vs real', color: avgEficiencia != null && avgEficiencia >= 85 ? CHART_COLORS.green : CHART_COLORS.yellow },
          ] as { label: string; value: string | number; ctx: string; color: string }[]).map((k) => (
            <div key={k.label} className="rounded-xl bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4" style={{ borderTop: `3px solid ${k.color}` }}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{k.label}</p>
              <p className="text-2xl font-black leading-none" style={{ color: k.color }}>{k.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{k.ctx}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Composición de tareas por colaborador</CardTitle>
              <CardDescription className="text-xs">Barras apiladas 100% · verde=completadas · teal=en curso · coral=vencidas</CardDescription>
            </CardHeader>
            <CardContent>
              {stackData.length > 0 ? (
                <ChartContainer
                  config={{ completadas: { label: 'Completadas', color: CHART_COLORS.green }, en_curso: { label: 'En curso', color: CHART_COLORS.teal }, vencidas: { label: 'Vencidas', color: CHART_COLORS.coral } }}
                  className="w-full" style={{ height: Math.max(stackData.length * 38, 100) }}
                >
                  <BarChart data={stackData} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <CartesianGrid horizontal={false} {...GRID_STYLE} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} {...AXIS_STYLE} tick={{ fill: axisTick.fill, fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={110} {...AXIS_STYLE} tick={{ fill: axisTick.fill, fontSize: 11 }} />
                    <ChartTooltip content={<CustomTooltip />} />
                    <Bar dataKey="completadas" stackId="a" fill={CHART_COLORS.green} barSize={16} />
                    <Bar dataKey="en_curso" stackId="a" fill={CHART_COLORS.teal} barSize={16} />
                    <Bar dataKey="vencidas" stackId="a" fill={CHART_COLORS.coral} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} barSize={16} />
                  </BarChart>
                </ChartContainer>
              ) : <EmptyState message="Sin datos de equipo" />}
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">% Cumplimiento vs. meta (85%)</CardTitle>
              <CardDescription className="text-xs">Bullet chart · rojo=riesgo · ámbar=alerta · verde=objetivo</CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              {filteredIndPerf.length > 0
                ? filteredIndPerf.map((p) => <BulletBar key={p.id} label={p.full_name.split(/\s+/).slice(0, 2).join(' ')} value={p.puntualidad_pct} />)
                : <EmptyState message="Sin datos de puntualidad" />}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">⚠ Alertas</p>
            <div className="space-y-2">
              {bottleneck && bottleneck.promedio > 0 && (
                <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 text-[11px] leading-relaxed">
                  <strong>Cuello de botella:</strong> promedio de <strong>{formatHours(bottleneck.promedio)}</strong> en estado "<strong>{bottleneck.name}</strong>".
                </div>
              )}
              {totalOverdue > 0 && (
                <div className="rounded-md bg-red-50 border border-red-200 text-red-900 px-3 py-2 text-[11px] leading-relaxed">
                  <strong>{totalOverdue} tareas vencidas</strong> en {overdueMembers.length} colaborador(es): {overdueMembers.map((m) => m.full_name.split(' ')[0]).join(', ')}.
                </div>
              )}
              {avgPuntualidad != null && avgPuntualidad < 60 && (
                <div className="rounded-md bg-red-50 border border-red-200 text-red-900 px-3 py-2 text-[11px] leading-relaxed">
                  <strong>Puntualidad crítica:</strong> promedio {avgPuntualidad}%, muy por debajo de la meta del 85%.
                </div>
              )}
              {totalOverdue === 0 && (!bottleneck || bottleneck.promedio === 0) && (
                <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-2 text-[11px]">✓ Sin alertas críticas en este momento.</div>
              )}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">💡 Conclusiones</p>
            <div className="space-y-2">
              {avgEficiencia != null && (
                <div className={`rounded-md px-3 py-2 text-[11px] leading-relaxed border ${avgEficiencia >= 85 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>
                  Eficiencia promedio del equipo: <strong>{avgEficiencia}%</strong>{avgEficiencia >= 85 ? ' — dentro del rango objetivo.' : ' — por debajo de la meta del 85%.'}
                </div>
              )}
              {finalizadas30d > 0 && (
                <div className="rounded-md bg-blue-50 border border-blue-200 text-blue-900 px-3 py-2 text-[11px] leading-relaxed">
                  Se completaron <strong>{finalizadas30d} tareas</strong> en los últimos 30 días.
                </div>
              )}
              {stackData.length > 0 && (() => {
                const top = [...stackData].sort((a, b) => b.completadas - a.completadas)[0];
                return top ? (
                  <div className="rounded-md bg-blue-50 border border-blue-200 text-blue-900 px-3 py-2 text-[11px] leading-relaxed">
                    Mayor tasa de completadas: <strong>{top.name}</strong> ({top.completadas}%).
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* ② FLUJO DE ESTADOS */}
      <section>
        <EficSectionHeader tag="② Flujo de estados" title="¿Cómo recorren las tareas el proceso?" />

        {(loadingTime || loadingTrans) ? (
          <div className="h-[300px] rounded-2xl bg-muted/40 animate-pulse mb-5" />
        ) : (
          <>
        <div className="rounded-md bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 px-4 py-2 text-[11px] text-slate-700 mb-5">
          <strong>{totalTransitions} transiciones</strong> registradas · <strong>{transitions.length}</strong> rutas únicas · grosor de barra = volumen relativo de tareas.
        </div>

        {sankeyLinks.length > 0
          ? <div className="mb-5"><SankeyDiagram nodes={sankeyNodes} links={sankeyLinks} height={440} /></div>
          : (
            <Card className={`${CARD_CLASS} mb-5`}>
              <CardContent className="py-6"><EmptyState message="No hay transiciones registradas" /></CardContent>
            </Card>
          )
        }

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tiempo promedio por estado</CardTitle>
              <CardDescription className="text-xs">Horas que permanece una tarea en cada estado</CardDescription>
            </CardHeader>
            <CardContent>
              {avgTimeData.length > 0 ? (
                <div className="space-y-2 mt-1">
                  {[...avgTimeData].sort((a, b) => b.promedio - a.promedio).map((d) => {
                    const maxH = Math.max(...avgTimeData.map((x) => x.promedio));
                    return (
                      <div key={d.name} className="flex items-center gap-3 text-[11px]">
                        <span className="w-[120px] truncate text-muted-foreground font-medium flex-shrink-0">{d.name}</span>
                        <div className="flex-1 relative h-4 bg-slate-100 rounded overflow-hidden">
                          <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${(d.promedio / maxH) * 100}%`, backgroundColor: d.color, opacity: 0.8 }} />
                        </div>
                        <span className="w-16 text-right font-bold tabular-nums">{formatHours(d.promedio)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState message="Sin datos de duración" />}
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tareas activas por estado (ahora)</CardTitle>
              <CardDescription className="text-xs">Distribución actual del backlog</CardDescription>
            </CardHeader>
            <CardContent>
              {tasksByStatus.length > 0 ? (
                <div className="space-y-2 mt-1">
                  {tasksByStatus.map((s) => {
                    const maxC = Math.max(...tasksByStatus.map((x) => x.count));
                    return (
                      <div key={s.name} className="flex items-center gap-3 text-[11px]">
                        <span className="w-[120px] truncate text-muted-foreground font-medium flex-shrink-0">{s.name}</span>
                        <div className="flex-1 relative h-4 bg-slate-100 rounded overflow-hidden">
                          <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${(s.count / maxC) * 100}%`, backgroundColor: STATUS_COLORS[s.name] || CHART_COLORS.muted, opacity: 0.85 }} />
                        </div>
                        <span className="w-8 text-right font-bold tabular-nums">{s.count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState message="Sin tareas registradas" />}
            </CardContent>
          </Card>
        </div>
          </>
        )}
      </section>

      {/* ③ TIEMPOS POR FASE */}
      <section>
        <EficSectionHeader tag="③ Tiempos" title="¿Dónde se pierde el tiempo?" />

        {loadingPhase ? (
          <div className="h-[200px] rounded-2xl bg-muted/40 animate-pulse mb-5" />
        ) : filteredPhase.length > 0 && (
          <Card className={`${CARD_CLASS} mb-5`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Anatomía del ciclo por colaborador</CardTitle>
              <CardDescription className="text-xs">Cada barra = 100% del tiempo · segmentos proporcionales al tiempo en cada estado</CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="flex flex-wrap gap-3 mb-4">
                {filteredPhase.flatMap((p) => p.phases).reduce<Array<{ name: string; color: string }>>((acc, ph) => {
                  if (!acc.find((x) => x.name === ph.status_name)) acc.push({ name: ph.status_name, color: ph.status_color });
                  return acc;
                }, []).map((s) => (
                  <span key={s.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </span>
                ))}
              </div>
              {filteredPhase.map((p) => <PhaseAnatomyBar key={p.profile_id} person={p.full_name} phases={p.phases} />)}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Horas promedio por estado y colaborador</CardTitle>
              <CardDescription className="text-xs">Solo tareas con historial registrado</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredPhase.length > 0 ? (
                <ChartContainer
                  config={Object.fromEntries(allStatuses.map((s, i) => [s, { label: s, color: SERIES_COLORS[i % SERIES_COLORS.length] }]))}
                  className="w-full" style={{ height: Math.max(filteredPhase.length * 44, 120) }}
                >
                  <BarChart data={phaseChartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <CartesianGrid horizontal={false} {...GRID_STYLE} />
                    <XAxis type="number" tickFormatter={(v) => `${v}h`} {...AXIS_STYLE} tick={{ fill: axisTick.fill, fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={110} {...AXIS_STYLE} tick={{ fill: axisTick.fill, fontSize: 11 }} />
                    <ChartTooltip content={<CustomTooltip />} />
                    {allStatuses.map((s, i) => (
                      <Bar key={s} dataKey={s} fill={SERIES_COLORS[i % SERIES_COLORS.length]} barSize={10} radius={[0, 3, 3, 0]} />
                    ))}
                  </BarChart>
                </ChartContainer>
              ) : <EmptyState message="Sin historial de estados" />}
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tabla detallada de tiempos por colaborador</CardTitle>
              <CardDescription className="text-xs">Promedio de horas en cada estado</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredPhase.length > 0 ? (
                <div className="overflow-x-auto max-h-[280px]">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-muted/60">
                      <tr>
                        <th className="text-left py-2 px-3 font-semibold text-muted-foreground border-b">Colaborador</th>
                        {allStatuses.map((s) => <th key={s} className="text-right py-2 px-2 font-semibold text-muted-foreground border-b whitespace-nowrap">{s}</th>)}
                        <th className="text-right py-2 px-3 font-semibold text-muted-foreground border-b">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPhase.map((p) => (
                        <tr key={p.profile_id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3 font-medium truncate max-w-[120px]">{p.full_name.split(/\s+/).slice(0, 2).join(' ')}</td>
                          {allStatuses.map((s) => {
                            const ph = p.phases.find((x) => x.status_name === s);
                            return <td key={s} className="py-2 px-2 text-right tabular-nums text-muted-foreground">{ph ? `${ph.avg_hours.toFixed(1)}h` : '—'}</td>;
                          })}
                          <td className="py-2 px-3 text-right font-bold tabular-nums">{p.phases.reduce((s, ph) => s + ph.avg_hours, 0).toFixed(1)}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState message="Sin historial de estados" />}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ④ EQUIPO */}
      <section>
        <EficSectionHeader tag="④ Equipo" title="Rendimiento del equipo" />

        {filteredIndPerf.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              {filteredIndPerf.map((p) => <PersonCard key={p.id} person={p} />)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
              {/* Radar multidimensional */}
              <Card className={CARD_CLASS}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Perfil multidimensional</CardTitle>
                  <CardDescription className="text-xs">
                    Cumplimiento = puntualidad · Velocidad = % completadas · Calidad = eficiencia horas · Estabilidad = inverso de ajustes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {radarPersons.length > 0 ? (
                    <ChartContainer config={radarConfig} className="h-[280px]">
                      <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="62%">
                        <PolarGrid stroke={gridColor} />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: axisTick.fill }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tickCount={5} tick={{ fontSize: 8, fill: axisTick.fill }} />
                        {radarPersons.map((name, i) => (
                          <Radar
                            key={name}
                            name={name}
                            dataKey={name}
                            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                            fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                            fillOpacity={0.10}
                            strokeWidth={2}
                          />
                        ))}
                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                      </RadarChart>
                    </ChartContainer>
                  ) : <EmptyState message="Sin datos para el radar" />}
                </CardContent>
              </Card>

              {/* Comparativa eficiencia y puntualidad */}
              <Card className={CARD_CLASS}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Comparativa eficiencia y puntualidad</CardTitle>
                  <CardDescription className="text-xs">Barras agrupadas · línea punteada = meta 85%</CardDescription>
                </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{ eficiencia_pct: { label: 'Eficiencia %', color: CHART_COLORS.indigo }, puntualidad_pct: { label: 'Puntualidad %', color: CHART_COLORS.teal } }}
                  className="w-full" style={{ height: Math.max(filteredIndPerf.length * 44, 140) }}
                >
                  <BarChart
                    data={filteredIndPerf.map((p) => ({ name: p.full_name.split(/\s+/).slice(0, 2).join(' '), eficiencia_pct: p.eficiencia_pct ?? 0, puntualidad_pct: p.puntualidad_pct ?? 0 }))}
                    layout="vertical" margin={{ left: 8, right: 20 }}
                  >
                    <CartesianGrid horizontal={false} {...GRID_STYLE} />
                    <XAxis type="number" domain={[0, 120]} tickFormatter={(v) => `${v}%`} {...AXIS_STYLE} tick={{ fill: axisTick.fill, fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={110} {...AXIS_STYLE} tick={{ fill: axisTick.fill, fontSize: 11 }} />
                    <ChartTooltip content={<CustomTooltip />} />
                    <ReferenceLine x={85} stroke={CHART_COLORS.green} strokeDasharray="4 2" label={{ value: 'Meta 85%', position: 'insideTopRight', fontSize: 10, fill: CHART_COLORS.green }} />
                    <Bar dataKey="eficiencia_pct" fill={CHART_COLORS.indigo} barSize={12} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} />
                    <Bar dataKey="puntualidad_pct" fill={CHART_COLORS.teal} barSize={12} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
              </Card>
            </div>{/* end grid radar + comparativa */}
          </>
        )}

      </section>

      {/* ⑤ DETALLE INDIVIDUAL */}
      <section>
        <EficSectionHeader tag="⑤ Individual" title="Detalle por persona" />

        {loadingIndPerf ? (
          <div className="h-[180px] rounded-2xl bg-muted/40 animate-pulse" />
        ) : filteredIndPerf.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
              {filteredIndPerf.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPerson(p.id)}
                  className="text-[11px] font-semibold px-4 py-1.5 rounded-full border transition-all"
                  style={activePerson === p.id
                    ? { background: SERIES_COLORS[i % SERIES_COLORS.length], color: '#fff', borderColor: 'transparent' }
                    : { background: 'hsl(var(--card))', color: 'hsl(var(--muted-foreground))', borderColor: 'hsl(var(--border))' }}
                >
                  {p.full_name.split(/\s+/).slice(0, 2).join(' ')}
                </button>
              ))}
            </div>

            {activePersonData && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <Card className={CARD_CLASS}>
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={activePersonData.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">{activePersonData.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-sm">{activePersonData.full_name}</p>
                        <p className="text-xs text-muted-foreground">{activePersonData.cargo ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{activePersonData.email}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {([
                        { label: 'Tareas totales', value: activePersonData.total_tareas },
                        { label: 'Completadas', value: activePersonData.tareas_completadas },
                        { label: 'Pendientes', value: activePersonData.tareas_pendientes },
                        { label: 'Asignaturas cubiertas', value: activePersonData.asignaturas_cubiertas },
                        { label: 'Horas estimadas', value: `${activePersonData.horas_estimadas_total}h` },
                        { label: 'Horas reales', value: `${activePersonData.horas_reales_total}h` },
                      ] as { label: string; value: string | number }[]).map((r) => (
                        <div key={r.label} className="flex justify-between text-[11px] border-b pb-1.5">
                          <span className="text-muted-foreground">{r.label}</span>
                          <span className="font-semibold tabular-nums">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                  {([
                    { label: 'Eficiencia', value: activePersonData.eficiencia_pct, desc: 'Horas estimadas / reales × 100' },
                    { label: 'Puntualidad', value: activePersonData.puntualidad_pct, desc: 'Entregas a tiempo con fecha límite' },
                    { label: 'Completadas', value: activePersonData.total_tareas > 0 ? Math.round(activePersonData.tareas_completadas / activePersonData.total_tareas * 100) : null, desc: `${activePersonData.tareas_completadas} de ${activePersonData.total_tareas}` },
                    { label: 'Cobertura', value: activePersonData.asignaturas_cubiertas || null, desc: 'Asignaturas distintas cubiertas', noUnit: true },
                  ] as { label: string; value: number | null; desc: string; noUnit?: boolean }[]).map((m) => {
                    const v = m.value;
                    const gradCls = v == null ? 'from-slate-50 to-slate-100 text-slate-600' :
                      v >= 85 ? 'from-emerald-50 to-emerald-100 text-emerald-800' :
                      v >= 60 ? 'from-amber-50 to-amber-100 text-amber-800' :
                      'from-red-50 to-red-100 text-red-800';
                    return (
                      <div key={m.label} className={`rounded-xl p-5 bg-gradient-to-br ${gradCls} flex flex-col justify-between min-h-[110px]`}>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{m.label}</p>
                        <p className="text-4xl font-black leading-none mt-2">{v != null ? `${v}${m.noUnit ? '' : '%'}` : '—'}</p>
                        <p className="text-[10px] opacity-70 mt-1">{m.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : <EmptyState message="Sin datos de rendimiento individual" />}
      </section>

      {/* ⑥ TABLA DETALLADA DE TAREAS */}
      <section>
        <EficSectionHeader tag="⑥ Tareas" title="Registro completo con tiempos por fase" />

        {/* Barra de búsqueda */}
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Buscar por título, colaborador o proyecto…"
            value={taskSearch}
            onChange={(e) => setTaskSearch(e.target.value)}
            className="flex-1 h-8 rounded-lg border border-border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">{sortedTasks.length} tareas</span>
        </div>

        {loadingTasks ? (
          <div className="h-[200px] rounded-2xl bg-muted/40 animate-pulse" />
        ) : sortedTasks.length > 0 ? (
          <Card className={CARD_CLASS}>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[480px]">
                <table className="w-full text-[11px]" style={{ minWidth: 900 }}>
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                    <tr>
                      {([
                        { col: 'title',         label: 'Título',       align: 'left'  },
                        { col: 'assignee_name', label: 'Colaborador',  align: 'left'  },
                        { col: 'status_name',   label: 'Estado',       align: 'left'  },
                        { col: 'project_key',   label: 'Proyecto',     align: 'left'  },
                        { col: 'created_at',    label: 'Creado',       align: 'right' },
                        { col: 'h_espera',      label: '⏳ Espera',    align: 'right' },
                        { col: 'h_proceso',     label: '⚡ Proceso',   align: 'right' },
                        { col: 'h_revision',    label: '🔍 Revisión',  align: 'right' },
                        { col: 'h_ajustes',     label: '⚙ Ajustes',   align: 'right' },
                        { col: 'h_total',       label: '📐 Total',     align: 'right' },
                        { col: 'devoluciones',  label: 'Dev.',         align: 'right' },
                      ] as { col: keyof TaskDetail; label: string; align: string }[]).map(({ col, label, align }) => (
                        <th
                          key={col}
                          onClick={() => toggleSort(col)}
                          className={`py-2 px-2 font-semibold text-muted-foreground border-b cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors text-${align}`}
                        >
                          {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTasks.map((t) => (
                      <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-1.5 px-2 font-medium max-w-[200px] truncate" title={t.title}>{t.title}</td>
                        <td className="py-1.5 px-2 text-muted-foreground truncate max-w-[120px]">{t.assignee_name}</td>
                        <td className="py-1.5 px-2">
                          <span className="px-1.5 py-0.5 rounded text-white text-[10px] font-semibold" style={{ backgroundColor: t.status_color }}>
                            {t.status_name}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-muted-foreground font-mono">{t.project_key}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{t.h_espera   > 0 ? `${t.h_espera}h`   : '—'}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{t.h_proceso  > 0 ? `${t.h_proceso}h`  : '—'}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{t.h_revision > 0 ? `${t.h_revision}h` : '—'}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{t.h_ajustes  > 0 ? `${t.h_ajustes}h`  : '—'}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold">{t.h_total > 0 ? `${t.h_total}h` : '—'}</td>
                        <td className="py-1.5 px-2 text-right">
                          {t.devoluciones > 0 ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">{t.devoluciones}</span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : <EmptyState message="Sin tareas para mostrar" />}
      </section>

    </div>
  );
}

// ---------- Tab: Rendimiento individual ----------
function IndividualPerformanceTab() {
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [rangeKey, setRangeKey] = useState<ReportRangeKey>('30d');

  const filters: ReportScopeFilters = {
    ...(selectedProject !== 'all' ? { project_id: selectedProject } : {}),
    ...resolveRange(rangeKey),
  };

  const { data: personMetrics, isLoading } = useReportPersonMetrics(filters);
  const { data: capacity } = useReportCapacityForecast({ ...filters, weeks: 4 });

  const members: PersonMetric[] = personMetrics?.people ?? [];
  const activeMembers = [...members.filter((m) => m.unidades_asignadas > 0)]
    .sort((a, b) => b.horas_completadas - a.horas_completadas);
  const inactiveMembers = members.filter((m) => m.unidades_asignadas === 0);
  const capacityById = new Map((capacity?.members ?? []).map(m => [m.id, m]));

  const totalCompleted = members.reduce((s, m) => s + m.unidades_completadas, 0);
  const overall = personMetrics?.overall;
  // Baja puntualidad requiere una muestra mínima — una sola entrega tardía de una
  // no debería marcar a alguien en rojo.
  const enRiesgo = members.filter((m) => m.puntualidad_pct !== null && m.puntualidad_pct < 80 && m.entregas_evaluables >= 3).length;

  const completedChartData = activeMembers.slice(0, 10).map((m) => ({
    name: m.full_name.split(' ')[0],
    unidades: m.unidades_completadas,
    horas: m.horas_completadas,
  }));

  const horasChartData = activeMembers
    .filter((m) => m.horas_completadas > 0 || m.eficiencia_horas_pct != null)
    .slice(0, 10)
    .map((m) => ({
      name: m.full_name.split(' ')[0],
      estimadas: m.horas_completadas,
      efectivas: m.eficiencia_horas_pct != null && m.eficiencia_horas_pct > 0
        ? Math.round((m.horas_completadas / (m.eficiencia_horas_pct / 100)) * 100) / 100
        : 0,
    }));

  const chartConfigTasks: ChartConfig = {
    unidades: { label: 'Unidades completadas', color: SERIES_COLORS[0] },
  };

  const chartConfigHoras: ChartConfig = {
    estimadas: { label: 'H. Estimadas', color: SERIES_COLORS[1] },
    efectivas: { label: 'H. Efectivas (aprox.)', color: SERIES_COLORS[2] },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const rendimientoTone = overall?.puntualidad_pct == null ? 'info' : overall.puntualidad_pct >= 90 ? 'good' : overall.puntualidad_pct >= 80 ? 'warning' : 'critical';

  return (
    <div className="space-y-6">
      <HeroBanner
        eyebrow="Rendimiento individual"
        story={
          <>
            <b className="text-white">{activeMembers.length} colaboradores activos</b> entregaron{' '}
            <b className="text-white">{totalCompleted} unidades</b> en el período, con{' '}
            <b className="text-white">{overall?.puntualidad_pct != null ? `${overall.puntualidad_pct}% de puntualidad` : 'puntualidad sin datos suficientes'}</b>.{' '}
            {enRiesgo > 0
              ? <><b className="text-white">{enRiesgo} {enRiesgo === 1 ? 'persona' : 'personas'}</b> {enRiesgo === 1 ? 'tiene' : 'tienen'} baja puntualidad sostenida.</>
              : 'Nadie muestra baja puntualidad sostenida.'}
          </>
        }
        stats={[
          { value: totalCompleted, label: 'Unidades completadas' },
          { value: overall?.puntualidad_pct != null ? `${overall.puntualidad_pct}%` : '—', label: 'Puntualidad global' },
          { value: enRiesgo, label: 'En riesgo' },
        ]}
      />

      <ReportScopeFilterBar
        projectId={selectedProject}
        onProjectChange={setSelectedProject}
        rangeKey={rangeKey}
        onRangeChange={setRangeKey}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <StatTile label="Unidades completadas" value={totalCompleted} />
        <StatTile
          label="Puntualidad global"
          value={overall?.puntualidad_pct != null ? `${overall.puntualidad_pct}%` : '—'}
          sub={overall ? `${overall.entregas_a_tiempo}/${overall.entregas_evaluables} a tiempo` : undefined}
          pill={{ tone: rendimientoTone, label: rendimientoTone === 'good' ? 'Sólido' : rendimientoTone === 'warning' ? 'Atención' : rendimientoTone === 'critical' ? 'Riesgo' : 'Sin datos' }}
        />
        <StatTile label="Colaboradores activos" value={activeMembers.length} />
        <StatTile
          label="En riesgo"
          value={enRiesgo}
          sub="Puntualidad <80%, min. 3 entregas"
          pill={enRiesgo > 0 ? { tone: 'critical', label: 'Revisar' } : { tone: 'good', label: 'OK' }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle className="text-base">Unidades de trabajo por colaborador</CardTitle>
            <CardDescription>Completadas en el período</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfigTasks} className="h-[240px] w-full">
              <BarChart data={completedChartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="name" {...AXIS_STYLE} />
                <YAxis {...AXIS_STYLE} />
                <ChartTooltip content={<CustomTooltip />} />
                <Bar dataKey="unidades" fill={SERIES_COLORS[0]} radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle className="text-base">Horas estimadas vs. tiempo efectivo</CardTitle>
            <CardDescription>Aproximado — solo tareas con un único responsable</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfigHoras} className="h-[240px] w-full">
              <BarChart data={horasChartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="name" {...AXIS_STYLE} />
                <YAxis {...AXIS_STYLE} tickFormatter={(v) => `${v}h`} />
                <ChartTooltip content={<CustomTooltip />} />
                <Bar dataKey="estimadas" fill={SERIES_COLORS[1]} radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]} />
                <Bar dataKey="efectivas" fill={SERIES_COLORS[2]} radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card className={CARD_CLASS}>
        <CardHeader>
          <CardTitle className="text-base">Ranking de colaboradores</CardTitle>
          <CardDescription>Puntualidad primero (métrica principal) · ordenado por horas entregadas</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {activeMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-40" />
              <p>No hay datos para los filtros seleccionados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Colaborador</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cargo</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Puntualidad</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Sem. actual</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Próx. semanas</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Unidades</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Horas entregadas</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Est./Efectivo</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Sin est.</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMembers.map((m, idx) => {
                    const cap = capacityById.get(m.id);
                    return (
                      <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={m.avatar_url ?? undefined} />
                              <AvatarFallback className="text-xs">
                                {m.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{m.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.cargo ?? '—'}</td>
                        <td className={`px-4 py-3 text-center font-semibold ${punctualityBandColor(m.puntualidad_pct)}`}>
                          {m.puntualidad_pct !== null ? `${m.puntualidad_pct}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          {cap ? `${cap.current.utilizacion_pct}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {cap ? <CapacityWeekStrip weeks={cap.weeks} /> : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold text-primary">{m.unidades_completadas}</span>
                          <span className="text-muted-foreground text-xs"> /{m.unidades_asignadas}</span>
                        </td>
                        <td className="px-4 py-3 text-center">{formatHours(m.horas_completadas)}</td>
                        <td className={`px-4 py-3 text-center ${efficiencyBandColor(m.eficiencia_horas_pct)}`}>
                          {m.eficiencia_horas_pct != null ? `${m.eficiencia_horas_pct}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{m.unidades_sin_estimacion}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {inactiveMembers.length > 0 && (
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Sin tareas asignadas
              <Badge variant="secondary" className="ml-1">
                {inactiveMembers.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Usuarios activos que no tienen tareas en el período seleccionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {inactiveMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={m.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {m.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium leading-none">{m.full_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.cargo ?? 'Sin cargo'}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- Helpers ----------
function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: CHART_COLORS.indigo }} />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ---------- Main Page ----------
export default function ReportsPage() {
  const { isAdmin, isProjectLeader } = useAuth();

  if (!isAdmin && !isProjectLeader) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <ReportsErrorBoundary>
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Reportes</h1>
          <p className="page-description">
            Monitoreo y analítica de la Fábrica de Contenidos
          </p>
        </div>

        <Tabs defaultValue="resumen" className="space-y-8">
          <TabsList className="grid w-full grid-cols-5 max-w-[680px]">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="proyectos">Proyectos</TabsTrigger>
            <TabsTrigger value="equipo">Equipo</TabsTrigger>
            <TabsTrigger value="eficiencia">Eficiencia</TabsTrigger>
            <TabsTrigger value="rendimiento">Rendimiento</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen">
            <TabResumen />
          </TabsContent>

          <TabsContent value="proyectos">
            <TabProyectos />
          </TabsContent>

          <TabsContent value="equipo">
            <TabEquipo />
          </TabsContent>

          <TabsContent value="eficiencia">
            <TabEficiencia />
          </TabsContent>

          <TabsContent value="rendimiento" className="space-y-6">
            <IndividualPerformanceTab />
          </TabsContent>
        </Tabs>
      </div>
    </ReportsErrorBoundary>
  );
}
