import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMyTasks, useLeadersFocus, type LeadersFocusTask, type MyTaskWithProject } from '@/hooks/useTasks';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, AlertCircle, Calendar, AlertTriangle, ListTodo, CalendarDays } from 'lucide-react';
import { format, isBefore, endOfWeek, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type MyTask = MyTaskWithProject;

const today = startOfDay(new Date());
const todayStr = format(today, 'yyyy-MM-dd');
const endOfWeekStr = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');

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
  pending: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
};

export function MyFocusToday() {
  const { isProjectLeader } = useAuth();
  const [focusTab, setFocusTab] = useState<FocusTab>('mine');
  const [showAllRanking, setShowAllRanking] = useState(false);

  const { tasks, data: myTasksData, isLoading, isError, error } = useMyTasks();

  const showTeamTab = !!isProjectLeader;
  const {
    data: teamTasks = [],
    isLoading: teamLoading,
    error: teamError,
  } = useLeadersFocus(showTeamTab && focusTab === 'team');

  useEffect(() => {
    if (import.meta.env.DEV && myTasksData !== undefined) {
      console.log('[MyFocusToday] my-tasks data', myTasksData.length, myTasksData);
    }
  }, [myTasksData]);

  const pending = tasks.filter((t) => !t.status?.is_completed);

  const vencenHoy = pending.filter((t) => {
    if (!t.due_date || typeof t.due_date !== 'string') return false;
    return t.due_date.slice(0, 10) === todayStr;
  });
  const vencidas = pending.filter((t) => {
    if (!t.due_date) return false;
    const d = parseDue(t.due_date);
    return d !== null && isBefore(d, today);
  });
  const enCurso = pending;
  const estaSemana = pending.filter((t) => {
    if (!t.due_date || typeof t.due_date !== 'string') return false;
    const dStr = t.due_date.slice(0, 10);
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
  const cardBase =
    'rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-4 transition-all duration-200';
  const cardRed =
    'rounded-2xl border border-red-200 bg-red-50/50 shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-4 transition-all duration-200';

  if (isLoading && focusTab === 'mine') {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#0F172A]">👋 Tu foco hoy</h2>
        {showTeamTab && (
          <div className="flex rounded-lg border border-black/5 p-0.5 bg-black/5 w-fit">
            <button
              type="button"
              onClick={() => setFocusTab('mine')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                focusTab === 'mine' ? 'bg-white shadow text-[#0F172A]' : 'text-[#64748B] hover:text-[#0F172A]'
              )}
            >
              Mi foco
            </button>
            <button
              type="button"
              onClick={() => setFocusTab('team')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                focusTab === 'team' ? 'bg-white shadow text-[#0F172A]' : 'text-[#64748B] hover:text-[#0F172A]'
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
        <h2 className="text-lg font-semibold text-[#0F172A]">👋 Tu foco hoy</h2>
        {showTeamTab && (
          <div className="flex rounded-lg border border-black/5 p-0.5 bg-black/5 w-fit">
            <button
              type="button"
              onClick={() => setFocusTab('mine')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                focusTab === 'mine' ? 'bg-white shadow text-[#0F172A]' : 'text-[#64748B] hover:text-[#0F172A]'
              )}
            >
              Mi foco
            </button>
            <button
              type="button"
              onClick={() => setFocusTab('team')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                focusTab === 'team' ? 'bg-white shadow text-[#0F172A]' : 'text-[#64748B] hover:text-[#0F172A]'
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
      const parsedDue = parseDue(task.due_date);
      const dStr = typeof task.due_date === 'string' ? task.due_date.slice(0, 10) : null;
      const overdue = parsedDue !== null && isBefore(parsedDue, today);
      const dueToday = dStr !== null && dStr === todayStr;
      const dueThisWeek = dStr !== null && dStr >= todayStr && dStr <= endOfWeekStr;

      if (existing) {
        if (notCompleted) existing.pending += 1;
        if (overdue) existing.overdue += 1;
        if (dueToday) existing.dueToday += 1;
        if (dueThisWeek) existing.dueThisWeek += 1;
      } else {
        personMap.set(key, {
          key,
          name,
          email: task.assignee?.email ?? null,
          cargo: task.assignee?.cargo ?? null,
          pending: notCompleted ? 1 : 0,
          overdue: overdue ? 1 : 0,
          dueToday: dueToday ? 1 : 0,
          dueThisWeek: dueThisWeek ? 1 : 0,
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
        <h2 className="text-lg font-semibold text-[#0F172A]">👋 Tu foco hoy</h2>
        <div className="flex rounded-lg border border-black/5 p-0.5 bg-black/5 w-fit">
          <button
            type="button"
            onClick={() => setFocusTab('mine')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              focusTab === 'mine' ? 'bg-white shadow text-[#0F172A]' : 'text-[#64748B] hover:text-[#0F172A]'
            )}
          >
            Mi foco
          </button>
          <button
            type="button"
            onClick={() => setFocusTab('team')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              focusTab === 'team' ? 'bg-white shadow text-[#0F172A]' : 'text-[#64748B] hover:text-[#0F172A]'
            )}
          >
            Foco del equipo
          </button>
        </div>
        {teamLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#0DD9D0]" />
          </div>
        ) : teamError ? (
          <p className="text-sm text-[#64748B]">No se pudo cargar el foco del equipo.</p>
        ) : teamList.length === 0 ? (
          <p className="text-sm text-[#64748B]">Sin tareas del equipo por vencer.</p>
        ) : (
          <>
            {showTeamTab && (
              <Card className="rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                <CardContent className="p-4">
                  <p className="text-[11px] uppercase tracking-wide text-[#64748B] font-medium mb-3">
                    CARGA POR PERSONA
                  </p>
                  {ranking.length === 0 ? (
                    <p className="text-sm text-[#64748B]">Sin tareas del equipo por vencer.</p>
                  ) : (
                    <>
                      <ul className="space-y-3">
                        {rankingVisible.map((person) => {
                          const barWidth = maxPending > 0 ? Math.min(100, (person.pending / maxPending) * 100) : 0;
                          const risk = getRiskBadge(person);
                          return (
                            <li
                              key={person.key}
                              className="flex flex-col gap-1.5 py-2 px-3 rounded-lg border border-transparent hover:bg-black/[0.02]"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm text-[#0F172A] truncate">{person.name}</p>
                                  {person.cargo && (
                                    <p className="text-[12px] text-[#64748B] truncate">{person.cargo}</p>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={cn(
                                      'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                                      risk.className
                                    )}
                                  >
                                    {risk.label}
                                  </span>
                                  <span
                                    className={cn(
                                      'inline-flex items-center rounded-md px-2 py-1 text-[12px] font-medium border',
                                      person.overdue > 0
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : 'bg-black/5 text-[#64748B] border-black/10'
                                    )}
                                  >
                                    Vencidas {person.overdue}
                                  </span>
                                  <span className="inline-flex items-center rounded-md px-2 py-1 text-[12px] font-medium bg-black/5 text-[#64748B] border border-black/10">
                                    Hoy {person.dueToday}
                                  </span>
                                  <span className="inline-flex items-center rounded-md px-2 py-1 text-[12px] font-medium bg-black/5 text-[#64748B] border border-black/10">
                                    Semana {person.dueThisWeek}
                                  </span>
                                  <span className="inline-flex items-center rounded-md px-2 py-1 text-[12px] font-medium bg-black/5 text-[#64748B] border border-black/10">
                                    Pend. {person.pending}
                                  </span>
                                </div>
                              </div>
                              <div className="h-2 w-full rounded-xl border border-black/5 bg-black/5 overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-xl transition-all',
                                    person.overdue > 0 ? 'bg-red-500/40' : 'bg-[#0DD9D0]/60'
                                  )}
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      {hasMoreRanking && (
                        <button
                          type="button"
                          onClick={() => setShowAllRanking((v) => !v)}
                          className="mt-2 text-xs font-medium text-[#0DD9D0] hover:underline"
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
                <p className="text-[11px] uppercase tracking-wide text-[#64748B] font-medium mb-3">Foco del equipo</p>
                <ul className="space-y-2">
                  {teamList.slice(0, 5).map((task: LeadersFocusTask) => {
                    const parsed = parseDue(task.due_date);
                    const dueFormatted = parsed ? format(parsed, 'd MMM yyyy', { locale: es }) : '—';
                    const isOverdue = parsed !== null && isBefore(parsed, today);
                    return (
                      <li key={task.id}>
                        <Link
                          to={task.project?.id ? `/projects/${task.project.id}` : '#'}
                          className="flex flex-wrap items-center gap-2 py-2 px-3 rounded-lg hover:bg-[#0DD9D0]/5 transition-colors"
                        >
                          <span className="font-medium text-sm text-[#0F172A] flex-1 min-w-0 truncate">{task.title}</span>
                          <span className="text-xs text-[#64748B]">
                            {task.assignee?.full_name ?? task.assignee?.email ?? '—'}
                            {task.assignee?.cargo ? ` · ${task.assignee.cargo}` : ''}
                          </span>
                          <span className="text-xs text-[#64748B]">{task.project?.name ?? task.project?.key ?? '—'}</span>
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
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-[#0F172A]">👋 Tu foco hoy</h2>
      {showTeamTab && (
        <div className="flex rounded-lg border border-black/5 p-0.5 bg-black/5 w-fit">
          <button
            type="button"
            onClick={() => setFocusTab('mine')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              focusTab === 'mine' ? 'bg-white shadow text-[#0F172A]' : 'text-[#64748B] hover:text-[#0F172A]'
            )}
          >
            Mi foco
          </button>
          <button
            type="button"
            onClick={() => setFocusTab('team')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              focusTab === 'team' ? 'bg-white shadow text-[#0F172A]' : 'text-[#64748B] hover:text-[#0F172A]'
            )}
          >
            Foco del equipo
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className={cardBase}>
          <CardContent className="p-4 flex flex-row items-start justify-between">
            <div>
              <div className="text-2xl font-semibold text-[#0F172A]">{vencenHoy.length}</div>
              <p className="text-[11px] uppercase tracking-wide text-[#64748B] mt-0.5">Vencen hoy</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className={hasOverdue ? cardRed : cardBase}>
          <CardContent className="p-4 flex flex-row items-start justify-between">
            <div>
              <div className={`text-2xl font-semibold ${hasOverdue ? 'text-red-600' : 'text-[#0F172A]'}`}>
                {vencidas.length}
              </div>
              <p className="text-[11px] uppercase tracking-wide text-[#64748B] mt-0.5">Vencidas</p>
            </div>
            <div className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
              hasOverdue ? 'bg-red-100' : 'bg-primary/10'
            )}>
              <AlertTriangle className={cn('h-5 w-5', hasOverdue ? 'text-red-600' : 'text-primary')} />
            </div>
          </CardContent>
        </Card>
        <Card className={cardBase}>
          <CardContent className="p-4 flex flex-row items-start justify-between">
            <div>
              <div className="text-2xl font-semibold text-[#0F172A]">{enCurso.length}</div>
              <p className="text-[11px] uppercase tracking-wide text-[#64748B] mt-0.5">En curso</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ListTodo className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className={cardBase}>
          <CardContent className="p-4 flex flex-row items-start justify-between">
            <div>
              <div className="text-2xl font-semibold text-[#0F172A]">{estaSemana.length}</div>
              <p className="text-[11px] uppercase tracking-wide text-[#64748B] mt-0.5">Esta semana</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-[#64748B]">No tienes tareas asignadas.</p>
      ) : priorityList.length > 0 ? (
        <Card className="rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-[#64748B] font-medium mb-3">Tareas prioritarias</p>
            <ul className="space-y-2">
              {priorityList.map((task) => {
                const parsed = parseDue(task.due_date ?? null);
                const dueFormatted = parsed ? format(parsed, 'd MMM yyyy', { locale: es }) : '—';
                const isOverdue = parsed !== null && isBefore(parsed, today);
                return (
                  <li key={task.id}>
                    <Link
                      to={`/projects/${task.project_id}`}
                      className="flex flex-wrap items-center gap-2 py-2 px-3 rounded-lg hover:bg-[#0DD9D0]/5 transition-colors"
                    >
                      <span className="font-medium text-sm text-[#0F172A] flex-1 min-w-0 truncate">{task.title}</span>
                      <span className="text-xs text-[#64748B]">{task.project?.name ?? task.project?.key ?? '—'}</span>
                      <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-[#64748B]'}`}>
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
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
