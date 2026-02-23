import { Loader2, FolderKanban, Users, Package, Clock, BarChart3, CalendarDays, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
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
} from '@/hooks/useReports';
import {
  CHART_COLORS, SERIES_COLORS, STATUS_COLORS, BAR_RADIUS,
  formatDuration, formatHours,
  AXIS_STYLE, GRID_STYLE,
} from '@/components/reports/ReportCharts';
import { CustomTooltip } from '@/components/charts/CustomTooltip';
import ViolinChart from '@/components/reports/ViolinChart';
import PolarAreaChart from '@/components/reports/PolarAreaChart';

// Snapshot Operativo style — light theme, same as Dashboard
const CARD_CLASS = 'rounded-2xl border border-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200';

// Ranking colors for top collaborators
const RANKING_COLORS = ['#FBBF24', '#4F46E5', '#0DD9D0', '#6366F1', '#BFEFF0'];

// ---------- KPI Card — recipe: rounded-2xl, shadow, icon badge teal ----------
function KpiCard({
  title, value, subtitle, icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-6 transition-all duration-200 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
      <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
        <CardTitle className="text-[11px] uppercase tracking-wide text-[#64748B] font-medium">{title}</CardTitle>
        <div className="kpi-icon-badge">
          <Icon className="h-5 w-5" />
        </div>
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
  const { data: overview, isLoading } = useReportOverview();
  const { data: projectsProgress = [] } = useReportProjectsProgress();
  const { data: team = [] } = useReportTeamPerformance();

  if (isLoading || !overview) {
    return <LoadingState />;
  }

  // Polar area chart data
  const statusData = overview.tasks.by_status.map(s => ({
    name: s.name,
    value: s.count,
    color: STATUS_COLORS[s.name] || CHART_COLORS.muted,
  }));

  // Top 5 collaborators with ranking colors
  const top5 = team.slice(0, 5).map((t, i) => ({
    name: t.full_name.split(' ').slice(0, 2).join(' '),
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
  const projectBarData = projectsProgress.slice(0, 8).map(p => ({
    name: p.key,
    completadas: p.completed_tasks,
    en_progreso: p.in_progress_tasks,
    en_revision: p.in_review_tasks,
    pendientes: Math.max(0, p.total_tasks - p.completed_tasks - p.in_progress_tasks - p.in_review_tasks),
  }));

  const projectBarConfig: ChartConfig = {
    completadas: { label: 'Completadas', color: CHART_COLORS.teal },
    en_progreso: { label: 'En progreso', color: CHART_COLORS.indigo },
    en_revision: { label: 'En revisión', color: CHART_COLORS.yellow },
    pendientes: { label: 'Pendientes', color: CHART_COLORS.muted },
  };

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7">
        <KpiCard
          title="Proyectos Activos"
          value={overview.projects.active}
          subtitle={`${overview.projects.total} totales`}
          icon={FolderKanban}
        />
        <KpiCard
          title="Tareas Totales"
          value={overview.tasks.total}
          subtitle={`${overview.recent_completed_30d} completadas (30d)`}
          icon={BarChart3}
        />
        <KpiCard
          title="Materiales"
          value={`${overview.materials.completion_rate}%`}
          subtitle={`${overview.materials.completed} de ${overview.materials.total} completados`}
          icon={Package}
        />
        <KpiCard
          title="Equipo Activo"
          value={overview.team.active_members}
          subtitle={overview.avg_completion_seconds > 0
            ? `Promedio: ${formatDuration(overview.avg_completion_seconds)}`
            : 'Sin datos de tiempo aún'}
          icon={Users}
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

      {/* Row 3: Top Collaborators with ranking colors */}
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

  if (isLoading) return <LoadingState />;

  if (projects.length === 0) return <EmptyState message="No hay proyectos registrados" />;

  return (
    <div className="space-y-8">
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
    </div>
  );
}

// ---------- Tab: Equipo ----------
function TabEquipo() {
  const { data: team = [], isLoading } = useReportTeamPerformance();
  const { data: capacity, isLoading: loadingCapacity } = useReportTeamCapacity();
  const { data: workload = [] } = useReportWorkloadByCargo();

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
    name: m.full_name.split(' ').slice(0, 2).join(' '),
    pending_horas: m.pending_horas,
    completed_horas: m.completed_horas,
    capacidad_semanal: capacity?.schedule.weekly_hours || 40.25,
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
              <span className="text-teal-700">Lun-Jue: {capacity.schedule.mon_thu_hours}h</span>
              <span className="text-teal-700">Vie: {capacity.schedule.friday_hours}h</span>
              <span className="text-teal-700 font-semibold">Semanal: {capacity.schedule.weekly_hours}h</span>
              <span className="text-teal-700">Promedio diario: {capacity.schedule.avg_daily_hours}h</span>
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

              return (
                <Card key={member.id} className={CARD_CLASS}>
                  <CardContent className="pt-5 pb-4 space-y-3">
                    {/* Header: Avatar + Name + Risk badge */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.avatar_url || ''} />
                        <AvatarFallback className="text-xs">
                          {member.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">{member.full_name}</p>
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
                  </CardContent>
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
                            {member.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate max-w-[150px]">{member.full_name}</span>
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
    color: SERIES_COLORS[i % SERIES_COLORS.length],
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
  return (
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
  );
}
