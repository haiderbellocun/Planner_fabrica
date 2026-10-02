// Cumplimiento de fábrica, leído de micro a macro: la misma barra significa
// "trabajo pendiente contra una semana" en la persona, en el proyecto y en
// toda la fábrica.
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CHART_COLORS, formatHours } from '@/components/reports/ReportCharts';
import { chartColors } from '@/components/charts/chartTheme';
import { SectionHeader, LoadingState, EmptyState } from '@/components/shared/StoryUI';
import { cn } from '@/lib/utils';
import {
  useReportProjectUtilization,
  useReportProjectUtilizationDetail,
  useReportProductionCapacity,
  useReportPeopleWorkload,
  type RiskLevel,
} from '@/hooks/useReports';

const CARD_CLASS = 'rounded-2xl border border-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)]';

const RISK_BADGE_CLASSES: Record<RiskLevel, string> = {
  available: 'bg-sky-50 text-sky-700 border-sky-200',
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  over: 'bg-red-50 text-red-700 border-red-200',
  unknown: 'bg-slate-50 text-slate-600 border-slate-200',
};

const LOAD_COPY: Record<RiskLevel, string> = {
  available: 'Tiene espacio',
  ok: 'Cabe esta semana',
  warning: 'Casi llena',
  over: 'No cabe en la semana',
  unknown: 'Sin dato',
};

function riskColorHex(color: string): string {
  switch (color) {
    case 'red':
      return CHART_COLORS.coral;
    case 'amber':
      return CHART_COLORS.yellow;
    case 'sky':
      return chartColors.info;
    case 'emerald':
      return CHART_COLORS.green;
    default:
      return chartColors.slate;
  }
}

function levelColor(level: RiskLevel): string {
  switch (level) {
    case 'over':
      return 'red';
    case 'warning':
      return 'amber';
    case 'available':
      return 'sky';
    case 'ok':
      return 'emerald';
    default:
      return 'slate';
  }
}

function bandFor(pct: number): RiskLevel {
  if (pct >= 100) return 'over';
  if (pct >= 90) return 'warning';
  if (pct < 50) return 'available';
  return 'ok';
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function formatLoad(hours: number): string {
  if (hours <= 0) return '0h';
  return formatHours(hours);
}

function initials(name: string | null): string {
  return (name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U';
}

function LoadMeter({
  pct,
  pendingHours,
  weekHours,
  level,
}: {
  pct: number | null;
  pendingHours: number;
  weekHours: number;
  level: RiskLevel;
}) {
  const known = pct != null && weekHours > 0;
  const fill = known ? Math.min(pct, 100) : 0;
  const overflow = known && pendingHours > weekHours ? pendingHours - weekHours : 0;
  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          {known
            ? `${formatLoad(pendingHours)} de trabajo · la semana da ${formatLoad(weekHours)}`
            : 'Sin semana de referencia'}
        </span>
        <span className="font-semibold tabular-nums shrink-0">{known ? `${pct}%` : '—'}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden" aria-hidden>
        <div
          className="h-full rounded-full"
          style={{ width: `${fill}%`, backgroundColor: riskColorHex(levelColor(level)) }}
        />
      </div>
      <p className="text-[11px] font-medium">
        {known ? LOAD_COPY[level] : 'No hay horas de equipo para comparar'}
        {overflow > 0 ? ` · sobran ${formatLoad(overflow)} para otra semana` : ''}
      </p>
    </div>
  );
}

function AvatarStack({ people, max = 5 }: { people: { id: string; full_name: string; avatar_url: string | null }[]; max?: number }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map(p => (
        <Avatar key={p.id} className="h-6 w-6 border-2 border-card shrink-0" title={p.full_name}>
          <AvatarImage src={p.avatar_url || ''} />
          <AvatarFallback className="text-[9px]">{initials(p.full_name)}</AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <span className="h-6 min-w-6 px-1 rounded-full border-2 border-card bg-muted text-[9px] font-semibold flex items-center justify-center text-muted-foreground">
          +{extra}
        </span>
      )}
    </div>
  );
}

export function CapacidadFabricaTab() {
  const { data, isLoading } = useReportProjectUtilization();
  const { data: production, isLoading: loadingProduction } = useReportProductionCapacity();
  const { data: workload, isLoading: loadingWorkload } = useReportPeopleWorkload();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: detail, isLoading: loadingDetail } = useReportProjectUtilizationDetail(selectedProjectId);
  const [search, setSearch] = useState('');

  const openProject = (id?: string | null) => {
    if (!id) return;
    setSelectedProjectId(id);
    setDrawerOpen(true);
  };

  const teamByProject = useMemo(() => {
    const map = new Map<string, { id: string; full_name: string; avatar_url: string | null; horas_pendientes: number }[]>();
    for (const person of workload?.people ?? []) {
      for (const proj of person.projects) {
        const list = map.get(proj.project_id) ?? [];
        list.push({ id: person.id, full_name: person.full_name, avatar_url: person.avatar_url, horas_pendientes: proj.horas_pendientes });
        map.set(proj.project_id, list);
      }
    }
    for (const list of map.values()) list.sort((a, b) => b.horas_pendientes - a.horas_pendientes);
    return map;
  }, [workload]);

  const filteredPeople = useMemo(() => {
    const people = workload?.people ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      p =>
        p.full_name.toLowerCase().includes(q) ||
        (p.cargo ?? '').toLowerCase().includes(q) ||
        p.projects.some(pr => pr.project_name.toLowerCase().includes(q)),
    );
  }, [workload, search]);

  const filteredProjects = useMemo(() => {
    const projects = (data?.projects ?? []).filter(p => p.status === 'active');
    const q = search.trim().toLowerCase();
    return projects
      .filter(p => {
        if (!q) return true;
        if (p.name.toLowerCase().includes(q)) return true;
        return (teamByProject.get(p.id) ?? []).some(m => m.full_name.toLowerCase().includes(q));
      })
      .sort((a, b) => (b.utilization_pct ?? -1) - (a.utilization_pct ?? -1));
  }, [data, search, teamByProject]);

  if (isLoading || loadingProduction || loadingWorkload) {
    return <LoadingState label="Cargando cumplimiento de fábrica..." />;
  }

  if (!data) {
    return <EmptyState message="No se pudo cargar la información de capacidad." />;
  }

  const { summary } = data;
  const direct = production?.direct;
  const indirect = production?.indirect;
  const factoryLevel = bandFor(summary.utilizacion_pct_fabrica);
  const busyPeople = filteredPeople.filter(p => p.projects.length > 0);
  const freePeople = filteredPeople.filter(p => p.projects.length === 0);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-card px-4 py-4 space-y-3">
        <p className="text-sm font-semibold">Cumplimiento de la fábrica, de lo chico a lo grande</p>
        <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
          La barra es siempre la misma idea. Lo pintado es trabajo que todavía no se entrega. La barra completa es una semana:
          de esa persona, del equipo de ese proyecto, o de toda la fábrica.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {(['available', 'ok', 'warning', 'over'] as RiskLevel[]).map(level => (
            <span key={level} className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5', RISK_BADGE_CLASSES[level])}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: riskColorHex(levelColor(level)) }} />
              {LOAD_COPY[level]}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-semibold text-muted-foreground">
          <button type="button" onClick={() => scrollToSection('cumplimiento-persona')} className="rounded-md bg-muted px-2 py-1 text-foreground">1 · Persona</button>
          <span aria-hidden>→</span>
          <button type="button" onClick={() => scrollToSection('cumplimiento-proyecto')} className="rounded-md bg-muted px-2 py-1 text-foreground">2 · Proyecto</button>
          <span aria-hidden>→</span>
          <button type="button" onClick={() => scrollToSection('cumplimiento-fabrica')} className="rounded-md bg-muted px-2 py-1 text-foreground">3 · Fábrica</button>
        </div>
      </div>

      <div className="relative w-full sm:w-80">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar persona, cargo o proyecto..."
          className="pl-8 h-9 text-xs"
        />
      </div>

      <section id="cumplimiento-persona" className="scroll-mt-4">
        <SectionHeader tag="1 · Micro" title="Cada persona y su semana" />
        <p className="text-xs text-muted-foreground -mt-3 mb-4">
          Horas que esa persona todavía debe entregar, contra las horas que puede trabajar esta semana. Un chip abre el proyecto.
        </p>
        {busyPeople.length === 0 && freePeople.length === 0 && (
          <EmptyState message="No hay personas que coincidan con la búsqueda." />
        )}
        <div className="space-y-2">
          {busyPeople.map(p => (
            <Card key={p.id} className={CARD_CLASS}>
              <CardContent className="py-3 px-4 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-3 items-center">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={p.avatar_url || ''} />
                    <AvatarFallback className="text-xs">{initials(p.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.cargo || 'Sin cargo'}</p>
                  </div>
                </div>
                <div className="space-y-2 min-w-0">
                  <LoadMeter
                    pct={p.utilization_pct}
                    pendingHours={p.horas_pendientes_total}
                    weekHours={p.weekly_hours_capacity}
                    level={p.risk_level}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {p.projects.map(proj => (
                      <button
                        key={proj.project_id}
                        type="button"
                        onClick={() => openProject(proj.project_id)}
                        className="text-[11px] px-2 py-1 rounded-full border border-border bg-background hover:bg-primary/10 hover:border-primary/40 transition-colors text-left"
                        title={`${proj.tareas_pendientes} tareas pendientes`}
                      >
                        <span className="font-medium">{proj.project_name}</span>
                        <span className="text-muted-foreground"> · {formatLoad(proj.horas_pendientes)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {freePeople.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            <span className="font-medium text-foreground">Con la semana libre: </span>
            {freePeople.map(p => p.full_name).join(', ')}.
          </p>
        )}
      </section>

      <section id="cumplimiento-proyecto" className="scroll-mt-4">
        <SectionHeader tag="2 · Proyecto" title="Esas personas, juntas en cada proyecto" />
        <p className="text-xs text-muted-foreground -mt-3 mb-4">
          Horas pendientes del proyecto contra la semana de todo su equipo. Clic en la fila para ver quién y qué tareas.
        </p>
        {filteredProjects.length === 0 ? (
          <EmptyState message="No hay proyectos que coincidan con la búsqueda." />
        ) : (
          <div className="space-y-2">
            {filteredProjects.map(p => (
              <button key={p.id} type="button" onClick={() => openProject(p.id)} className="w-full text-left">
                <Card className={`${CARD_CLASS} hover:border-primary/40`}>
                  <CardContent className="py-3 px-4 grid grid-cols-1 lg:grid-cols-[220px_1fr_auto] gap-3 items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.n_personas} {p.n_personas === 1 ? 'persona' : 'personas'}</p>
                    </div>
                    <LoadMeter
                      pct={p.utilization_pct}
                      pendingHours={p.horas_pendientes}
                      weekHours={p.capacidad_semanal}
                      level={p.risk_level}
                    />
                    <AvatarStack people={teamByProject.get(p.id) ?? []} />
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </section>

      <section id="cumplimiento-fabrica" className="scroll-mt-4">
        <SectionHeader tag="3 · Macro" title="Todos los proyectos son la fábrica" />
        <p className="text-xs text-muted-foreground -mt-3 mb-4">
          La misma cuenta, sumada. {summary.personas_con_pendientes} de {summary.n_personas_fabrica} personas tienen trabajo pendiente
          y ese grupo está al {summary.utilizacion_pct_equipo_ocupado}% de su semana.
        </p>
        <Card className={CARD_CLASS}>
          <CardContent className="py-4 px-4 space-y-4">
            <LoadMeter
              pct={summary.utilizacion_pct_fabrica}
              pendingHours={summary.horas_pendientes_fabrica}
              weekHours={summary.capacidad_semanal_fabrica}
              level={factoryLevel}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Quién fabrica</p>
                  <span className="text-xs text-muted-foreground">{direct?.pct_of_total ?? 0}% de la semana</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${direct?.pct_of_total ?? 0}%`, backgroundColor: CHART_COLORS.teal }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatLoad(direct?.capacidad_semanal ?? 0)} por semana · {direct?.n_personas ?? 0} personas de diseño, video y realización.
                </p>
                {direct && direct.by_cargo.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {direct.by_cargo.map(c => (
                      <Badge key={c.cargo} variant="outline" className="text-[11px]">
                        {c.cargo} · {c.n_personas}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Quién apoya</p>
                  <span className="text-xs text-muted-foreground">{indirect?.pct_of_total ?? 0}% de la semana</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${indirect?.pct_of_total ?? 0}%`, backgroundColor: chartColors.slate }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatLoad(indirect?.capacidad_semanal ?? 0)} por semana · {indirect?.n_personas ?? 0} personas de soporte, coordinación y otros cargos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="sm:max-w-[520px] sm:ml-auto sm:mr-4 w-full h-[90vh] flex flex-col p-0 border-l shadow-xl">
          <DialogHeader className="px-4 pt-4 pb-2 border-b">
            <DialogTitle className="text-base">{detail?.project.name || 'Detalle de proyecto'}</DialogTitle>
            <DialogDescription className="text-xs">La semana del equipo y las tareas que la ocupan.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto px-4 py-3 space-y-5">
            {loadingDetail && <LoadingState label="Cargando detalle del proyecto..." />}

            {!loadingDetail && detail && (
              <>
                <LoadMeter
                  pct={detail.summary.utilization_pct}
                  pendingHours={detail.summary.horas_pendientes}
                  weekHours={detail.summary.capacidad_semanal}
                  level={detail.summary.risk_level}
                />

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Personas de este proyecto</h4>
                  <div className="space-y-3">
                    {detail.team.map(m => (
                      <div key={m.id} className="p-2 rounded-lg border border-border/60 space-y-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={m.avatar_url || ''} />
                            <AvatarFallback className="text-xs">{initials(m.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{m.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{m.cargo || 'Sin cargo'}</p>
                          </div>
                        </div>
                        <LoadMeter
                          pct={m.utilization_pct}
                          pendingHours={m.horas_pendientes}
                          weekHours={m.weekly_hours_capacity}
                          level={m.risk_level}
                        />
                      </div>
                    ))}
                    {detail.team.length === 0 && (
                      <p className="text-xs text-muted-foreground">Sin personas con trabajo asignado en este proyecto.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tareas que arman esas horas</h4>
                  <div className="space-y-1.5">
                    {detail.tasks.map(t => (
                      <div key={t.id} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-border/50 last:border-0">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{t.title}</p>
                          <p className="text-muted-foreground truncate">
                            {t.assignee_name || 'Sin asignar'} · {t.status_name}
                            {t.due_date
                              ? ` · vence ${new Date(`${t.due_date}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`
                              : ''}
                          </p>
                        </div>
                        <span className="shrink-0 font-medium" style={{ color: CHART_COLORS.teal }}>
                          {t.horas_estimadas != null ? formatLoad(t.horas_estimadas) : '—'}
                        </span>
                      </div>
                    ))}
                    {detail.tasks.length === 0 && <p className="text-xs text-muted-foreground">No hay tareas pendientes.</p>}
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
