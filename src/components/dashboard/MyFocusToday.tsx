import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMyTasks, useLeadersFocus, useTask, type LeadersFocusTask, type MyTaskWithProject } from '@/hooks/useTasks';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/shared/StoryUI';
import { Loader2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { format, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getBusinessTodayStr, getDueBucket } from '@/lib/dueDate';

type MyTask = MyTaskWithProject;

function parseDue(due: unknown): Date | null {
  if (due == null || typeof due !== 'string') return null;
  try {
    const datePart = due.slice(0, 10);
    const d = new Date(`${datePart}T12:00:00`);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

type FocusTab = 'mine' | 'team';

type PersonLoad = {
  key: string;
  name: string;
  email?: string | null;
  cargo?: string | null;
  projects: string[];
  pending: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  tasks: LeadersFocusTask[];
};

export function MyFocusToday() {
  const { isAdmin, isProjectLeader } = useAuth();

  // "Hoy" según la zona horaria de negocio (America/Bogota), no la del navegador —
  // recalculado en cada render para no quedar obsoleto si la app sigue abierta pasada la medianoche.
  const todayStr = getBusinessTodayStr();
  const todayLocal = useMemo(() => {
    const [y, m, d] = todayStr.split('-').map((n) => parseInt(n, 10));
    return new Date(y, m - 1, d);
  }, [todayStr]);
  const endOfWeekStr = useMemo(() => format(endOfWeek(todayLocal, { weekStartsOn: 1 }), 'yyyy-MM-dd'), [todayLocal]);

  const [focusTab, setFocusTab] = useState<FocusTab>('mine');
  const [showAllRanking, setShowAllRanking] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string>('');
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);

  const { data: selectedTask } = useTask(selectedTaskId ?? undefined);

  const openTask = (id: string, projectKey: string) => {
    setSelectedTaskId(id);
    setSelectedProjectKey(projectKey);
  };

  const { tasks, data: myTasksData, isLoading, isError, error } = useMyTasks();

  const showTeamTab = !!isAdmin || !!isProjectLeader;
  const {
    data: teamTasks = [],
    isLoading: teamLoading,
    error: teamError,
  } = useLeadersFocus(showTeamTab);

  const teamList: LeadersFocusTask[] = Array.isArray(teamTasks)
    ? teamTasks.filter((t): t is LeadersFocusTask => t != null && typeof t === 'object')
    : [];

  const pending = tasks.filter((t) => !t.status?.is_completed);

  const pendingForCards = showTeamTab && !teamLoading ? teamList : pending;
  const vencenHoy = pendingForCards.filter((t) => {
    const due = 'due_date' in t ? t.due_date : null;
    if (!due || typeof due !== 'string') return false;
    return getDueBucket(due, false, todayStr) === 'due_today';
  });
  const vencidas = pendingForCards.filter((t) => {
    const due = 'due_date' in t ? t.due_date : null;
    if (!due || typeof due !== 'string') return false;
    return getDueBucket(due, false, todayStr) === 'overdue';
  });
  const enCurso = pendingForCards;
  const estaSemana = pendingForCards.filter((t) => {
    const due = 'due_date' in t ? t.due_date : null;
    if (!due || typeof due !== 'string') return false;
    const dStr = due.slice(0, 10);
    return dStr >= todayStr && dStr <= endOfWeekStr;
  });

  const priorityList: MyTask[] = [
    ...vencidas,
    ...vencenHoy.filter((t) => !vencidas.some((v) => v.id === t.id)),
    ...pending
      .filter((t) => !vencidas.some((v) => v.id === t.id) && !vencenHoy.some((v) => v.id === t.id))
      .sort((a, b) => {
        const da = parseDue(a.due_date)?.getTime() ?? Infinity;
        const db = parseDue(b.due_date)?.getTime() ?? Infinity;
        return da - db;
      }),
  ].slice(0, 5);

  const hasOverdue = vencidas.length > 0;

  if (isLoading && focusTab === 'mine') {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">👋 Tu foco hoy</h2>
        {showTeamTab && (
          <div className="flex rounded-lg border border-black/5 p-0.5 bg-black/5 w-fit">
            <button
              type="button"
              onClick={() => setFocusTab('mine')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                focusTab === 'mine' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Mi foco
            </button>
            <button
              type="button"
              onClick={() => setFocusTab('team')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                focusTab === 'team' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Foco del equipo
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[88px] rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  if (isError && focusTab === 'mine') {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">👋 Tu foco hoy</h2>
        {showTeamTab && (
          <div className="flex rounded-lg border border-black/5 p-0.5 bg-black/5 w-fit">
            <button
              type="button"
              onClick={() => setFocusTab('mine')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                focusTab === 'mine' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Mi foco
            </button>
            <button
              type="button"
              onClick={() => setFocusTab('team')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                focusTab === 'team' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Foco del equipo
            </button>
          </div>
        )}
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error al cargar tu foco</AlertTitle>
          <AlertDescription>
            No se pudieron cargar tus tareas. {error instanceof Error ? error.message : 'Intenta de nuevo más tarde.'}
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  if (focusTab === 'team') {
    const rawTeam = teamTasks ?? [];
    const teamList: LeadersFocusTask[] = Array.isArray(rawTeam)
      ? rawTeam.filter((t): t is LeadersFocusTask => t != null && typeof t === 'object')
      : [];

    const validTasks = teamList.filter((t) => t && typeof t === 'object');
    const personMap = new Map<string, PersonLoad>();

    validTasks.forEach((task) => {
      const key = task.assignee?.email ?? 'unknown';
      const name =
        key === 'unknown'
          ? 'Sin asignado'
          : task.assignee?.full_name ?? task.assignee?.email ?? 'Sin asignado';
      const existing = personMap.get(key);
      const notCompleted = task.status?.is_completed === false;
      const dStr = typeof task.due_date === 'string' ? task.due_date.slice(0, 10) : null;
      const dueBucket = getDueBucket(task.due_date, task.status?.is_completed ?? false, todayStr);
      const overdue = dueBucket === 'overdue';
      const dueToday = dueBucket === 'due_today';
      const dueThisWeek = dStr !== null && dStr >= todayStr && dStr <= endOfWeekStr;

      const projectLabel =
        task.project?.key && task.project?.name
          ? `${task.project.key} · ${task.project.name}`
          : task.project?.name ?? task.project?.key ?? null;

      if (existing) {
        if (notCompleted) existing.pending += 1;
        if (overdue) existing.overdue += 1;
        if (dueToday) existing.dueToday += 1;
        if (dueThisWeek) existing.dueThisWeek += 1;
        if (projectLabel && !existing.projects.includes(projectLabel)) {
          existing.projects.push(projectLabel);
        }
        if (notCompleted) existing.tasks.push(task);
      } else {
        personMap.set(key, {
          key,
          name,
          email: task.assignee?.email ?? null,
          cargo: task.assignee?.cargo ?? null,
          projects: projectLabel ? [projectLabel] : [],
          pending: notCompleted ? 1 : 0,
          overdue: overdue ? 1 : 0,
          dueToday: dueToday ? 1 : 0,
          dueThisWeek: dueThisWeek ? 1 : 0,
          tasks: notCompleted ? [task] : [],
        });
      }
    });

    const ranking = Array.from(personMap.values()).sort((a, b) => {
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      if (b.pending !== a.pending) return b.pending - a.pending;
      return b.dueToday - a.dueToday;
    });
    const rankingVisible = showAllRanking ? ranking : ranking.slice(0, 6);
    const hasMoreRanking = ranking.length > 6;
    const maxPending = ranking.length > 0 ? Math.max(...ranking.map((p) => p.pending), 1) : 1;

    const getRiskBadge = (person: PersonLoad) => {
      if (person.overdue > 0)
        return { label: 'RIESGO ALTO', className: 'bg-red-50 text-red-700 border-red-200' };
      if (person.dueToday > 0) return { label: 'HOY', className: 'bg-amber-50 text-amber-700 border-amber-200' };
      if (person.pending >= 5) return { label: 'CARGA MEDIA', className: 'bg-slate-50 text-slate-700 border-slate-200' };
      return { label: 'OK', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    };

    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">👋 Tu foco hoy</h2>
        <div className="flex rounded-lg border border-black/5 p-0.5 bg-black/5 w-fit">
          <button
            type="button"
            onClick={() => setFocusTab('mine')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              focusTab === 'mine' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Mi foco
          </button>
          <button
            type="button"
            onClick={() => setFocusTab('team')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              focusTab === 'team' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Foco del equipo
          </button>
        </div>
        {teamLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : teamError ? (
          <p className="text-sm text-muted-foreground">No se pudo cargar el foco del equipo.</p>
        ) : teamList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin tareas del equipo por vencer.</p>
        ) : (
          <>
            {showTeamTab && (
              <Card className="rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                <CardContent className="p-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-3">
                    CARGA POR PERSONA
                  </p>
                  {ranking.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin tareas del equipo por vencer.</p>
                  ) : (
                    <>
                      <ul className="space-y-3">
                        {rankingVisible.map((person) => {
                          const barWidth = maxPending > 0 ? Math.min(100, (person.pending / maxPending) * 100) : 0;
                          const risk = getRiskBadge(person);
                          const isExpanded = expandedPerson === person.key;
                          return (
                            <li key={person.key} className="flex flex-col rounded-lg border border-transparent hover:bg-black/[0.02]">
                              <button
                                type="button"
                                onClick={() => setExpandedPerson(isExpanded ? null : person.key)}
                                className="w-full text-left flex flex-col gap-1.5 py-2 px-3 cursor-pointer"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    {isExpanded
                                      ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    }
                                    <div className="min-w-0">
                                      <p className="font-semibold text-sm text-foreground truncate">{person.name}</p>
                                      {person.cargo && (
                                        <p className="text-[12px] text-muted-foreground truncate">{person.cargo}</p>
                                      )}
                                      {person.projects.length > 0 && (
                                        <p className="text-[11px] text-muted-foreground/70 truncate">
                                          {person.projects.length === 1
                                            ? person.projects[0]
                                            : `${person.projects[0]} +${person.projects.length - 1} proyectos`}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium', risk.className)}>
                                      {risk.label}
                                    </span>
                                    <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-[12px] font-medium border', person.overdue > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-black/5 text-muted-foreground border-black/10')}>
                                      Vencidas {person.overdue}
                                    </span>
                                    <span className="inline-flex items-center rounded-md px-2 py-1 text-[12px] font-medium bg-black/5 text-muted-foreground border border-black/10">
                                      Hoy {person.dueToday}
                                    </span>
                                    <span className="inline-flex items-center rounded-md px-2 py-1 text-[12px] font-medium bg-black/5 text-muted-foreground border border-black/10">
                                      Semana {person.dueThisWeek}
                                    </span>
                                    <span className="inline-flex items-center rounded-md px-2 py-1 text-[12px] font-medium bg-black/5 text-muted-foreground border border-black/10">
                                      Pend. {person.pending}
                                    </span>
                                  </div>
                                </div>
                                <div className="h-2 w-full rounded-xl border border-black/5 bg-black/5 overflow-hidden">
                                  <div
                                    className={cn('h-full rounded-xl transition-all', person.overdue > 0 ? 'bg-red-500/40' : 'bg-primary/60')}
                                    style={{ width: `${barWidth}%` }}
                                  />
                                </div>
                              </button>

                              {isExpanded && person.tasks.length > 0 && (
                                <ul className="mx-3 mb-2 border-l-2 border-slate-100 pl-3 space-y-0.5">
                                  {person.tasks
                                    .sort((a, b) => {
                                      const da = parseDue(a.due_date)?.getTime() ?? Infinity;
                                      const db = parseDue(b.due_date)?.getTime() ?? Infinity;
                                      return da - db;
                                    })
                                    .map((task) => {
                                      const due = parseDue(task.due_date);
                                      const isOverdue = getDueBucket(task.due_date, task.status?.is_completed ?? false, todayStr) === 'overdue';
                                      return (
                                        <li key={task.id}>
                                          <button
                                            type="button"
                                            onClick={() => openTask(task.id, task.project?.key ?? '')}
                                            className="w-full text-left flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-primary/10 transition-colors group"
                                          >
                                            <span className="flex-1 text-sm text-foreground truncate group-hover:text-primary-deep">{task.title}</span>
                                            <span className="text-[11px] text-muted-foreground/70 shrink-0">
                                              {task.project?.key ?? ''}
                                            </span>
                                            {due && (
                                              <span className={cn('text-[11px] shrink-0', isOverdue ? 'text-red-600 font-semibold' : 'text-muted-foreground')}>
                                                {format(due, 'd MMM', { locale: es })}
                                              </span>
                                            )}
                                            <span
                                              className="text-[10px] px-1.5 py-0.5 rounded-md border shrink-0"
                                              style={{ backgroundColor: `${task.status.color}20`, color: task.status.color, borderColor: `${task.status.color}40` }}
                                            >
                                              {task.status.name}
                                            </span>
                                          </button>
                                        </li>
                                      );
                                    })}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      {hasMoreRanking && (
                        <button
                          type="button"
                          onClick={() => setShowAllRanking((v) => !v)}
                          className="mt-2 text-xs font-medium text-primary hover:underline"
                        >
                          {showAllRanking ? 'Ver menos' : 'Ver todas'}
                        </button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
              <CardContent className="p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-3">Foco del equipo</p>
                <ul className="space-y-2">
                  {teamList.slice(0, 5).map((task: LeadersFocusTask) => {
                    const parsed = parseDue(task.due_date);
                    const dueFormatted = parsed ? format(parsed, 'd MMM yyyy', { locale: es }) : '—';
                    const isOverdue = getDueBucket(task.due_date, task.status?.is_completed ?? false, todayStr) === 'overdue';
                    return (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => openTask(task.id, task.project?.key ?? '')}
                          className="w-full text-left flex flex-wrap items-center gap-2 py-2 px-3 rounded-lg hover:bg-primary/5 transition-colors group"
                        >
                          <span className="font-medium text-sm text-foreground flex-1 min-w-0 truncate group-hover:text-primary-deep">{task.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {task.assignee?.full_name ?? task.assignee?.email ?? '—'}
                            {task.assignee?.cargo ? ` · ${task.assignee.cargo}` : ''}
                          </span>
                          <span className="text-xs text-muted-foreground">{task.project?.name ?? task.project?.key ?? '—'}</span>
                          <span className={cn('text-xs', isOverdue && 'text-red-600 font-medium')}>{dueFormatted}</span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-medium rounded-md"
                            style={{
                              backgroundColor: task.status?.color ? `${task.status.color}20` : undefined,
                              color: task.status?.color,
                            }}
                          >
                            {task.status?.name ?? '—'}
                          </Badge>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>

          <TaskDetailSheet
            task={selectedTask ?? null}
            projectKey={selectedProjectKey}
            open={!!selectedTaskId}
            onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }}
          />
          </>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">👋 Tu foco hoy</h2>
      {showTeamTab && (
        <div className="flex rounded-lg border border-black/5 p-0.5 bg-black/5 w-fit">
          <button
            type="button"
            onClick={() => setFocusTab('mine')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              focusTab === 'mine' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Mi foco
          </button>
          <button
            type="button"
            onClick={() => setFocusTab('team')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              focusTab === 'team' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Foco del equipo
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Vencen hoy" value={vencenHoy.length} />
        <StatTile
          label="Vencidas"
          value={vencidas.length}
          pill={hasOverdue ? { tone: 'critical', label: 'Atención' } : { tone: 'good', label: 'Al día' }}
        />
        <StatTile label="En curso" value={enCurso.length} />
        <StatTile label="Esta semana" value={estaSemana.length} />
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tienes tareas asignadas.</p>
      ) : priorityList.length > 0 ? (
        <Card className="rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-3">Tareas prioritarias</p>
            <ul className="space-y-2">
              {priorityList.map((task) => {
                const parsed = parseDue(task.due_date ?? null);
                const dueFormatted = parsed ? format(parsed, 'd MMM yyyy', { locale: es }) : '—';
                const isOverdue = getDueBucket(task.due_date, task.status?.is_completed ?? false, todayStr) === 'overdue';
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => openTask(task.id, task.project?.key ?? '')}
                      className="w-full text-left flex flex-wrap items-center gap-2 py-2 px-3 rounded-lg hover:bg-primary/5 transition-colors group"
                    >
                      <span className="font-medium text-sm text-foreground flex-1 min-w-0 truncate group-hover:text-primary-deep">{task.title}</span>
                      <span className="text-xs text-muted-foreground">{task.project?.name ?? task.project?.key ?? '—'}</span>
                      <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {dueFormatted}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-medium rounded-md"
                        style={{
                          backgroundColor: task.status?.color ? `${task.status.color}20` : undefined,
                          color: task.status?.color,
                        }}
                      >
                        {task.status?.name ?? '—'}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <TaskDetailSheet
        task={selectedTask ?? null}
        projectKey={selectedProjectKey}
        open={!!selectedTaskId}
        onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }}
      />
    </section>
  );
}
