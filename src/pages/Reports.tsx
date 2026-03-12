import { Component, ReactNode, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Package, Clock, BarChart3, CalendarDays, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from 'recharts';
import {
  useReportOverview,
  useReportProjectsProgress,
  useReportTeamPerformance,
  useReportTeamCapacity,
  useReportMaterialProduction,
  useReportTimeDistribution,
  useReportWorkflowTransitions,
  useReportWorkloadByCargo,
  useReportProjectCategories,
  useReportTasksWeeklyTrend,
  useUserMiniReport,
  type UserMiniReport,
  useReportProjectsTimeline,
  useReportTeamMonthlyCompletion,
  useReportTeamByCargo,
  useReportWeeklyByCargo,
  useReportUnassignedMaterials,
  type TeamMonthlyPoint,
  type TeamMemberByCargo,
  type WeeklyByCargoPoint,
  type UnassignedMaterial,
} from '@/hooks/useReports';
import {
  CHART_COLORS, SERIES_COLORS, STATUS_COLORS, BAR_RADIUS,
  formatDuration, formatHours,
  AXIS_STYLE, GRID_STYLE,
} from '@/components/reports/ReportCharts';
import { CustomTooltip } from '@/components/charts/CustomTooltip';
import { PersonSparkline } from '@/components/reports/PersonSparkline';
import ViolinChart from '@/components/reports/ViolinChart';
import PolarAreaChart from '@/components/reports/PolarAreaChart';
import kpiProjectsImg from '@/assets/dashboard/projects.png';
import kpiTasksImg from '@/assets/dashboard/tasks.png';
import kpiPackageImg from '@/assets/dashboard/productivity.png';
import kpiUsersImg from '@/assets/dashboard/notifications.png.png';

// Snapshot Operativo style
const CARD_CLASS = 'rounded-2xl border border-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200';

// Ranking colors for top collaborators
const RANKING_COLORS = ['#FBBF24', '#4F46E5', '#0DD9D0', '#6366F1', '#BFEFF0'];

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

// ---------- KPI Card — solo imagen (logo nuevo), sin icono montado ----------
function KpiCard({
  title, value, subtitle, image,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  image: string;
}) {
  return (
    <Card className="relative rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-6 transition-all duration-200 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
      <img src={image} alt="" className="absolute right-4 top-4 h-20 w-20 object-contain opacity-70 pointer-events-none" />
      <CardHeader className="pb-2 p-0">
        <CardTitle className="text-[11px] uppercase tracking-wide text-[#64748B] font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pt-3">
        <div className="text-3xl font-semibold text-[#0F172A]">{value}</div>
        {subtitle && <p className="text-xs text-[#64748B] mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ---------- Tab: Resumen ----------
function TabResumen() {
  const { data: overview, isLoading, isError, error } = useReportOverview();
  const { data: projectsProgress = [] } = useReportProjectsProgress();
  const { data: team = [] } = useReportTeamPerformance();
  const { data: categories = [] } = useReportProjectCategories();
  const { data: weeklyTrend = [] } = useReportTasksWeeklyTrend();

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

  // Top 5 collaborators with ranking colors
  const top5 = team.slice(0, 5).map((t, i) => ({
    name: (t.full_name || 'Sin nombre').split(' ').slice(0, 2).join(' ') || 'Usuario',
    completadas: t.completed_tasks,
    en_progreso: t.in_progress_tasks,
    total: t.total_tasks,
    color: RANKING_COLORS[i] || CHART_COLORS.muted,
  }));

  const teamBarConfig: ChartConfig = {
    completadas: { label: 'Completadas', color: CHART_COLORS.teal },
    en_progreso: { label: 'En progreso', color: CHART_COLORS.muted },
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

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7">
        <KpiCard
          title="Proyectos Activos"
          value={projectsData.active}
          subtitle={`${projectsData.total} totales`}
          image={kpiProjectsImg}
        />
        <KpiCard
          title="Tareas Totales"
          value={tasks.total ?? 0}
          subtitle={`${overview.recent_completed_30d ?? 0} completadas (30d)`}
          image={kpiTasksImg}
        />
        <KpiCard
          title="Materiales"
          value={`${materialsData.completion_rate ?? 0}%`}
          subtitle={`${materialsData.completed} de ${materialsData.total} completados`}
          image={kpiPackageImg}
        />
        <KpiCard
          title="Equipo Activo"
          value={teamData.active_members}
          subtitle={overview.avg_completion_seconds > 0
            ? `Promedio: ${formatDuration(overview.avg_completion_seconds)}`
            : 'Sin datos de tiempo aún'}
          image={kpiUsersImg}
        />
      </div>

      {/* Row 2: Polar Area + Project Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribución de Tareas</CardTitle>
            <CardDescription>Por estado actual</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.some(s => s.value > 0) ? (
              <PolarAreaChart data={statusData} height={280} />
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
                  <YAxis type="category" dataKey="name" {...AXIS_STYLE} width={55} tick={{ fill: '#64748B', fontSize: 12 }} />
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
            <CardDescription>Académico, Marketing y Otros</CardDescription>
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
            <CardTitle className="text-base">Tendencia semanal</CardTitle>
            <CardDescription>Tareas creadas vs. finalizadas (últimas 12 semanas)</CardDescription>
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
                      return d.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
                    }}
                    tick={{ fontSize: 11 }}
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

      {/* Row 4: Top Collaborators with ranking colors */}
      {top5.length > 0 && (
        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Colaboradores</CardTitle>
            <CardDescription>Por tareas completadas</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={teamBarConfig} className="h-[200px] w-full">
              <BarChart data={top5} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid horizontal={false} {...GRID_STYLE} />
                <XAxis type="number" {...AXIS_STYLE} />
                <YAxis type="category" dataKey="name" {...AXIS_STYLE} width={110} tick={{ fill: '#64748B', fontSize: 12 }} />
                <ChartTooltip content={<CustomTooltip />} />
                <Bar dataKey="completadas" stackId="a" radius={[0, 0, 0, 0]}>
                  {top5.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
                <Bar dataKey="en_progreso" stackId="a" fill={CHART_COLORS.muted} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} opacity={0.4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
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

  const validTimeline = (timeline || []).filter(p => (p.start_date || p.estimated_end_date || p.target_date));

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

  return (
    <div className="space-y-8">
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
                                  backgroundColor: isAtRisk ? '#EF4444' : CHART_COLORS.muted,
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
        {projects.map(p => (
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
                    fill: '#64748B',
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
                    fill: '#64748B',
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
                        ? '#EF4444'
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
                {projects.map(p => {
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
  const { data: team = [], isLoading } = useReportTeamPerformance();
  const { data: capacity, isLoading: loadingCapacity } = useReportTeamCapacity();
  const { data: workload = [] } = useReportWorkloadByCargo();
  const { data: teamMonthly = [] } = useReportTeamMonthlyCompletion();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: userReport, isLoading: loadingUserReport } = useUserMiniReport(selectedUserId);

  if (isLoading || loadingCapacity) return <LoadingState />;

  if (team.length === 0) return <EmptyState message="No hay datos de equipo" />;

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
  const defaultWeeklyCapacity = capacity?.schedule.weekly_hours ?? 40.25;

  const teamPendingHours = capacityMembers.reduce((sum, m) => {
    const value = Number.isFinite(m.pending_horas) ? m.pending_horas : 0;
    return sum + value;
  }, 0);

  const teamCapacityHours = capacityMembers.reduce((sum, m) => {
    const baseWeekly =
      Number.isFinite(m.weekly_hours_capacity) && m.weekly_hours_capacity > 0
        ? m.weekly_hours_capacity
        : defaultWeeklyCapacity;
    return sum + baseWeekly;
  }, 0);

  const teamUtilPct = teamCapacityHours > 0
    ? Math.round((teamPendingHours / teamCapacityHours) * 100) || 0
    : 0;

  const teamGapHours = teamCapacityHours - teamPendingHours;
  const absTeamGapHours = Math.abs(teamGapHours);

  let teamGapDisplay = '0h';
  if (teamGapHours > 0) {
    teamGapDisplay = `Holgura ${formatHours(teamGapHours)}`;
  } else if (teamGapHours < 0) {
    teamGapDisplay = `Exceso ${formatHours(absTeamGapHours)}`;
  }

  const riskCounts = capacityMembers.reduce(
    (acc, m) => {
      const level = m.risk_level || 'ok';
      if (level === 'over') acc.over += 1;
      else if (level === 'warning') acc.warning += 1;
      else acc.ok += 1;
      return acc;
    },
    { ok: 0, warning: 0, over: 0 },
  );

  // Capacity bar chart data
  const capacityBarData = (capacity?.members || []).map(m => ({
    name: (m.full_name || 'Sin nombre').split(' ').slice(0, 2).join(' ') || 'Usuario',
    pending_horas: m.pending_horas,
    completed_horas: m.completed_horas,
    capacidad_semanal: capacity?.schedule?.weekly_hours || 40.25,
  }));

  const capacityBarConfig: ChartConfig = {
    pending_horas: { label: 'Hrs pendientes', color: CHART_COLORS.indigo },
    completed_horas: { label: 'Hrs completadas', color: CHART_COLORS.teal },
  };

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-8">
      {/* Capacity Section */}
      {capacity && capacity.members.length > 0 && (
        <>
          {/* Global team capacity indicator */}
          {capacityMembers.length > 0 && (
            <Card className={CARD_CLASS}>
              <CardContent className="py-4 px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                    Indicador global de capacidad
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-xl font-semibold text-[#0F172A]">{teamUtilPct}%</p>
                      <p className="text-muted-foreground">Utilización global</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">
                        {teamPendingHours > 0 ? formatHours(teamPendingHours) : '0h'}
                      </p>
                      <p className="text-muted-foreground">Horas pendientes</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">
                        {teamCapacityHours > 0 ? formatHours(teamCapacityHours) : '0h'}
                      </p>
                      <p className="text-muted-foreground">Capacidad semanal</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">
                        {teamGapDisplay}
                      </p>
                      <p className="text-muted-foreground">Gap global</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-2 text-xs">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Riesgo del equipo
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {riskCounts.ok > 0 && (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px]"
                      >
                        OK · {riskCounts.ok}
                      </Badge>
                    )}
                    {riskCounts.warning > 0 && (
                      <Badge
                        variant="outline"
                        className="border-amber-200 bg-amber-50 text-amber-700 px-2 py-0.5 text-[11px]"
                      >
                        Riesgo · {riskCounts.warning}
                      </Badge>
                    )}
                    {riskCounts.over > 0 && (
                      <Badge
                        variant="outline"
                        className="border-red-200 bg-red-50 text-red-700 px-2 py-0.5 text-[11px]"
                      >
                        Sobrecargado · {riskCounts.over}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
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

          {/* Capacity cards per person */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {capacity.members.map(member => {
              const isOverloaded = member.utilization_pct > 100;
              const barPct = Math.min(member.utilization_pct, 200) / 2; // Scale: 200% = full bar

              const riskBadgeClass =
                member.risk_color === 'red'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : member.risk_color === 'amber'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

              let gapText: string | null = null;
              if (member.capacity_gap_hours !== 0) {
                const absGap = Math.abs(member.capacity_gap_hours);
                if (member.capacity_gap_hours > 0) {
                  gapText = `Exceso +${formatHours(absGap)}`;
                } else {
                  gapText = `Holgura ${formatHours(absGap)}`;
                }
              }

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
                            {member.risk_label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{member.cargo || 'Sin cargo'}</p>
                      </div>
                    </div>

                    {/* Metrics row */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold" style={{ color: CHART_COLORS.indigo }}>{member.pending_tasks}</p>
                        <p className="text-[10px] text-muted-foreground">Pendientes</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold" style={{ color: CHART_COLORS.indigo }}>
                          {member.pending_horas > 0 ? formatHours(member.pending_horas) : '-'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Horas</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold" style={{ color: isOverloaded ? '#EF4444' : CHART_COLORS.teal }}>
                          {member.estimated_work_days > 0 ? `${member.estimated_work_days}d` : '-'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Días est.</p>
                      </div>
                    </div>

                    {/* Utilization bar + gap */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">Ocupación semanal</span>
                        <span className={`font-semibold ${isOverloaded ? 'text-red-500' : ''}`}>
                          {member.utilization_pct}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(barPct, 100)}%`,
                            background: isOverloaded
                              ? `linear-gradient(90deg, ${CHART_COLORS.yellow}, ${'#EF4444'})`
                              : `linear-gradient(90deg, ${CHART_COLORS.indigo}, ${CHART_COLORS.tealDark})`,
                          }}
                        />
                      </div>
                      {gapText && (
                        <div className="flex justify-between text-[10px] mt-1">
                          <span className="text-muted-foreground">Gap semanal</span>
                          <span
                            className={`font-medium ${
                              member.capacity_gap_hours > 0 ? 'text-red-600' : 'text-emerald-600'
                            }`}
                          >
                            {gapText}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Sparklines de completadas/mes */}
                    {teamMonthly && teamMonthly.length > 0 && (
                      (() => {
                        const personMonthly = (teamMonthly as TeamMonthlyPoint[]).filter(
                          p => p.profile_id === member.id,
                        );
                        if (personMonthly.length === 0) return null;
                        const sparkColor =
                          member.risk_color === 'red'
                            ? '#EF4444'
                            : member.risk_color === 'amber'
                              ? CHART_COLORS.yellow
                              : CHART_COLORS.teal;
                        const sorted = [...personMonthly].sort((a, b) => a.month.localeCompare(b.month));
                        const sparkData = sorted.map(p => ({
                          month: p.month,
                          completed_count: p.completed_count,
                        }));
                        return (
                          <div className="flex items-center justify-end gap-1 pt-1">
                            <span className="text-[9px] text-muted-foreground">Finalizadas/mes</span>
                            <PersonSparkline data={sparkData} color={sparkColor} />
                          </div>
                        );
                      })()
                    )}

                    {/* Footer: completion date + warnings */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t">
                      {member.estimated_completion_date ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          <span>Finaliza ~{formatDate(member.estimated_completion_date)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sin carga pendiente</span>
                      )}
                      {member.tasks_sin_estimacion > 0 && (
                        <div className="flex items-center gap-1 text-amber-500" title="Tareas sin horas estimadas asignadas">
                          <AlertTriangle className="h-3 w-3" />
                          <span className="text-[10px]">{member.tasks_sin_estimacion} sin est.</span>
                        </div>
                      )}
                    </div>
                  </button>
                </Card>
              );
            })}
          </div>

          {/* Capacity comparison bar chart */}
          {capacityBarData.length > 0 && (
            <Card className={CARD_CLASS}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Horas de Trabajo por Colaborador</CardTitle>
                <CardDescription>Horas pendientes vs completadas</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={capacityBarConfig} className="h-[220px] w-full">
                  <BarChart data={capacityBarData} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid horizontal={false} {...GRID_STYLE} />
                    <XAxis type="number" {...AXIS_STYLE} tickFormatter={(v) => `${v}h`} />
                    <YAxis type="category" dataKey="name" {...AXIS_STYLE} width={110} tick={{ fill: '#64748B', fontSize: 12 }} />
                    <ChartTooltip content={<CustomTooltip />} />
                    <Bar dataKey="completed_horas" stackId="a" fill={CHART_COLORS.teal} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pending_horas" stackId="a" fill={CHART_COLORS.indigo} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
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
                <YAxis type="category" dataKey="name" {...AXIS_STYLE} width={130} tick={{ fill: '#64748B', fontSize: 12 }} />
                <ChartTooltip content={<CustomTooltip />} />
                <Bar dataKey="completed_tasks" stackId="a" fill={CHART_COLORS.teal} radius={[0, 0, 0, 0]} />
                <Bar dataKey="pending_tasks" stackId="a" fill={CHART_COLORS.indigo} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Velocidad del equipo */}
      {teamMonthly && (teamMonthly as TeamMonthlyPoint[]).length > 0 && (
        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Velocidad del equipo</CardTitle>
            <CardDescription>Tareas finalizadas por mes (últimos 6 meses)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[240px] w-full">
              {(() => {
                const points = teamMonthly as TeamMonthlyPoint[];
                const uniquePeople = Array.from(
                  new Map(points.map(p => [p.full_name, p.full_name])).values(),
                );
                const topPeople = uniquePeople.slice(0, 5);
                const extraPeople = uniquePeople.slice(5);

                const months = Array.from(
                  new Set(points.map(p => p.month)),
                ).sort((a, b) => a.localeCompare(b));

                const data = months.map(m => {
                  const base: Record<string, number | string> = {
                    month: new Date(m + 'T12:00:00').toLocaleDateString('es-CO', {
                      month: 'short',
                    }),
                  };
                  topPeople.forEach(name => {
                    const match = points.find(p => p.month === m && p.full_name === name);
                    base[name] = match ? match.completed_count : 0;
                  });
                  if (extraPeople.length > 0) {
                    const othersCount = points
                      .filter(p => p.month === m && extraPeople.includes(p.full_name))
                      .reduce((sum, p) => sum + p.completed_count, 0);
                    base.Otros = othersCount;
                  }
                  return base;
                });

                const personsForStack = [...topPeople];
                if (extraPeople.length > 0) {
                  personsForStack.push('Otros');
                }

                const barConfig: ChartConfig = personsForStack.reduce((acc, name, idx) => {
                  acc[name] = {
                    label: name,
                    color: RANKING_COLORS[idx % RANKING_COLORS.length],
                  };
                  return acc;
                }, {} as ChartConfig);

                return (
                  <ChartContainer config={barConfig} className="h-[240px] w-full">
                    <BarChart data={data} margin={{ left: 10, right: 10 }}>
                      <CartesianGrid {...GRID_STYLE} />
                      <XAxis dataKey="month" {...AXIS_STYLE} />
                      <YAxis {...AXIS_STYLE} />
                      <ChartTooltip content={<CustomTooltip />} />
                      {personsForStack.map((name, idx) => (
                        <Bar
                          key={name}
                          dataKey={name}
                          stackId="a"
                          fill={RANKING_COLORS[idx % RANKING_COLORS.length]}
                          radius={
                            idx === personsForStack.length - 1
                              ? [BAR_RADIUS, BAR_RADIUS, 0, 0]
                              : [0, 0, 0, 0]
                          }
                        />
                      ))}
                    </BarChart>
                  </ChartContainer>
                );
              })()}
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
              Resumen de carga, riesgos y tareas que requieren atención.
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

                {/* Tareas que requieren atención */}
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
          <CardDescription>Métricas individuales de cada colaborador</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 px-2 font-medium">Colaborador</th>
                  <th className="text-left py-3 px-2 font-medium">Cargo</th>
                  <th className="text-center py-3 px-2 font-medium">Tareas</th>
                  <th className="text-center py-3 px-2 font-medium">Completadas</th>
                  <th className="text-center py-3 px-2 font-medium">Materiales</th>
                  <th className="text-center py-3 px-2 font-medium">Hrs Est.</th>
                  <th className="text-center py-3 px-2 font-medium">Hrs Reales</th>
                  <th className="text-center py-3 px-2 font-medium">Avance</th>
                </tr>
              </thead>
              <tbody>
                {team.map(member => (
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
                    <td className="py-3 px-2 text-center font-medium">{member.total_tasks}</td>
                    <td className="py-3 px-2 text-center">
                      <span style={{ color: CHART_COLORS.teal }} className="font-medium">{member.completed_tasks}</span>
                    </td>
                    <td className="py-3 px-2 text-center">{member.materials_assigned}</td>
                    <td className="py-3 px-2 text-center text-muted-foreground">
                      {member.total_horas_estimadas > 0 ? formatHours(member.total_horas_estimadas) : '-'}
                    </td>
                    <td className="py-3 px-2 text-center text-muted-foreground">
                      {member.total_horas_reales > 0 ? formatHours(member.total_horas_reales) : '-'}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2 justify-center">
                        <Progress value={member.completion_rate} className="h-1.5 w-16" />
                        <span className="text-xs font-medium w-8">{member.completion_rate}%</span>
                      </div>
                    </td>
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
              tick={{ fill: '#64748B', fontSize: 11 }}
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
        <CardTitle className="text-sm">Tareas que requieren atención</CardTitle>
        <CardDescription className="text-xs">
          Hasta 5 tareas ordenadas por urgencia (vencidas, de hoy, alta prioridad, sin estimación).
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

// ---------- Tab: Producción ----------
function TabProduccion() {
  const { data: materials = [], isLoading } = useReportMaterialProduction();

  if (isLoading) return <LoadingState />;

  const activeMaterials = materials.filter(m => m.total_required > 0);

  if (activeMaterials.length === 0) return <EmptyState message="No hay materiales registrados" />;

  const barData = activeMaterials.map(m => ({
    name: m.name.replace(/_/g, ' '),
    icon: m.icon,
    completados: m.completed_tasks,
    en_progreso: m.in_progress_tasks,
    pendientes: Math.max(0, m.total_required - m.completed_tasks - m.in_progress_tasks),
    total: m.total_required,
  }));

  const matConfig: ChartConfig = {
    completados: { label: 'Completados', color: CHART_COLORS.teal },
    en_progreso: { label: 'En progreso', color: CHART_COLORS.indigo },
    pendientes: { label: 'Pendientes', color: CHART_COLORS.muted },
  };

  // Polar area data for distribution
  const polarMatData = activeMaterials.map((m, i) => ({
    name: m.name.replace(/_/g, ' '),
    value: m.total_required,
    color: RANKING_COLORS[i % RANKING_COLORS.length],
  }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        {/* Bar chart: production by type */}
        <Card className={`lg:col-span-2 ${CARD_CLASS}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Producción por Tipo de Material</CardTitle>
            <CardDescription>Estado de materiales requeridos</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={matConfig} className="h-[320px] w-full">
              <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid horizontal={false} {...GRID_STYLE} />
                <XAxis type="number" {...AXIS_STYLE} />
                <YAxis
                  type="category"
                  dataKey="name"
                  {...AXIS_STYLE}
                  width={120}
                  tick={{ fontSize: 10 }}
                />
                <ChartTooltip content={<CustomTooltip />} />
                <Bar dataKey="completados" stackId="a" fill={CHART_COLORS.teal} />
                <Bar dataKey="en_progreso" stackId="a" fill={CHART_COLORS.indigo} />
                <Bar dataKey="pendientes" stackId="a" fill={CHART_COLORS.muted} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Polar area chart: material distribution */}
        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribución</CardTitle>
            <CardDescription>Proporción por tipo</CardDescription>
          </CardHeader>
          <CardContent>
            <PolarAreaChart data={polarMatData} height={320} />
          </CardContent>
        </Card>
      </div>

      {/* Material progress cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {activeMaterials.map(m => (
          <Card key={m.id} className={`p-4 ${CARD_CLASS}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{m.icon}</span>
              <span className="font-medium text-sm capitalize">{m.name.replace(/_/g, ' ')}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progreso</span>
                <span className="font-medium">{m.completion_rate}%</span>
              </div>
              <Progress value={m.completion_rate} className="h-1.5" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{m.completed_tasks} completados</span>
                <span>{m.total_required} total</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- Tab: Eficiencia ----------
function TabEficiencia() {
  const { data: timeDist = [], isLoading: loadingTime } = useReportTimeDistribution();
  const { data: transitions = [], isLoading: loadingTrans } = useReportWorkflowTransitions();
  const { data: teamByCargo = [] } = useReportTeamByCargo();
  const { data: weeklyByCargo = [] } = useReportWeeklyByCargo();
  const { data: unassignedMaterials = [] } = useReportUnassignedMaterials();

  if (loadingTime || loadingTrans) return <LoadingState />;

  // Average time per status for horizontal bar
  const avgTimeData = timeDist
    .filter(d => d.count > 0)
    .map(d => ({
      name: d.status_name,
      promedio: d.stats.mean,
      mediana: d.stats.median,
      color: STATUS_COLORS[d.status_name] || CHART_COLORS.muted,
      count: d.count,
    }));

  const avgConfig: ChartConfig = {
    promedio: { label: 'Promedio', color: CHART_COLORS.indigo },
    mediana: { label: 'Mediana', color: CHART_COLORS.indigoLight },
  };

  // Workflow transitions for visualization
  const topTransitions = transitions
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(t => ({
      name: `${t.from_status} → ${t.to_status}`,
      count: t.count,
      fromColor: STATUS_COLORS[t.from_status] || CHART_COLORS.muted,
      toColor: STATUS_COLORS[t.to_status] || CHART_COLORS.muted,
    }));

  // Find bottleneck (status with highest average time)
  const bottleneck = avgTimeData.length > 0
    ? avgTimeData.reduce((prev, curr) => curr.promedio > prev.promedio ? curr : prev)
    : null;

  return (
    <div className="space-y-8">
      {/* Bottleneck alert */}
      {bottleneck && bottleneck.promedio > 0 && (
        <Card className={`border-destructive/30 bg-destructive/5 ${CARD_CLASS}`}>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-full p-2" style={{ background: 'linear-gradient(135deg, #EF4444, #FBBF24)' }}>
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-medium text-sm">Cuello de botella detectado</p>
              <p className="text-xs text-muted-foreground">
                Las tareas pasan en promedio <strong>{formatHours(bottleneck.promedio)}</strong> en estado
                "<strong>{bottleneck.name}</strong>" ({bottleneck.count} transiciones registradas)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Violin Chart */}
      <Card className={CARD_CLASS}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Distribución de Tiempo por Estado</CardTitle>
          <CardDescription>Diagrama de violín - distribución de horas que las tareas pasan en cada estado</CardDescription>
        </CardHeader>
        <CardContent>
          <ViolinChart data={timeDist} height={320} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        {/* Average time per status */}
        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tiempo Promedio por Estado</CardTitle>
            <CardDescription>Promedio y mediana en horas</CardDescription>
          </CardHeader>
          <CardContent>
            {avgTimeData.length > 0 ? (
              <ChartContainer config={avgConfig} className="h-[250px] w-full">
                <BarChart data={avgTimeData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid horizontal={false} {...GRID_STYLE} />
                  <XAxis type="number" {...AXIS_STYLE} tickFormatter={(v) => `${v}h`} />
                  <YAxis type="category" dataKey="name" {...AXIS_STYLE} width={90} tick={{ fill: '#64748B', fontSize: 12 }} />
                  <ChartTooltip content={<CustomTooltip />} />
                  <Bar dataKey="promedio" fill={CHART_COLORS.indigo} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} barSize={14} />
                  <Bar dataKey="mediana" fill={CHART_COLORS.indigoLight} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} barSize={14} />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyState message="No hay datos de tiempo" />
            )}
          </CardContent>
        </Card>

        {/* Workflow transitions */}
        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Flujo de Trabajo</CardTitle>
            <CardDescription>Transiciones más frecuentes entre estados</CardDescription>
          </CardHeader>
          <CardContent>
            {topTransitions.length > 0 ? (
              <div className="space-y-2">
                {topTransitions.map((t, i) => {
                  const maxCount = topTransitions[0].count;
                  const width = (t.count / maxCount) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="w-[180px] truncate text-muted-foreground flex-shrink-0">{t.name}</span>
                      <div className="flex-1 relative h-5 bg-white/5 rounded overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded transition-all"
                          style={{
                            width: `${width}%`,
                            background: `linear-gradient(90deg, ${t.fromColor}, ${t.toColor})`,
                            opacity: 0.8,
                          }}
                        />
                        <span className="relative z-10 px-2 leading-5 font-medium">{t.count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState message="No hay transiciones registradas" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="pt-4 border-t">
        <h2 className="text-base font-semibold mb-1">Rendimiento por equipo</h2>
        <p className="text-xs text-muted-foreground mb-6">
          Análisis por cargo: utilización, productividad y materiales pendientes
        </p>
        <div className="space-y-10">
          <CargoPanel cargo="Analista de diseño" members={teamByCargo} weeklyByCargo={weeklyByCargo} unassignedMaterials={unassignedMaterials} />
          <CargoPanel cargo="GIF" members={teamByCargo} weeklyByCargo={weeklyByCargo} unassignedMaterials={unassignedMaterials} />
          <CargoPanel cargo="Presentadora" members={teamByCargo} weeklyByCargo={weeklyByCargo} unassignedMaterials={unassignedMaterials} />
        </div>
      </div>
    </div>
  );
}

// ---------- CargoPanel (Rendimiento por equipo) ----------
function CargoPanel({
  cargo,
  members,
  weeklyByCargo,
  unassignedMaterials,
}: {
  cargo: string;
  members: TeamMemberByCargo[];
  weeklyByCargo: WeeklyByCargoPoint[];
  unassignedMaterials: UnassignedMaterial[];
}) {
  const cargoMembers = members.filter((m) => m.cargo === cargo);
  const activeMembers = cargoMembers.filter((m) => m.is_active);
  const idleMembers = cargoMembers.filter((m) => !m.is_active);
  const cargoWeekly = weeklyByCargo.filter((w) => w.cargo === cargo);

  const barData = cargoMembers.map((m) => ({
    nombre: m.full_name,
    nombreCorto: m.full_name.split(/\s+/).slice(0, 2).join(' '),
    completed_tasks: m.completed_tasks,
    active_tasks: m.active_tasks,
    overdue_tasks: m.overdue_tasks,
  }));

  const weeklyChartData = cargoWeekly.length > 0
    ? cargoWeekly.map((w) => ({
        week: w.week,
        completed_count: w.completed_count,
        label: new Date(w.week + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
      }))
    : [];

  const weekConfig: ChartConfig = {
    completed_count: { label: 'Completadas', color: CHART_COLORS.teal },
  };

  const maxBarHeight = Math.max(cargoMembers.length * 34, 100);
  const PRESENTADORA_MAX_ROWS = 10;
  const materialsSlice = unassignedMaterials.slice(0, PRESENTADORA_MAX_ROWS);
  const hasMoreMaterials = unassignedMaterials.length > PRESENTADORA_MAX_ROWS;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex flex-col">
          <span className="font-semibold text-sm">{cargo}</span>
          <span className="text-xs text-muted-foreground">
            {activeMembers.length} activos · {idleMembers.length} sin carga · {cargoMembers.length} total
          </span>
        </div>
        {activeMembers.some((m) => m.overdue_tasks > 0) && (
          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-[10px]">
            ⚠ Tiene vencidas
          </Badge>
        )}
        {activeMembers.length === 0 && (
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600 text-[10px]">
            Sin actividad
          </Badge>
        )}
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Utilización del equipo</CardTitle>
              <CardDescription className="text-xs">
                Verde = activo · Rojo = tiene vencidas · Gris = sin carga
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-[10px] text-muted-foreground mb-1">
                {activeMembers.length} activos / {cargoMembers.length} total
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {cargoMembers.map((m) => {
                  const color =
                    m.overdue_tasks > 0 ? '#EF4444' : m.is_active ? CHART_COLORS.teal : '#CBD5E1';
                  return (
                    <div
                      key={m.id}
                      title={`${m.full_name}${m.is_active ? ` · ${m.completed_tasks} completadas` : ' · Sin tareas'}${m.overdue_tasks > 0 ? ` · ${m.overdue_tasks} vencidas` : ''}`}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-bold text-white cursor-default transition-transform hover:scale-110"
                      style={{ backgroundColor: color }}
                    >
                      {m.is_active ? (m.overdue_tasks > 0 ? '!' : '✓') : ''}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: CHART_COLORS.teal }} /> Activo
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Con vencidas
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" /> Sin carga
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className={`lg:col-span-2 ${CARD_CLASS}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Velocidad semanal</CardTitle>
              <CardDescription className="text-xs">
                Tareas finalizadas por semana (últimas 8 semanas)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {weeklyChartData.length > 0 ? (
                <ChartContainer config={weekConfig} className="h-[160px] w-full">
                  <LineChart data={weeklyChartData} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid horizontal={false} {...GRID_STYLE} />
                    <XAxis dataKey="label" {...AXIS_STYLE} tick={{ fill: '#64748B', fontSize: 12 }} />
                    <YAxis {...AXIS_STYLE} tick={{ fill: '#64748B', fontSize: 12 }} />
                    <ChartTooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="completed_count" stroke={CHART_COLORS.teal} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <EmptyState message="Sin actividad registrada en las últimas 8 semanas" />
              )}
            </CardContent>
          </Card>
        </div>

        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Productividad individual</CardTitle>
            <CardDescription className="text-xs">
              Tareas completadas y en curso por colaborador
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cargoMembers.length === 0 ? (
              <EmptyState message="Este equipo aún no tiene tareas asignadas en el sistema" />
            ) : barData.every((b) => b.completed_tasks === 0 && b.active_tasks === 0) ? (
              <EmptyState message="Este equipo aún no tiene tareas asignadas en el sistema" />
            ) : (
              <ChartContainer config={{ completed_tasks: { label: 'Completadas', color: CHART_COLORS.teal }, active_tasks: { label: 'En curso', color: CHART_COLORS.indigo } }} className="w-full" style={{ height: maxBarHeight }}>
                <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid horizontal={false} {...GRID_STYLE} />
                  <XAxis type="number" {...AXIS_STYLE} tick={{ fill: '#64748B', fontSize: 12 }} />
                  <YAxis type="category" dataKey="nombreCorto" width={130} tick={{ fill: '#64748B', fontSize: 12 }} />
                  <ChartTooltip content={<CustomTooltip />} />
                  <Bar dataKey="completed_tasks" radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} barSize={14} name="Completadas">
                    {barData.map((_, index) => (
                      <Cell key={index} fill={barData[index].overdue_tasks > 0 ? '#EF4444' : CHART_COLORS.teal} />
                    ))}
                  </Bar>
                  <Bar dataKey="active_tasks" fill={CHART_COLORS.indigo} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} barSize={14} name="En curso" />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {cargoMembers.length <= 10 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cargoMembers.map((m) => {
              const badge =
                m.overdue_tasks > 0
                  ? { label: 'RIESGO', cls: 'border-red-200 bg-red-50 text-red-700' }
                  : !m.is_active
                    ? { label: 'SIN CARGA', cls: 'border-slate-200 bg-slate-50 text-slate-600' }
                    : { label: 'OK', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
              return (
                <Card key={m.id} className={CARD_CLASS}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">{m.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{m.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.cargo}</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${badge.cls}`}>
                        {badge.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                      <span>Total</span><span>{m.total_tasks}</span>
                      <span>Completadas</span><span>{m.completed_tasks}</span>
                      <span>Vencidas</span><span>{m.overdue_tasks}</span>
                      <span>Ajustes</span><span>{m.ajustes_count}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {cargo === 'Presentadora' && (
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Materiales sin asignar</CardTitle>
              <CardDescription className="text-xs">
                Materiales que no tienen ningún colaborador asignado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unassignedMaterials.length === 0 ? (
                <p className="text-sm text-emerald-700 flex items-center gap-2">
                  <span>✓</span> Todos los materiales tienen colaboradores asignados.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 pr-2">Icon</th>
                          <th className="text-left py-2 pr-2">Material</th>
                          <th className="text-left py-2 pr-2">Asignatura</th>
                          <th className="text-left py-2 pr-2">Proyecto</th>
                          <th className="text-right py-2">Cant.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialsSlice.map((row) => (
                          <tr key={row.id} className="border-b hover:bg-muted/30">
                            <td className="py-2 pr-2">{row.icon || '—'}</td>
                            <td className="py-2 pr-2">{row.material_type}</td>
                            <td className="py-2 pr-2">{row.asignatura}</td>
                            <td className="py-2 pr-2">{row.project_name}</td>
                            <td className="py-2 text-right">{row.cantidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hasMoreMaterials && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Ver más ({unassignedMaterials.length - PRESENTADORA_MAX_ROWS} más)
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
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
          <TabsList className="grid w-full grid-cols-5 max-w-[600px]">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="proyectos">Proyectos</TabsTrigger>
            <TabsTrigger value="equipo">Equipo</TabsTrigger>
            <TabsTrigger value="produccion">Producción</TabsTrigger>
            <TabsTrigger value="eficiencia">Eficiencia</TabsTrigger>
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

          <TabsContent value="produccion">
            <TabProduccion />
          </TabsContent>

          <TabsContent value="eficiencia">
            <TabEficiencia />
          </TabsContent>
        </Tabs>
      </div>
    </ReportsErrorBoundary>
  );
}
