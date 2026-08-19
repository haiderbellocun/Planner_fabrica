import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, addWeeks, subMonths, subWeeks,
  isSameDay, isSameMonth, parseISO, isToday, isBefore, startOfDay,
  eachDayOfInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, FolderKanban, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useTask } from '@/hooks/useTasks';
import { useProfiles } from '@/hooks/useProfiles';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';

// ── Types ──────────────────────────────────────────────────────────────────

interface CalendarProject {
  id: string;
  name: string;
  key: string;
  end_date: string;
  status: string;
  completion_rate: number;
}

interface CalendarTask {
  id: string;
  title: string;
  due_date: string;
  status_name: string;
  status_color: string;
  is_completed: boolean;
  assignee_id: string | null;
  assignee_name: string | null;
  avatar_url: string | null;
  assignee_cargo: string | null;
  project_name: string;
  project_key: string;
}

interface CalendarEvents {
  projects: CalendarProject[];
  tasks: CalendarTask[];
}

// ── Colors ─────────────────────────────────────────────────────────────────

const PERSON_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#3B82F6', '#EF4444', '#14B8A6',
  '#F97316', '#84CC16', '#06B6D4', '#A855F7',
];

function getPersonColor(id: string | null): string {
  if (!id) return '#94A3B8';
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return PERSON_COLORS[Math.abs(hash) % PERSON_COLORS.length];
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ── Hook ───────────────────────────────────────────────────────────────────

function useCalendarEvents() {
  return useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => api.get<CalendarEvents>('/api/calendar/events'),
    staleTime: 5 * 60 * 1000,
  });
}

type CalendarView = 'month' | 'week' | 'agenda';

// ── Main Component ─────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [showProjects, setShowProjects] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set());
  const [selectedCargos, setSelectedCargos] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedProjectKey, setSelectedProjectKey] = useState('');

  const { data: eventsData, isLoading } = useCalendarEvents();
  const { data: selectedTask } = useTask(selectedTaskId ?? undefined);
  const { data: allProfiles = [] } = useProfiles();

  const projects = eventsData?.projects ?? [];
  const tasks = eventsData?.tasks ?? [];

  // Build assignee list from tasks
  const assignees = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatar_url: string | null }>();
    tasks.forEach(t => {
      if (t.assignee_id && !map.has(t.assignee_id)) {
        map.set(t.assignee_id, {
          id: t.assignee_id,
          name: t.assignee_name ?? 'Sin nombre',
          avatar_url: t.avatar_url,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  // Cargos of every currently-active person (not just those with a task due
  // in the calendar's data), so the filter is browsable even when nobody with
  // that cargo happens to have a task showing right now.
  const cargos = useMemo(() => {
    const set = new Set<string>();
    allProfiles.forEach(p => { if (p.cargo) set.add(p.cargo); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allProfiles]);

  const toggleAssignee = (id: string) => {
    setSelectedAssignees(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCargo = (cargo: string) => {
    setSelectedCargos(prev => {
      const next = new Set(prev);
      if (next.has(cargo)) next.delete(cargo);
      else next.add(cargo);
      return next;
    });
  };

  // Filter events
  const filteredProjects = useMemo(
    () => (showProjects ? projects : []),
    [projects, showProjects]
  );

  const filteredTasks = useMemo(() => {
    if (!showTasks) return [];
    return tasks.filter(t => {
      if (selectedAssignees.size > 0 && !(t.assignee_id && selectedAssignees.has(t.assignee_id))) return false;
      if (selectedCargos.size > 0 && !(t.assignee_cargo && selectedCargos.has(t.assignee_cargo))) return false;
      return true;
    });
  }, [tasks, showTasks, selectedAssignees, selectedCargos]);

  // Events for a given date string "YYYY-MM-DD"
  const getEventsForDate = (dateStr: string) => {
    const proj = filteredProjects.filter(p => p.end_date === dateStr);
    const tsk = filteredTasks.filter(t => t.due_date === dateStr);
    return { proj, tsk };
  };

  // Navigation
  const prev = () => {
    if (view === 'month') setCurrentDate(d => subMonths(d, 1));
    else if (view === 'week') setCurrentDate(d => subWeeks(d, 1));
    else setCurrentDate(d => subMonths(d, 1));
  };
  const next = () => {
    if (view === 'month') setCurrentDate(d => addMonths(d, 1));
    else if (view === 'week') setCurrentDate(d => addWeeks(d, 1));
    else setCurrentDate(d => addMonths(d, 1));
  };
  const goToday = () => setCurrentDate(new Date());

  const headerLabel = () => {
    if (view === 'month') return format(currentDate, 'MMMM yyyy', { locale: es });
    if (view === 'week') {
      const wStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const wEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      if (isSameMonth(wStart, wEnd)) return format(wStart, 'MMMM yyyy', { locale: es });
      return `${format(wStart, 'MMM', { locale: es })} – ${format(wEnd, 'MMM yyyy', { locale: es })}`;
    }
    return format(currentDate, 'MMMM yyyy', { locale: es });
  };

  return (
    <div className="page-container flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          Calendario
        </h1>
        <p className="page-description">Fechas de finalización de proyectos y tareas del equipo</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Sidebar filters */}
        <aside className="lg:w-60 shrink-0 space-y-4">
          {/* Event types */}
          <div className="rounded-xl border border-black/5 shadow-sm bg-card p-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Mostrar</p>
            <button
              type="button"
              onClick={() => setShowProjects(v => !v)}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
                showProjects ? 'bg-primary/10 text-primary-deep' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <span className="h-3 w-3 rounded-full bg-primary shrink-0" />
              <FolderKanban className="h-4 w-4 shrink-0" />
              Proyectos
            </button>
            <button
              type="button"
              onClick={() => setShowTasks(v => !v)}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
                showTasks ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <span className="h-3 w-3 rounded-full bg-primary shrink-0" />
              <CheckSquare className="h-4 w-4 shrink-0" />
              Tareas
            </button>
          </div>

          {/* Cargo filter */}
          {showTasks && cargos.length > 0 && (
            <div className="rounded-xl border border-black/5 shadow-sm bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Cargo</p>
                {selectedCargos.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCargos(new Set())}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {cargos.map(cargo => {
                  const active = selectedCargos.size === 0 || selectedCargos.has(cargo);
                  return (
                    <button
                      key={cargo}
                      type="button"
                      onClick={() => toggleCargo(cargo)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors',
                        selectedCargos.has(cargo)
                          ? 'bg-primary/10 text-primary font-medium'
                          : active
                            ? 'hover:bg-muted'
                            : 'opacity-40 hover:opacity-70 hover:bg-muted'
                      )}
                    >
                      <span className="truncate text-left">{cargo}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Collaborator filter */}
          {showTasks && assignees.length > 0 && (
            <div className="rounded-xl border border-black/5 shadow-sm bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Colaborador</p>
                {selectedAssignees.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedAssignees(new Set())}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {assignees.map(a => {
                  const color = getPersonColor(a.id);
                  const active = selectedAssignees.size === 0 || selectedAssignees.has(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAssignee(a.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors',
                        selectedAssignees.has(a.id)
                          ? 'bg-black/5 font-medium'
                          : active
                            ? 'hover:bg-muted'
                            : 'opacity-40 hover:opacity-70 hover:bg-muted'
                      )}
                    >
                      <Avatar className="h-5 w-5 shrink-0">
                        <AvatarImage src={a.avatar_url ?? undefined} />
                        <AvatarFallback style={{ backgroundColor: color, color: '#fff', fontSize: '8px' }}>
                          {getInitials(a.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-left">{a.name}</span>
                      <span
                        className="ml-auto h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="rounded-xl border border-black/5 shadow-sm bg-card p-3 space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Leyenda</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2.5 w-5 rounded-sm bg-primary" />
              Fin de proyecto
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2.5 w-5 rounded-sm bg-primary" />
              Tarea vencida
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2.5 w-5 rounded-sm bg-slate-300" />
              Tarea completada
            </div>
          </div>
        </aside>

        {/* Calendar main */}
        <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-black/5 shadow-sm bg-card overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={prev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday} className="text-xs">
                Hoy
              </Button>
              <Button variant="outline" size="sm" onClick={next}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="text-base font-semibold capitalize ml-2">{headerLabel()}</h2>
            </div>
            <div className="flex items-center gap-1 border rounded-lg p-0.5">
              {(['month', 'week', 'agenda'] as CalendarView[]).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                    view === v ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : 'Agenda'}
                </button>
              ))}
            </div>
          </div>

          {/* Views */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Cargando eventos...
            </div>
          ) : view === 'month' ? (
            <MonthView
              currentDate={currentDate}
              getEventsForDate={getEventsForDate}
              onTaskClick={(id, key) => { setSelectedTaskId(id); setSelectedProjectKey(key); }}
            />
          ) : view === 'week' ? (
            <WeekView
              currentDate={currentDate}
              getEventsForDate={getEventsForDate}
              onTaskClick={(id, key) => { setSelectedTaskId(id); setSelectedProjectKey(key); }}
            />
          ) : (
            <AgendaView
              currentDate={currentDate}
              filteredProjects={filteredProjects}
              filteredTasks={filteredTasks}
              onTaskClick={(id, key) => { setSelectedTaskId(id); setSelectedProjectKey(key); }}
            />
          )}
        </div>
      </div>

      <TaskDetailSheet
        task={selectedTask ?? null}
        projectKey={selectedProjectKey}
        open={!!selectedTaskId}
        onOpenChange={open => { if (!open) setSelectedTaskId(null); }}
      />
    </div>
  );
}

// ── Month View ─────────────────────────────────────────────────────────────

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

type GetEventsForDate = (dateStr: string) => { proj: CalendarProject[]; tsk: CalendarTask[] };

function MonthView({
  currentDate,
  getEventsForDate,
  onTaskClick,
}: {
  currentDate: Date;
  getEventsForDate: GetEventsForDate;
  onTaskClick: (id: string, key: string) => void;
}) {
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="flex-1 overflow-auto">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b">
        {WEEK_DAYS.map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {/* Days grid */}
      <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(100px, 1fr)' }}>
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const { proj, tsk } = getEventsForDate(dateStr);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDay = isToday(day);
          const totalEvents = proj.length + tsk.length;
          const MAX_SHOW = 3;

          return (
            <div
              key={dateStr}
              className={cn(
                'border-r border-b p-1 min-h-[100px]',
                !isCurrentMonth && 'bg-muted/30',
              )}
            >
              <div className={cn(
                'text-xs font-semibold mb-1 h-6 w-6 flex items-center justify-center rounded-full',
                isTodayDay && 'bg-primary text-white',
                !isTodayDay && isCurrentMonth && 'text-foreground',
                !isTodayDay && !isCurrentMonth && 'text-muted-foreground',
              )}>
                {format(day, 'd')}
              </div>

              <div className="space-y-0.5">
                {proj.slice(0, MAX_SHOW).map(p => (
                  <div
                    key={p.id}
                    title={`${p.name} — ${p.completion_rate}% completado`}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate bg-primary/20 text-primary-deep cursor-default"
                  >
                    <FolderKanban className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{p.key}</span>
                  </div>
                ))}
                {tsk.slice(0, MAX_SHOW - proj.length).map(t => {
                  const color = getPersonColor(t.assignee_id);
                  const isPast = t.due_date < format(today, 'yyyy-MM-dd') && !t.is_completed;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onTaskClick(t.id, t.project_key)}
                      title={`${t.title} · ${t.assignee_name ?? 'Sin asignado'}`}
                      className={cn(
                        'w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate text-left transition-opacity hover:opacity-80',
                        t.is_completed && 'opacity-50'
                      )}
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      <span
                        className={cn('h-1.5 w-1.5 rounded-full shrink-0', isPast && !t.is_completed && 'bg-red-500')}
                        style={!isPast || t.is_completed ? { backgroundColor: color } : undefined}
                      />
                      <span className="truncate">{t.title}</span>
                    </button>
                  );
                })}
                {totalEvents > MAX_SHOW && (
                  <div className="text-[10px] text-muted-foreground px-1.5">
                    +{totalEvents - MAX_SHOW} más
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week View ──────────────────────────────────────────────────────────────

function WeekView({
  currentDate,
  getEventsForDate,
  onTaskClick,
}: {
  currentDate: Date;
  getEventsForDate: GetEventsForDate;
  onTaskClick: (id: string, key: string) => void;
}) {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-7 border-b min-h-full">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const { proj, tsk } = getEventsForDate(dateStr);
          const isTodayDay = isToday(day);

          return (
            <div key={dateStr} className="border-r last:border-r-0 p-2 min-h-[400px]">
              {/* Day header */}
              <div className="text-center mb-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  {format(day, 'EEE', { locale: es })}
                </div>
                <div className={cn(
                  'text-xl font-semibold mx-auto h-9 w-9 flex items-center justify-center rounded-full',
                  isTodayDay && 'bg-primary text-white',
                )}>
                  {format(day, 'd')}
                </div>
              </div>

              {/* Events */}
              <div className="space-y-1">
                {proj.map(p => (
                  <div
                    key={p.id}
                    className="p-1.5 rounded-lg bg-primary/15 border border-primary/30"
                  >
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-primary-deep">
                      <FolderKanban className="h-3 w-3 shrink-0" />
                      <span className="truncate">{p.key}</span>
                    </div>
                    <p className="text-[10px] text-primary-deep/80 truncate mt-0.5">{p.name}</p>
                    <p className="text-[10px] text-primary-deep/60 mt-0.5">{p.completion_rate}% completado</p>
                  </div>
                ))}
                {tsk.map(t => {
                  const color = getPersonColor(t.assignee_id);
                  const isPast = t.due_date < format(today, 'yyyy-MM-dd') && !t.is_completed;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onTaskClick(t.id, t.project_key)}
                      className={cn(
                        'w-full text-left p-1.5 rounded-lg border transition-opacity hover:opacity-80',
                        t.is_completed && 'opacity-50'
                      )}
                      style={{ backgroundColor: `${color}15`, borderColor: `${color}30` }}
                    >
                      <p className="text-[11px] font-medium truncate" style={{ color }}>
                        {t.title}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px]" style={{ color: `${color}99` }}>
                          {t.project_key}
                        </span>
                        {t.assignee_name && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            · {t.assignee_name.split(' ')[0]}
                          </span>
                        )}
                        {isPast && (
                          <span className="text-[10px] text-red-500 font-medium ml-auto">Vencida</span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {proj.length === 0 && tsk.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/40 text-center pt-4">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Agenda View ─────────────────────────────────────────────────────────────

function AgendaView({
  currentDate,
  filteredProjects,
  filteredTasks,
  onTaskClick,
}: {
  currentDate: Date;
  filteredProjects: CalendarProject[];
  filteredTasks: CalendarTask[];
  onTaskClick: (id: string, key: string) => void;
}) {
  const today = startOfDay(new Date());
  const rangeStart = startOfMonth(currentDate);
  const rangeEnd = endOfMonth(addMonths(currentDate, 2));

  // Collect all events in range grouped by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, { proj: CalendarProject[]; tsk: CalendarTask[] }>();

    filteredProjects.forEach(p => {
      if (!p.end_date) return;
      const d = parseISO(p.end_date);
      if (d < rangeStart || d > rangeEnd) return;
      const key = p.end_date;
      if (!map.has(key)) map.set(key, { proj: [], tsk: [] });
      map.get(key)!.proj.push(p);
    });

    filteredTasks.forEach(t => {
      if (!t.due_date) return;
      const d = parseISO(t.due_date);
      if (d < rangeStart || d > rangeEnd) return;
      const key = t.due_date;
      if (!map.has(key)) map.set(key, { proj: [], tsk: [] });
      map.get(key)!.tsk.push(t);
    });

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b));
  }, [filteredProjects, filteredTasks, rangeStart, rangeEnd]);

  if (eventsByDate.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Sin eventos en este período
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {eventsByDate.map(([dateStr, { proj, tsk }]) => {
        const day = parseISO(dateStr);
        const isPast = isBefore(day, today);
        const isTodayDay = isToday(day);

        return (
          <div key={dateStr} className="flex gap-4">
            {/* Date column */}
            <div className="w-16 shrink-0 text-right pt-1">
              <div className={cn(
                'text-xl font-bold leading-none',
                isTodayDay ? 'text-primary' : isPast ? 'text-muted-foreground/50' : 'text-foreground'
              )}>
                {format(day, 'd')}
              </div>
              <div className="text-[11px] text-muted-foreground capitalize">
                {format(day, 'EEE', { locale: es })}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {format(day, 'MMM', { locale: es })}
              </div>
            </div>

            {/* Events */}
            <div className="flex-1 space-y-1.5 pb-4 border-b">
              {proj.map(p => (
                <div key={p.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                  <FolderKanban className="h-4 w-4 text-primary-deep mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary-deep truncate">{p.name}</p>
                    <p className="text-xs text-primary-deep/70">{p.key} · {p.completion_rate}% completado · {p.status}</p>
                  </div>
                  <Badge variant="outline" className="ml-auto shrink-0 text-[10px] border-primary/40 text-primary-deep">
                    Proyecto
                  </Badge>
                </div>
              ))}
              {tsk.map(t => {
                const color = getPersonColor(t.assignee_id);
                const isPastTask = t.due_date < format(today, 'yyyy-MM-dd') && !t.is_completed;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTaskClick(t.id, t.project_key)}
                    className={cn(
                      'w-full flex items-start gap-3 p-2.5 rounded-xl border text-left transition-all hover:shadow-sm',
                      t.is_completed && 'opacity-50'
                    )}
                    style={{ backgroundColor: `${color}10`, borderColor: `${color}25` }}
                  >
                    <div className="h-4 w-4 rounded-full shrink-0 mt-0.5 flex items-center justify-center"
                         style={{ backgroundColor: `${color}30` }}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color }}>{t.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">{t.project_key} · {t.project_name}</span>
                        {t.assignee_name && (
                          <span className="text-xs" style={{ color: `${color}99` }}>{t.assignee_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md"
                        style={{ backgroundColor: `${t.status_color}20`, color: t.status_color }}
                      >
                        {t.status_name}
                      </span>
                      {isPastTask && (
                        <span className="text-[10px] text-red-500 font-medium">Vencida</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
