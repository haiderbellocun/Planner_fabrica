// Capacidad Operativa — vista experimental centrada en la carga de la semana (no en el
// backlog acumulado, que es lo que ya resuelve CapacidadFabricaTab). Reutiliza por
// completo capacity-forecast (semana actual + próximas semanas + backlog por persona)
// y people-workload (distribución por proyecto); no agrega endpoints nuevos.
import { toLocalISODate } from '@/lib/dates';
import { useMemo, useState, type ReactNode } from 'react';
import { Search, Users, HelpCircle, ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle, FileWarning, PieChart, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Cell, LabelList, ReferenceLine } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { CHART_COLORS, formatHours, AXIS_STYLE, GRID_STYLE, BAR_RADIUS, GradientDef } from '@/components/reports/ReportCharts';
import { axisTick, chartColors, chartSurface } from '@/components/charts/chartTheme';
import { StatTile, SectionHeader, LoadingState, EmptyState, StatusPill } from '@/components/shared/StoryUI';
import { cn } from '@/lib/utils';
import {
  useReportCapacityForecast,
  useReportPeopleWorkload,
  useReportWorkloadByCargo,
  useUserMiniReport,
  type CapacityForecastMember,
  type PersonWorkload,
  type PersonWorkloadProject,
} from '@/hooks/useReports';
import { useProjects, type ProjectWithDetails } from '@/hooks/useProjects';
import {
  aggregatePeriodKpis, backlogHeadroom, currentWeekCapacityForTrend, forecastWeekLabel,
  operativeBand, periodSnapshot, weeklyTeamCapacity, type PeriodKey, type Tone,
} from '@/lib/capacityMetrics';

const CARD_CLASS = 'rounded-2xl border border-border bg-card shadow-card';

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'current', label: 'Esta semana' },
  { value: 'next', label: 'Próxima semana' },
  { value: 'next4', label: 'Próximas 4 semanas' },
];

const STATUS_OPTIONS: { value: 'all' | Tone; label: string }[] = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'available', label: 'Disponible' },
  { value: 'good', label: 'Saludable' },
  { value: 'warning', label: 'Alta ocupación' },
  { value: 'critical', label: 'Sobrecarga' },
];

const TONE_CLASSES: Record<Tone, string> = {
  available: 'bg-[hsl(205,85%,48%)]/10 text-[hsl(205,85%,38%)]',
  good: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-[hsl(32,75%,38%)]',
  critical: 'bg-destructive/10 text-destructive',
};

const STATUS_PRIORITY: Record<Tone, number> = { critical: 0, warning: 1, good: 2, available: 3 };

const TONE_HEX: Record<Tone, string> = {
  available: chartColors.info,
  good: CHART_COLORS.green,
  warning: CHART_COLORS.yellow,
  critical: CHART_COLORS.coral,
};

function fragmentation(projectCount: number): { label: string; tone: Tone } {
  if (projectCount >= 5) return { label: 'Alta', tone: 'critical' };
  if (projectCount >= 3) return { label: 'Media', tone: 'warning' };
  return { label: 'Baja', tone: 'good' };
}

function initials(name: string | null): string {
  return (name || 'U').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || 'U';
}

function formatSignedHours(hours: number): string {
  if (Math.abs(hours) < 0.05) return '0h';
  const sign = hours < 0 ? '-' : '';
  return `${sign}${formatHours(Math.abs(hours))}`;
}

function weekRangeLabel(weekStartISO: string): string {
  const start = new Date(`${weekStartISO}T12:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  const day = (d: Date) => String(d.getDate()).padStart(2, '0');
  const month = end.toLocaleDateString('es-CO', { month: 'short' });
  return `${day(start)}–${day(end)} ${month}`;
}

interface OperativeRow {
  id: string;
  full_name: string;
  cargo: string | null;
  avatar_url: string | null;
  weekly_hours_capacity: number;
  current: CapacityForecastMember['current'];
  weeks: CapacityForecastMember['weeks'];
  backlog: CapacityForecastMember['backlog'];
  projects: PersonWorkloadProject[];
  tareasActivas: number;
}

function buildRows(
  members: CapacityForecastMember[],
  peopleById: Map<string, PersonWorkload>,
  projectFilter: string,
): OperativeRow[] {
  return members.map((m) => {
    const pw = peopleById.get(m.id);
    let projects = pw?.projects ?? [];
    if (projectFilter !== 'all') projects = projects.filter((p) => p.project_id === projectFilter);
    return {
      id: m.id,
      full_name: m.full_name,
      cargo: m.cargo,
      avatar_url: m.avatar_url,
      weekly_hours_capacity: m.weekly_hours_capacity,
      current: m.current,
      weeks: m.weeks,
      backlog: m.backlog,
      projects,
      tareasActivas: projects.reduce((s, p) => s + p.tareas_pendientes, 0),
    };
  });
}

// ---------- Small building blocks ----------

// Custom XAxis tick for the occupancy trend chart — bolds + tags the current week
// so "where are we now" reads at a glance, without a 5th phantom column.
function WeekAxisTick({ x, y, payload, index }: { x?: number; y?: number; payload?: { value: string }; index?: number }) {
  const isCurrent = index === 0;
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text dy={12} textAnchor="middle" fontSize={11} fill={isCurrent ? CHART_COLORS.teal : axisTick.fill} fontWeight={isCurrent ? 700 : 400}>
        {payload?.value}
      </text>
      {isCurrent && (
        <text dy={26} textAnchor="middle" fontSize={9} fontWeight={700} fill={CHART_COLORS.teal}>
          Semana actual
        </text>
      )}
    </g>
  );
}

function HeatCell({ pct }: { pct: number }) {
  if (pct === 0) {
    return (
      <div className="rounded-lg px-2 py-1.5 text-center text-xs font-medium tabular-nums min-w-[56px] bg-muted/40 text-muted-foreground/70">
        0%
      </div>
    );
  }
  const { tone } = operativeBand(pct);
  return (
    <div className={cn('rounded-lg px-2 py-1.5 text-center text-xs font-bold tabular-nums min-w-[56px]', TONE_CLASSES[tone])}>
      {pct}%
    </div>
  );
}

function PersonIdentity({ row, onClick }: { row: OperativeRow; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2.5 min-w-0 text-left group">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={row.avatar_url || ''} />
        <AvatarFallback className="text-xs">{initials(row.full_name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{row.full_name}</p>
        <p className="text-xs text-muted-foreground truncate">{row.cargo || 'Sin cargo'}</p>
      </div>
    </button>
  );
}

function FragmentationTag({ count }: { count: number }) {
  const { label, tone } = fragmentation(count);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold cursor-help', TONE_CLASSES[tone])}>
          {count} {count === 1 ? 'proyecto' : 'proyectos'} · {label}
          <HelpCircle className="h-3 w-3 opacity-60" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px] text-xs">
        Indica cuánto está distribuido el trabajo de la persona entre proyectos simultáneos.
      </TooltipContent>
    </Tooltip>
  );
}

// ---------- Operational alert cards ----------

type AlertKind = 'sobrecarga' | 'sin_estimacion' | 'concentracion' | 'ok';

interface OperationalAlert {
  kind: AlertKind;
  title: string;
  description: string;
}

const ALERT_KIND_META: Record<AlertKind, { tone: Tone; icon: typeof AlertTriangle; badge: string }> = {
  sobrecarga: { tone: 'critical', icon: AlertTriangle, badge: 'Revisar' },
  sin_estimacion: { tone: 'warning', icon: FileWarning, badge: 'Sin estimar' },
  concentracion: { tone: 'available', icon: PieChart, badge: 'Concentración' },
  ok: { tone: 'good', icon: CheckCircle2, badge: 'OK' },
};

function AlertCard({ kind, title, description }: OperationalAlert) {
  const meta = ALERT_KIND_META[kind];
  const Icon = meta.icon;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3 shadow-card">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', TONE_CLASSES[meta.tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <span className={cn('shrink-0 text-2xs font-bold px-2 py-1 rounded-full whitespace-nowrap', TONE_CLASSES[meta.tone])}>
        {meta.badge}
      </span>
    </div>
  );
}

// ---------- Sortable table header ----------

type SortCol = 'name' | 'frag' | 'tasks' | 'week' | 'capacity' | 'occ' | 'free' | 'backlog' | 'status';

function SortableTh({
  label, col, sortCol, sortDir, onSort, align = 'center',
}: {
  label: string; col: SortCol; sortCol: SortCol | null; sortDir: 'asc' | 'desc';
  onSort: (col: SortCol) => void; align?: 'left' | 'center';
}) {
  const active = sortCol === col;
  return (
    <th
      className={cn(
        'px-3 py-2.5 font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors',
        align === 'left' ? 'text-left' : 'text-center',
      )}
      onClick={() => onSort(col)}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'center' && 'justify-center w-full')}>
        {label}
        {active ? (
          sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

// ---------- Chart tooltips (rich, per-chart fields — CustomTooltip only echoes series) ----------

const CHART_TOOLTIP_CLASS = 'bg-card border border-black/5 shadow-floating rounded-xl p-3 min-w-[170px] text-xs space-y-1';

function TooltipRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="figure font-medium text-foreground">{value}</span>
    </div>
  );
}

interface PersonBarDatum {
  full_name: string;
  cargo: string | null;
  comprometido: number;
  capacidad: number;
  pct: number;
  libres: number;
}

function PersonBarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PersonBarDatum }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={CHART_TOOLTIP_CLASS}>
      <p className="font-semibold text-sm text-foreground">{d.full_name}</p>
      <p className="text-muted-foreground mb-1.5">{d.cargo || 'Sin cargo'}</p>
      <TooltipRow label="Comprometido" value={formatHours(d.comprometido)} />
      <TooltipRow label="Capacidad" value={formatHours(d.capacidad)} />
      <TooltipRow label="Ocupación" value={`${d.pct}%`} />
      <TooltipRow label="Horas libres" value={formatSignedHours(d.libres)} />
    </div>
  );
}

interface WeekTrendDatum {
  label: string;
  isCurrent: boolean;
  capacidad: number;
  capacidadRestante: number | null;
  carga: number;
  disponible: number;
  pct: number;
}

function WeekTrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: WeekTrendDatum }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={CHART_TOOLTIP_CLASS}>
      <p className="font-semibold text-sm text-foreground mb-1.5">
        Semana {d.label}{d.isCurrent ? ' · Semana actual' : ''}
      </p>
      {d.isCurrent ? (
        <>
          <TooltipRow label="Capacidad semanal" value={formatHours(d.capacidad)} />
          <TooltipRow label="Capacidad restante" value={formatHours(d.capacidadRestante ?? 0)} />
          <TooltipRow label="Horas comprometidas restantes" value={formatHours(d.carga)} />
          <TooltipRow label="Capacidad disponible" value={formatSignedHours(d.disponible)} />
          <TooltipRow label="Ocupación restante" value={`${d.pct}%`} />
        </>
      ) : (
        <>
          <TooltipRow label="Capacidad" value={formatHours(d.capacidad)} />
          <TooltipRow label="Comprometidas" value={formatHours(d.carga)} />
          <TooltipRow label="Capacidad disponible" value={formatSignedHours(d.disponible)} />
          <TooltipRow label="Ocupación" value={`${d.pct}%`} />
        </>
      )}
    </div>
  );
}

interface ProjectBarDatum {
  name: string;
  horas: number;
  pct: number;
}

function ProjectBarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ProjectBarDatum }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={CHART_TOOLTIP_CLASS}>
      <p className="font-semibold text-sm text-foreground mb-1.5">{d.name}</p>
      <TooltipRow label="Horas" value={formatHours(d.horas)} />
      <TooltipRow label="Del total" value={`${d.pct}%`} />
    </div>
  );
}

interface BacklogBarDatum {
  name: string;
  horas: number;
  semanas: number;
}

function BacklogBarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: BacklogBarDatum }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={CHART_TOOLTIP_CLASS}>
      <p className="font-semibold text-sm text-foreground mb-1.5">{d.name}</p>
      <TooltipRow label="Backlog" value={formatHours(d.horas)} />
      <TooltipRow label="Semanas estimadas" value={`${d.semanas} sem`} />
    </div>
  );
}

interface CargoBarDatum {
  cargo: string;
  nPersonas: number;
  capacidad: number;
  asignadas: number;
  disponibles: number;
  ocupacionPct: number;
}

function CargoBarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CargoBarDatum }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={CHART_TOOLTIP_CLASS}>
      <p className="font-semibold text-sm text-foreground mb-1.5">{d.cargo}</p>
      <TooltipRow label="Personas" value={d.nPersonas} />
      <TooltipRow label="Capacidad" value={formatHours(d.capacidad)} />
      <TooltipRow label="Asignadas" value={formatHours(d.asignadas)} />
      <TooltipRow label="Disponibles" value={formatSignedHours(d.disponibles)} />
      <TooltipRow label="Ocupación" value={`${d.ocupacionPct}%`} />
    </div>
  );
}

function FilterBar({
  period, onPeriod, cargo, onCargo, cargoOptions, project, onProject, projectOptions, status, onStatus, search, onSearch,
}: {
  period: PeriodKey; onPeriod: (v: PeriodKey) => void;
  cargo: string; onCargo: (v: string) => void; cargoOptions: string[];
  project: string; onProject: (v: string) => void; projectOptions: ProjectWithDetails[];
  status: 'all' | Tone; onStatus: (v: 'all' | Tone) => void;
  search: string; onSearch: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Select value={period} onValueChange={(v) => onPeriod(v as PeriodKey)}>
        <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={cargo} onValueChange={onCargo}>
        <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Todos los cargos" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los cargos</SelectItem>
          {cargoOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={project} onValueChange={onProject}>
        <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Todos los proyectos" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los proyectos</SelectItem>
          {projectOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={(v) => onStatus(v as 'all' | Tone)}>
        <SelectTrigger className="w-[170px] h-9 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="relative w-full sm:w-56">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Buscar persona..." className="pl-8 h-9 text-xs" />
      </div>
    </div>
  );
}

export function CapacidadOperativaTab() {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('current');
  const [cargoFilter, setCargoFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Tone>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showZeroLoad, setShowZeroLoad] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: forecast, isLoading: loadingForecast } = useReportCapacityForecast({
    ...(cargoFilter !== 'all' ? { cargo: cargoFilter } : {}),
    ...(projectFilter !== 'all' ? { project_id: projectFilter } : {}),
    weeks: 4,
  });
  const { data: workload, isLoading: loadingWorkload } = useReportPeopleWorkload();
  const { data: cargoRows = [] } = useReportWorkloadByCargo();
  const { data: projects = [] } = useProjects();
  const { data: userMini, isLoading: loadingUserMini } = useUserMiniReport(selectedId);

  const cargoOptions = useMemo(() => cargoRows.map((c) => c.cargo).sort(), [cargoRows]);
  const activeProjects = useMemo(() => projects.filter((p) => p.status === 'active'), [projects]);

  const peopleById = useMemo(() => new Map((workload?.people ?? []).map((p) => [p.id, p])), [workload]);
  const scopedRows = useMemo(
    () => buildRows(forecast?.members ?? [], peopleById, projectFilter),
    [forecast, peopleById, projectFilter],
  );

  const searchedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scopedRows;
    return scopedRows.filter((r) => r.full_name.toLowerCase().includes(q) || (r.cargo ?? '').toLowerCase().includes(q));
  }, [scopedRows, search]);

  const tableRows = useMemo(() => {
    const rows = statusFilter === 'all'
      ? searchedRows
      : searchedRows.filter((r) => operativeBand(periodSnapshot(r, periodKey).pct).tone === statusFilter);
    return [...rows].sort((a, b) => periodSnapshot(b, periodKey).pct - periodSnapshot(a, periodKey).pct);
  }, [searchedRows, statusFilter, periodKey]);

  const kpis = useMemo(() => aggregatePeriodKpis(tableRows, periodKey), [tableRows, periodKey]);
  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === periodKey)?.label;

  const barChartData = useMemo(() => {
    return tableRows.slice(0, 10).map((r) => {
      const snap = periodSnapshot(r, periodKey);
      return {
        id: r.id,
        name: r.full_name,
        full_name: r.full_name,
        cargo: r.cargo,
        comprometido: Math.round(snap.horas * 100) / 100,
        capacidad: Math.round(snap.capacidad * 100) / 100,
        pct: snap.pct,
        libres: Math.round(snap.holgura * 100) / 100,
        over: snap.pct > 100,
      };
    });
  }, [tableRows, periodKey]);

  const trendData = useMemo(() => {
    const capacidadTotal = Math.round(tableRows.reduce((s, r) => s + r.weekly_hours_capacity, 0) * 100) / 100;
    const capacidadRestanteTotal = currentWeekCapacityForTrend(capacidadTotal);
    const weeksArr = tableRows[0]?.weeks ?? [];
    return weeksArr.map((w, i) => {
      const isCurrent = w.es_semana_actual;
      // weeks[i].horas ya viene repartido por el backend entre "ahora" y el
      // vencimiento de cada tarea (incluye lo vencido, lo que vence esta semana, y la
      // porción que le toca a esta semana de tareas que vencen más adelante) — es la
      // MISMA fuente para las 4 semanas, así no hay un salto de fórmula entre el punto
      // 0 y el resto que no tenga que ver con la carga real.
      const carga = Math.round(
        tableRows.reduce((s, r) => s + (r.weeks[i]?.horas ?? 0), 0) * 100,
      ) / 100;
      const capacidad = isCurrent ? capacidadRestanteTotal : capacidadTotal;
      const disponible = Math.round((capacidad - carga) * 100) / 100;
      const pct = capacidad > 0 ? Math.round((carga / capacidad) * 100) : 0;
      return {
        week_start: w.week_start,
        label: weekRangeLabel(w.week_start),
        isCurrent,
        capacidad: capacidadTotal,
        capacidadRestante: isCurrent ? capacidadRestanteTotal : null,
        carga,
        disponible,
        pct,
      };
    });
  }, [tableRows]);

  const matrix = useMemo(() => {
    const totals = new Map<string, { name: string; key: string; total: number }>();
    for (const r of tableRows) {
      for (const p of r.projects) {
        const e = totals.get(p.project_id) ?? { name: p.project_name, key: p.project_key, total: 0 };
        e.total += p.horas_pendientes;
        totals.set(p.project_id, e);
      }
    }
    const sorted = Array.from(totals.entries()).sort((a, b) => b[1].total - a[1].total);
    const top = sorted.slice(0, 8);
    const topIds = new Set(top.map(([id]) => id));
    const rows = tableRows
      .map((r) => {
        const cells = top.map(([id]) => r.projects.find((p) => p.project_id === id)?.horas_pendientes ?? 0);
        const otros = r.projects.filter((p) => !topIds.has(p.project_id)).reduce((s, p) => s + p.horas_pendientes, 0);
        const total = Math.round((cells.reduce((s, v) => s + v, 0) + otros) * 100) / 100;
        return { id: r.id, full_name: r.full_name, cells, otros, total };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
    return { columns: top.map(([id, v]) => ({ id, ...v })), rows, hasOtros: rows.some((r) => r.otros > 0) };
  }, [tableRows]);

  const projectChartData = useMemo(() => {
    const otrosTotal = Math.round(matrix.rows.reduce((s, r) => s + r.otros, 0) * 100) / 100;
    const totalAll = matrix.columns.reduce((s, c) => s + c.total, 0) + otrosTotal;
    const items = matrix.columns
      .filter((c) => c.total > 0)
      .map((c) => {
        const pct = totalAll > 0 ? Math.round((c.total / totalAll) * 100) : 0;
        const horas = Math.round(c.total * 100) / 100;
        return { id: c.id, name: c.name, horas, pct, labelText: `${formatHours(horas)} · ${pct}%` };
      });
    if (otrosTotal > 0) {
      const pct = totalAll > 0 ? Math.round((otrosTotal / totalAll) * 100) : 0;
      items.push({ id: '__otros__', name: 'Otros', horas: otrosTotal, pct, labelText: `${formatHours(otrosTotal)} · ${pct}%` });
    }
    return items.sort((a, b) => b.horas - a.horas);
  }, [matrix]);

  const cargoCapacity = useMemo(() => {
    const map = new Map<string, { cargo: string; capacidad: number; asignadas: number; nPersonas: number }>();
    for (const r of tableRows) {
      const key = r.cargo ?? 'Sin cargo';
      const e = map.get(key) ?? { cargo: key, capacidad: 0, asignadas: 0, nPersonas: 0 };
      const snap = periodSnapshot(r, periodKey);
      e.capacidad += snap.capacidad;
      e.asignadas += snap.horas;
      e.nPersonas += 1;
      map.set(key, e);
    }
    return Array.from(map.values())
      .map((e) => {
        const disponibles = Math.round((e.capacidad - e.asignadas) * 100) / 100;
        const ocupacionPct = e.capacidad > 0 ? Math.round((e.asignadas / e.capacidad) * 100) : 0;
        return { ...e, disponibles, ocupacionPct };
      })
      .sort((a, b) => b.ocupacionPct - a.ocupacionPct);
  }, [tableRows, periodKey]);

  const cargoChartData = useMemo(() => cargoCapacity.map((c) => ({
    cargo: c.cargo,
    nPersonas: c.nPersonas,
    capacidad: c.capacidad,
    asignadas: c.asignadas,
    disponibles: c.disponibles,
    ocupacionPct: c.ocupacionPct,
    disponiblesBar: Math.max(0, Math.round((c.capacidad - c.asignadas) * 100) / 100),
  })), [cargoCapacity]);

  const attentionItems = useMemo(() => {
    const items: OperationalAlert[] = [];

    tableRows
      .map((r) => ({ r, snap: periodSnapshot(r, periodKey) }))
      .filter((x) => x.snap.pct > 100)
      .sort((a, b) => b.snap.pct - a.snap.pct)
      .slice(0, 3)
      .forEach(({ r, snap }) => {
        items.push({
          kind: 'sobrecarga',
          title: r.full_name,
          description: `${formatHours(snap.horas)} asignadas sobre ${formatHours(snap.capacidad)} disponibles.`,
        });
      });

    tableRows
      .filter((r) => r.backlog.unidades_sin_estimacion > 0)
      .sort((a, b) => b.backlog.unidades_sin_estimacion - a.backlog.unidades_sin_estimacion)
      .slice(0, 2)
      .forEach((r) => {
        items.push({
          kind: 'sin_estimacion',
          title: r.full_name,
          description: `${r.backlog.unidades_sin_estimacion} ${r.backlog.unidades_sin_estimacion === 1 ? 'tarea sin estimación' : 'tareas sin estimación'}.`,
        });
      });

    if (matrix.columns.length > 0) {
      const totalHoras = matrix.columns.reduce((s, c) => s + c.total, 0) + matrix.rows.reduce((s, r) => s + r.otros, 0);
      const top = matrix.columns[0];
      if (totalHoras > 0) {
        const pct = Math.round((top.total / totalHoras) * 100);
        items.push({
          kind: 'concentracion',
          title: top.name,
          description: `${pct}% de la carga del alcance.`,
        });
      }
    }

    items.push({
      kind: kpis.sobrecargadas > 0 ? 'sobrecarga' : 'ok',
      title: 'Capacidad del equipo',
      description: kpis.sobrecargadas > 0
        ? `${kpis.sobrecargadas} ${kpis.sobrecargadas === 1 ? 'persona está' : 'personas están'} por encima de su capacidad semanal.`
        : 'Nadie supera su capacidad semanal.',
    });

    return items;
  }, [tableRows, periodKey, matrix, kpis]);

  const backlogSummary = useMemo(() => {
    const rows = tableRows;
    const horasTotal = rows.reduce((s, r) => s + r.backlog.horas_total, 0);
    const horasSinFecha = rows.reduce((s, r) => s + r.backlog.horas_sin_fecha, 0);
    const horasVencidas = rows.reduce((s, r) => s + r.current.horas_vencidas, 0);
    const maxFecha = rows.reduce<string | null>((max, r) => {
      if (!r.backlog.fecha_backlog_vacio) return max;
      if (!max || r.backlog.fecha_backlog_vacio > max) return r.backlog.fecha_backlog_vacio;
      return max;
    }, null);
    const top = [...rows].sort((a, b) => b.backlog.horas_total - a.backlog.horas_total).slice(0, 10);
    return { horasTotal, horasSinFecha, horasVencidas, maxFecha, top };
  }, [tableRows]);

  // "¿Puedo tomar más proyectos?" — compara TODO el backlog pendiente (no solo esta
  // semana) contra la capacidad semanal del equipo, expresado en semanas equivalentes.
  // Es la misma lente que usa Capacidad de Fábrica (horas_pendientes_total / capacidad),
  // solo que aquí se expresa en semanas y con un veredicto explícito en vez de un %.
  // La capacidad es SIEMPRE una semana del equipo (no depende del período elegido arriba):
  // el backlog se mide en semanas equivalentes de capacidad.
  const capacityHeadroom = useMemo(
    () => backlogHeadroom(weeklyTeamCapacity(tableRows), backlogSummary.horasTotal),
    [tableRows, backlogSummary],
  );

  const backlogChartData = useMemo(() => backlogSummary.top
    .filter((r) => r.backlog.horas_total > 0)
    .map((r) => {
      const horas = Math.round(r.backlog.horas_total * 100) / 100;
      const semanas = Math.round((r.backlog.dias_para_vaciar / 5) * 10) / 10;
      return { id: r.id, name: r.full_name, horas, semanas, labelText: `${formatHours(horas)} · ${semanas} sem` };
    }), [backlogSummary]);

  const heatmapRows = useMemo(() => {
    const withMax = tableRows.map((r) => ({
      r,
      maxPct: r.weeks.reduce((max, w) => Math.max(max, w.utilizacion_pct), 0),
    }));
    const sorted = [...withMax].sort((a, b) => b.maxPct - a.maxPct);
    const visible = showZeroLoad ? sorted : sorted.filter((x) => x.maxPct > 0);
    return { all: sorted.map((x) => x.r), visible: visible.map((x) => x.r) };
  }, [tableRows, showZeroLoad]);

  const handleSort = (col: SortCol) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') {
      setSortDir('desc');
      return;
    }
    setSortCol(null);
  };

  const displayRows = useMemo(() => {
    if (!sortCol) return tableRows;
    const dir = sortDir === 'asc' ? 1 : -1;
    const value = (r: OperativeRow): number | string => {
      const snap = periodSnapshot(r, periodKey);
      switch (sortCol) {
        case 'name': return r.full_name.toLowerCase();
        case 'frag': return r.projects.length;
        case 'tasks': return r.tareasActivas;
        case 'week': return snap.horas;
        case 'capacity': return r.weekly_hours_capacity;
        case 'occ': return snap.pct;
        case 'free': return snap.holgura;
        case 'backlog': return r.backlog.dias_para_vaciar;
        case 'status': return STATUS_PRIORITY[operativeBand(snap.pct).tone];
        default: return 0;
      }
    };
    return [...tableRows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [tableRows, sortCol, sortDir, periodKey]);

  const selectedRow = useMemo(() => scopedRows.find((r) => r.id === selectedId) ?? null, [scopedRows, selectedId]);
  const selectedSnapshot = selectedRow ? periodSnapshot(selectedRow, periodKey) : null;
  const selectedProjectsTotal = selectedRow ? selectedRow.projects.reduce((s, p) => s + p.horas_pendientes, 0) : 0;

  const sortedTasks = useMemo(() => {
    const tasks = userMini?.top_tasks ?? [];
    const today = toLocalISODate(new Date());
    return [...tasks].sort((a, b) => {
      const aOverdue = !!a.due_date && a.due_date < today;
      const bOverdue = !!b.due_date && b.due_date < today;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    });
  }, [userMini]);

  const openPerson = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };

  if (loadingForecast || loadingWorkload) {
    return <LoadingState label="Cargando capacidad operativa..." />;
  }

  if (!forecast) {
    return <EmptyState message="No se pudo cargar la capacidad operativa." />;
  }

  const heatmapWeeks = tableRows[0]?.weeks ?? scopedRows[0]?.weeks ?? [];
  const today = toLocalISODate(new Date());

  return (
    <div className="space-y-7">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight">Capacidad Operativa</h2>
            <Badge variant="outline" className="text-2xs font-semibold">Experimental</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Visión de la carga real del equipo, disponibilidad, compromisos y capacidad futura.
          </p>
        </div>
        <FilterBar
          period={periodKey} onPeriod={setPeriodKey}
          cargo={cargoFilter} onCargo={setCargoFilter} cargoOptions={cargoOptions}
          project={projectFilter} onProject={setProjectFilter} projectOptions={activeProjects}
          status={statusFilter} onStatus={setStatusFilter}
          search={search} onSearch={setSearch}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile label="Capacidad del período" value={formatHours(kpis.capacidad)} sub={periodLabel} />
        <StatTile label="Carga del período" value={formatHours(kpis.comprometidas)} sub="Horas asignadas en el período" />
        <StatTile
          label="Horas disponibles"
          value={formatSignedHours(kpis.disponible)}
          sub="Capacidad − carga del período"
        />
        <StatTile
          label="Ocupación"
          value={`${kpis.ocupacion}%`}
          sub={`${formatHours(kpis.comprometidas)} de ${formatHours(kpis.capacidad)}`}
          pill={{ tone: operativeBand(kpis.ocupacion).tone, label: operativeBand(kpis.ocupacion).label }}
        />
        <StatTile
          label="Sobrecarga del equipo"
          value={kpis.sobrecargadas}
          sub={`de ${tableRows.length} en el alcance · ${periodLabel?.toLowerCase()}`}
          pill={kpis.sobrecargadas > 0 ? { tone: 'critical', label: 'Revisar' } : { tone: 'good', label: 'OK' }}
        />
      </div>

      <Card className={CARD_CLASS}>
        <CardContent className="p-4 space-y-3.5">
          <div className="flex items-center gap-3">
            <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', TONE_CLASSES[capacityHeadroom.tone])}>
              {capacityHeadroom.tone === 'good' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            </div>
            <p className="text-sm font-bold flex-1 min-w-0">{capacityHeadroom.verdict}</p>
            <span className={cn('shrink-0 text-2xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap', TONE_CLASSES[capacityHeadroom.tone])}>
              {capacityHeadroom.tone === 'good' ? '¿Nuevo proyecto? Sí' : capacityHeadroom.tone === 'warning' ? '¿Nuevo proyecto? Con cuidado' : '¿Nuevo proyecto? No todavía'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/60">
            <div>
              <p className="text-2xs text-muted-foreground">Capacidad total</p>
              <p className="text-base font-bold tabular-nums">{formatHours(capacityHeadroom.capacidadSemanal)}</p>
              <p className="text-2xs text-muted-foreground">una semana del equipo en el alcance</p>
            </div>
            <div>
              <p className="text-2xs text-muted-foreground">Backlog total</p>
              <p className="text-base font-bold tabular-nums">{formatHours(capacityHeadroom.backlogTotal)}</p>
              <p className="text-2xs text-muted-foreground">todo lo pendiente, sin importar el período</p>
            </div>
            <div>
              <p className="text-2xs text-muted-foreground">Equivalente</p>
              <p className="text-base font-bold tabular-nums">{capacityHeadroom.semanasEquivalentes} sem</p>
              <p className="text-2xs text-muted-foreground">semanas de capacidad para vaciarlo</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section>
          <SectionHeader tag="Visual" title="Carga vs capacidad por colaborador" />
          <p className="text-xs text-muted-foreground -mt-3 mb-4">
            Comparación entre las horas comprometidas y la capacidad semanal de cada persona, top 10 por ocupación.
          </p>
          {barChartData.length === 0 ? (
            <EmptyState message="No hay personas que coincidan con los filtros seleccionados." />
          ) : (
            <Card className={CARD_CLASS}>
              <CardContent className="p-4">
                <ChartContainer
                  config={{
                    comprometido: { label: 'Comprometido', color: CHART_COLORS.teal },
                    capacidad: { label: 'Capacidad', color: chartColors.slate },
                  }}
                  className="h-[320px] w-full"
                >
                  <BarChart data={barChartData} layout="vertical" margin={{ left: 10, right: 16 }}>
                    <CartesianGrid horizontal={false} {...GRID_STYLE} />
                    <XAxis type="number" {...AXIS_STYLE} tickFormatter={(v: number) => `${v}h`} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      {...AXIS_STYLE}
                      width={100}
                      tick={{ fill: axisTick.fill, fontSize: 11 }}
                      tickFormatter={(value: string) => (value.length > 14 ? `${value.slice(0, 13)}…` : value)}
                    />
                    <ChartTooltip content={<PersonBarTooltip />} />
                    <Bar dataKey="capacidad" fill={chartColors.slate} fillOpacity={0.35} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} />
                    <Bar dataKey="comprometido" radius={[0, BAR_RADIUS, BAR_RADIUS, 0]}>
                      {barChartData.map((d) => (
                        <Cell key={d.id} fill={d.over ? CHART_COLORS.coral : CHART_COLORS.teal} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </section>

        <section>
          <SectionHeader tag="Visual" title="Ocupación proyectada" />
          <p className="text-xs text-muted-foreground -mt-3 mb-4">
            Porcentaje de capacidad comprometida durante las próximas semanas.
          </p>
          {trendData.length === 0 ? (
            <EmptyState message="No hay semanas proyectadas para los filtros seleccionados." />
          ) : (
            <Card className={CARD_CLASS}>
              <CardContent className="p-4">
                <ChartContainer config={{ pct: { label: 'Ocupación', color: CHART_COLORS.teal } }} className="h-[320px] w-full">
                  <AreaChart data={trendData} margin={{ left: 10, right: 16, top: 10, bottom: 10 }}>
                    <GradientDef id="ocupacionProyectadaGradient" color={CHART_COLORS.teal} />
                    <CartesianGrid strokeDasharray="3 3" {...GRID_STYLE} />
                    <XAxis dataKey="label" {...AXIS_STYLE} tick={<WeekAxisTick />} height={36} />
                    <YAxis
                      {...AXIS_STYLE}
                      tickFormatter={(v: number) => `${v}%`}
                      domain={[0, Math.max(120, Math.ceil(Math.max(...trendData.map((d) => d.pct)) / 10) * 10 + 20)]}
                    />
                    <ChartTooltip content={<WeekTrendTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="pct"
                      stroke={CHART_COLORS.teal}
                      strokeWidth={2.5}
                      fill="url(#ocupacionProyectadaGradient)"
                      dot={(props: { cx?: number; cy?: number; payload?: WeekTrendDatum; index?: number }) => {
                        const tone = operativeBand(props.payload?.pct ?? 0).tone;
                        return (
                          <circle
                            key={`week-dot-${props.index}`}
                            cx={props.cx ?? 0}
                            cy={props.cy ?? 0}
                            r={tone === 'critical' ? 5 : 3.5}
                            fill={TONE_HEX[tone]}
                            stroke={chartSurface.card}
                            strokeWidth={1}
                          />
                        );
                      }}
                    />
                    <ReferenceLine y={85} stroke={CHART_COLORS.yellow} strokeDasharray="4 4" strokeWidth={1.5} />
                    <ReferenceLine y={100} stroke={CHART_COLORS.coral} strokeDasharray="4 4" strokeWidth={1.5} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      <div className="h-px bg-border/60" />

      <section>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <div>
            <SectionHeader tag="Detalle" title="Capacidad próximas semanas por persona" className="mb-1" />
            <p className="text-xs text-muted-foreground">
              Ocupación semanal por persona — el detalle detrás de la línea macro de arriba.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Mostrando {heatmapRows.visible.length} de {heatmapRows.all.length} personas
            </span>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
              <Switch checked={showZeroLoad} onCheckedChange={setShowZeroLoad} />
              Mostrar personas sin carga
            </label>
          </div>
        </div>
        {heatmapRows.visible.length === 0 ? (
          <EmptyState
            message={
              tableRows.length === 0
                ? 'No hay personas que coincidan con los filtros seleccionados.'
                : 'Nadie tiene carga en las próximas semanas. Activa "Mostrar personas sin carga" para verlas.'
            }
          />
        ) : (
          <Card className={CARD_CLASS}>
            <CardContent className="p-3">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-separate border-spacing-y-1">
                  <thead>
                    <tr>
                      <th className="text-left px-2 pb-1 font-semibold text-muted-foreground">Colaborador</th>
                      {heatmapWeeks.map((w) => (
                        <th
                          key={w.week_start}
                          className={cn(
                            'px-1 pb-1 font-semibold text-muted-foreground whitespace-nowrap rounded-t-md',
                            w.es_semana_actual && 'bg-primary/5 text-primary',
                          )}
                        >
                          <div>{weekRangeLabel(w.week_start)}</div>
                          {w.es_semana_actual && (
                            <div className="text-2xs font-bold ">Semana actual</div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapRows.visible.map((r) => (
                      <tr key={r.id}>
                        <td className="px-2 py-1 min-w-[160px]">
                          <PersonIdentity row={r} onClick={() => openPerson(r.id)} />
                        </td>
                        {r.weeks.map((w) => (
                          <td key={w.week_start} className={cn('px-1', w.es_semana_actual && 'bg-primary/5 rounded-md')}>
                            <HeatCell pct={w.utilizacion_pct} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <SectionHeader tag="Principal" title="Carga por colaborador" />
        {tableRows.length === 0 ? (
          <EmptyState message="No hay personas que coincidan con los filtros seleccionados." icon={Users} />
        ) : (
          <>
            <Card className={cn(CARD_CLASS, 'hidden md:block')}>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <SortableTh label="Colaborador" col="name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="left" />
                        <SortableTh label="Fragmentación" col="frag" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="left" />
                        <SortableTh label="Tareas" col="tasks" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                        <SortableTh label="Semana" col="week" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                        <SortableTh label="Capacidad" col="capacity" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                        <SortableTh label="Ocupación" col="occ" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                        <SortableTh label="Libre" col="free" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                        <SortableTh label="Backlog" col="backlog" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                        <SortableTh label="Estado" col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((r) => {
                        const snap = periodSnapshot(r, periodKey);
                        const band = operativeBand(snap.pct);
                        const semanasBacklog = Math.round((r.backlog.dias_para_vaciar / 5) * 10) / 10;
                        return (
                          <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => openPerson(r.id)}>
                            <td className="px-3 py-2.5"><PersonIdentity row={r} /></td>
                            <td className="px-3 py-2.5"><FragmentationTag count={r.projects.length} /></td>
                            <td className="px-3 py-2.5 text-center tabular-nums">{r.tareasActivas}</td>
                            <td className="px-3 py-2.5 text-center tabular-nums">{formatHours(snap.horas)}</td>
                            <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{formatHours(r.weekly_hours_capacity)}</td>
                            <td className="px-3 py-2.5 text-center font-semibold tabular-nums">{snap.pct}%</td>
                            <td className={cn('px-3 py-2.5 text-center tabular-nums font-medium', snap.holgura < 0 && 'text-destructive')}>
                              {formatSignedHours(snap.holgura)}
                            </td>
                            <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{semanasBacklog} sem</td>
                            <td className="px-3 py-2.5 text-center"><StatusPill tone={band.tone}>{band.label}</StatusPill></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="md:hidden space-y-2.5">
              {displayRows.map((r) => {
                const snap = periodSnapshot(r, periodKey);
                const band = operativeBand(snap.pct);
                const semanasBacklog = Math.round((r.backlog.dias_para_vaciar / 5) * 10) / 10;
                return (
                  <Card key={r.id} className={CARD_CLASS} onClick={() => openPerson(r.id)}>
                    <CardContent className="p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <PersonIdentity row={r} />
                        <StatusPill tone={band.tone}>{band.label}</StatusPill>
                      </div>
                      <FragmentationTag count={r.projects.length} />
                      <div className="grid grid-cols-3 gap-2 text-center text-2xs">
                        <div><p className="text-muted-foreground">Tareas</p><p className="font-semibold tabular-nums">{r.tareasActivas}</p></div>
                        <div><p className="text-muted-foreground">Semana</p><p className="font-semibold tabular-nums">{formatHours(snap.horas)}</p></div>
                        <div><p className="text-muted-foreground">Capacidad</p><p className="font-semibold tabular-nums">{formatHours(r.weekly_hours_capacity)}</p></div>
                        <div><p className="text-muted-foreground">Ocupación</p><p className="font-semibold tabular-nums">{snap.pct}%</p></div>
                        <div><p className="text-muted-foreground">Libre</p><p className={cn('font-semibold tabular-nums', snap.holgura < 0 && 'text-destructive')}>{formatSignedHours(snap.holgura)}</p></div>
                        <div><p className="text-muted-foreground">Backlog</p><p className="font-semibold tabular-nums">{semanasBacklog} sem</p></div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </section>

      <div className="h-px bg-border/60" />

      <section>
        <SectionHeader tag="Visual" title="¿Dónde está concentrado el trabajo?" />
        <p className="text-xs text-muted-foreground -mt-3 mb-4">
          Horas pendientes o comprometidas distribuidas por proyecto.
        </p>
        {projectChartData.length === 0 ? (
          <EmptyState message="No hay datos de proyectos para los filtros seleccionados." />
        ) : (
          <Card className={CARD_CLASS}>
            <CardContent className="p-4">
              <ChartContainer config={{ horas: { label: 'Horas', color: CHART_COLORS.teal } }} className="h-[300px] w-full">
                <BarChart data={projectChartData} layout="vertical" margin={{ left: 10, right: 64 }}>
                  <CartesianGrid horizontal={false} {...GRID_STYLE} />
                  <XAxis type="number" {...AXIS_STYLE} tickFormatter={(v: number) => `${v}h`} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    {...AXIS_STYLE}
                    width={130}
                    tick={{ fill: axisTick.fill, fontSize: 11 }}
                    tickFormatter={(value: string) => (value.length > 18 ? `${value.slice(0, 17)}…` : value)}
                  />
                  <ChartTooltip content={<ProjectBarTooltip />} />
                  <Bar dataKey="horas" fill={CHART_COLORS.teal} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]}>
                    <LabelList dataKey="labelText" position="right" className="fill-muted-foreground" style={{ fontSize: 11, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <SectionHeader tag="Distribución" title="Distribución de capacidad por proyecto" />
        <p className="text-xs text-muted-foreground -mt-3 mb-4">
          Horas pendientes por persona en cada proyecto. Se muestran los 8 proyectos con más carga; el resto se agrupa en "Otros".
        </p>
        {matrix.rows.length === 0 ? (
          <EmptyState message="No hay datos de proyectos para los filtros seleccionados." />
        ) : (
          <Card className={CARD_CLASS}>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Persona</th>
                      {matrix.columns.map((c) => (
                        <th key={c.id} className="text-center px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap" title={c.name}>{c.key}</th>
                      ))}
                      {matrix.hasOtros && <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Otros</th>}
                      <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.rows.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 font-medium truncate max-w-[180px]">{r.full_name}</td>
                        {r.cells.map((v, i) => (
                          <td key={matrix.columns[i].id} className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                            {v > 0 ? formatHours(v) : '—'}
                          </td>
                        ))}
                        {matrix.hasOtros && (
                          <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{r.otros > 0 ? formatHours(r.otros) : '—'}</td>
                        )}
                        <td className="px-3 py-2 text-center tabular-nums font-bold">{formatHours(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <SectionHeader tag="Equipos" title="Capacidad disponible por equipo" />
        <p className="text-xs text-muted-foreground -mt-3 mb-4">
          Horas asignadas vs. disponibles por cargo, ordenado por mayor ocupación.
        </p>
        {cargoChartData.length === 0 ? (
          <EmptyState message="No hay datos de equipos para los filtros seleccionados." />
        ) : (
          <Card className={CARD_CLASS}>
            <CardContent className="p-4">
              <ChartContainer
                config={{
                  asignadas: { label: 'Asignadas', color: CHART_COLORS.teal },
                  disponiblesBar: { label: 'Disponibles', color: chartColors.slate },
                }}
                className="w-full"
                style={{ height: Math.max(160, cargoChartData.length * 52) }}
              >
                <BarChart data={cargoChartData} layout="vertical" margin={{ left: 10, right: 16 }}>
                  <CartesianGrid horizontal={false} {...GRID_STYLE} />
                  <XAxis type="number" {...AXIS_STYLE} tickFormatter={(v: number) => `${v}h`} />
                  <YAxis
                    type="category"
                    dataKey="cargo"
                    {...AXIS_STYLE}
                    width={100}
                    tick={{ fill: axisTick.fill, fontSize: 11 }}
                    tickFormatter={(value: string) => (value.length > 14 ? `${value.slice(0, 13)}…` : value)}
                  />
                  <ChartTooltip content={<CargoBarTooltip />} />
                  <Bar dataKey="asignadas" stackId="a" fill={CHART_COLORS.teal} radius={[BAR_RADIUS, 0, 0, BAR_RADIUS]} />
                  <Bar dataKey="disponiblesBar" stackId="a" fill={chartColors.slate} fillOpacity={0.35} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <SectionHeader tag="Riesgo" title="Alertas operativas" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {attentionItems.map((item, i) => (
            <AlertCard key={i} kind={item.kind} title={item.title} description={item.description} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader tag="Secundario" title="Backlog de operación" />
        <p className="text-xs text-muted-foreground -mt-3 mb-4">
          Incluye trabajo futuro y pendiente fuera de la semana seleccionada.
        </p>
        <Card className={CARD_CLASS}>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-2xs text-muted-foreground">Horas pendientes totales</p>
                <p className="text-lg font-bold tabular-nums">{formatHours(backlogSummary.horasTotal)}</p>
              </div>
              <div>
                <p className="text-2xs text-muted-foreground">Horas vencidas</p>
                <p className="text-lg font-bold tabular-nums text-destructive">{formatHours(backlogSummary.horasVencidas)}</p>
              </div>
              <div>
                <p className="text-2xs text-muted-foreground">Horas sin fecha</p>
                <p className="text-lg font-bold tabular-nums">{formatHours(backlogSummary.horasSinFecha)}</p>
              </div>
              <div>
                <p className="text-2xs text-muted-foreground">Liberación más lejana</p>
                <p className="text-lg font-bold tabular-nums">
                  {backlogSummary.maxFecha
                    ? new Date(`${backlogSummary.maxFecha}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
                    : '—'}
                </p>
              </div>
            </div>

            {backlogChartData.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-0.5">Backlog por colaborador</h4>
                <p className="text-2xs text-muted-foreground mb-2">
                  Trabajo pendiente total y semanas estimadas para vaciar el backlog.
                </p>
                <ChartContainer config={{ horas: { label: 'Backlog', color: CHART_COLORS.teal } }} className="h-[280px] w-full">
                  <BarChart data={backlogChartData} layout="vertical" margin={{ left: 10, right: 64 }}>
                    <CartesianGrid horizontal={false} {...GRID_STYLE} />
                    <XAxis type="number" {...AXIS_STYLE} tickFormatter={(v: number) => `${v}h`} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      {...AXIS_STYLE}
                      width={100}
                      tick={{ fill: axisTick.fill, fontSize: 11 }}
                      tickFormatter={(value: string) => (value.length > 14 ? `${value.slice(0, 13)}…` : value)}
                    />
                    <ChartTooltip content={<BacklogBarTooltip />} />
                    <Bar dataKey="horas" fill={CHART_COLORS.teal} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]}>
                      <LabelList dataKey="labelText" position="right" className="fill-muted-foreground" style={{ fontSize: 11, fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-2 py-2 font-semibold text-muted-foreground">Persona</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground">Backlog</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground">Semanas</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground">Fecha estimada</th>
                  </tr>
                </thead>
                <tbody>
                  {backlogSummary.top.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-2 py-1.5 font-medium">{r.full_name}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{formatHours(r.backlog.horas_total)}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{Math.round((r.backlog.dias_para_vaciar / 5) * 10) / 10} sem</td>
                      <td className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">
                        {r.backlog.fecha_backlog_vacio
                          ? new Date(`${r.backlog.fecha_backlog_vacio}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  {backlogSummary.top.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">Sin backlog pendiente.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="sm:max-w-[520px] sm:ml-auto sm:mr-4 w-full h-[90vh] flex flex-col p-0 border-l shadow-floating">
          <DialogHeader className="px-4 pt-4 pb-2 border-b">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={selectedRow?.avatar_url || ''} />
                <AvatarFallback className="text-xs">{initials(selectedRow?.full_name ?? null)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <DialogTitle className="text-base truncate">{selectedRow?.full_name || 'Persona'}</DialogTitle>
                <DialogDescription className="text-xs">{selectedRow?.cargo || 'Sin cargo'}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto px-4 py-3 space-y-5">
            {selectedRow && selectedSnapshot && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-border p-2.5 text-center">
                    <p className="text-2xs text-muted-foreground">Capacidad</p>
                    <p className="text-sm font-bold tabular-nums">{formatHours(selectedRow.weekly_hours_capacity)}</p>
                  </div>
                  <div className="rounded-xl border border-border p-2.5 text-center">
                    <p className="text-2xs text-muted-foreground">Comprometidas</p>
                    <p className="text-sm font-bold tabular-nums">{formatHours(selectedSnapshot.horas)}</p>
                  </div>
                  <div className="rounded-xl border border-border p-2.5 text-center">
                    <p className="text-2xs text-muted-foreground">Disponibles</p>
                    <p className={cn('text-sm font-bold tabular-nums', selectedSnapshot.holgura < 0 && 'text-destructive')}>
                      {formatSignedHours(selectedSnapshot.holgura)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-2.5 text-center">
                    <p className="text-2xs text-muted-foreground">Ocupación</p>
                    <p className="text-sm font-bold tabular-nums">{selectedSnapshot.pct}%</p>
                  </div>
                  <div className="rounded-xl border border-border p-2.5 text-center">
                    <p className="text-2xs text-muted-foreground">Backlog</p>
                    <p className="text-sm font-bold tabular-nums">{Math.round((selectedRow.backlog.dias_para_vaciar / 5) * 10) / 10} sem</p>
                  </div>
                  <div className="rounded-xl border border-border p-2.5 text-center">
                    <p className="text-2xs text-muted-foreground">Vencidas</p>
                    <p className="text-sm font-bold tabular-nums text-destructive">
                      {loadingUserMini ? '…' : userMini?.summary.overdue_tasks ?? '—'}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">Proyectos</h4>
                  <div className="space-y-2.5">
                    {selectedRow.projects.map((p) => (
                      <div key={p.project_id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium truncate">{p.project_name}</span>
                          <span className="text-muted-foreground shrink-0 ml-2">{formatHours(p.horas_pendientes)} · {p.tareas_pendientes} tareas</span>
                        </div>
                        <Progress value={selectedProjectsTotal > 0 ? (p.horas_pendientes / selectedProjectsTotal) * 100 : 0} className="h-1.5" />
                      </div>
                    ))}
                    {selectedRow.projects.length === 0 && (
                      <p className="text-xs text-muted-foreground">Sin proyectos activos en el alcance seleccionado.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">Tareas activas</h4>
                  {loadingUserMini ? (
                    <div className="h-[120px] rounded-xl bg-muted/40 animate-pulse" />
                  ) : (
                    <div className="space-y-1.5">
                      {sortedTasks.map((t) => {
                        const isOverdue = !!t.due_date && t.due_date < today;
                        return (
                          <div key={t.id} className={cn('flex items-center justify-between gap-2 text-xs py-1.5 border-b border-border/50 last:border-0', isOverdue && 'text-destructive')}>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{t.title}</p>
                              <p className={cn('truncate', !isOverdue && 'text-muted-foreground')}>
                                {t.project.name} · {t.status_name}
                                {t.due_date ? ` · ${isOverdue ? 'venció' : 'vence'} ${new Date(`${t.due_date}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}` : ' · sin fecha'}
                              </p>
                            </div>
                            <span className="shrink-0 font-medium" style={{ color: CHART_COLORS.teal }}>
                              {t.horas_estimadas != null ? formatHours(t.horas_estimadas) : 'Sin estimar'}
                            </span>
                          </div>
                        );
                      })}
                      {sortedTasks.length === 0 && <p className="text-xs text-muted-foreground">No hay tareas activas.</p>}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">Capacidad futura</h4>
                  <div className="space-y-2">
                    {[{ label: 'Esta semana', pct: selectedRow.current.utilizacion_pct }, ...selectedRow.weeks.flatMap((w, i) => (
                      w.es_semana_actual ? [] : [{ label: forecastWeekLabel(w, i), pct: w.utilizacion_pct }]
                    ))].map((w) => {
                      const band = operativeBand(w.pct);
                      return (
                        <div key={w.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{w.label}</span>
                            <span className="font-semibold tabular-nums">{w.pct}%</span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(100, Math.max(4, w.pct))}%`, backgroundColor: TONE_HEX[band.tone] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
