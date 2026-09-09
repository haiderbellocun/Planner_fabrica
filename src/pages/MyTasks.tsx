import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMyTasks, useTaskStatuses, type MyTaskWithProject } from '@/hooks/useTasks';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { MiniCalendar, type CalendarEvent } from '@/components/ui/MiniCalendar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ListTodo, Clock, AlertTriangle, CheckCircle, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { parseDateOnly } from '@/lib/dates';
import { getBusinessTodayStr, getDueBucket, isWithinDays } from '@/lib/dueDate';

const priorityConfig = {
  low:    { label: 'Baja',    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',       cardBg: 'bg-slate-50/70 border-slate-200' },
  medium: { label: 'Media',   className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', cardBg: 'bg-teal-50/70 border-teal-200' },
  high:   { label: 'Alta',    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', cardBg: 'bg-orange-50/70 border-orange-200' },
  urgent: { label: 'Urgente', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',         cardBg: 'bg-red-50/70 border-red-200' },
};

const TASK_COLORS: Record<string, string> = {
  low:    'bg-gray-400',
  medium: 'bg-amber-400',
  high:   'bg-orange-500',
  urgent: 'bg-red-500',
};

export default function MyTasksPage() {
  const { tasks, isLoading } = useMyTasks();
  const { data: statuses = [] } = useTaskStatuses();
  const [selectedTask, setSelectedTask] = useState<MyTaskWithProject | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const pendingTasks   = tasks.filter((t) => !t.status.is_completed);
  const completedTasks = tasks.filter((t) => t.status.is_completed);
  const todayStr = getBusinessTodayStr();
  const overdueTasks = pendingTasks.filter(
    (t) => getDueBucket(t.due_date, t.status.is_completed, todayStr) === 'overdue'
  );
  const upcomingTasks = pendingTasks.filter((t) => isWithinDays(t.due_date, 7, todayStr));

  const handleTaskClick = (task: MyTaskWithProject) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  // Calendar events from pending tasks with due_date
  const calendarEvents: CalendarEvent[] = pendingTasks
    .filter((t) => !!parseDateOnly(t.due_date))
    .map((t) => ({
      id:    t.id,
      date:  format(parseDateOnly(t.due_date)!, 'yyyy-MM-dd'),
      label: `${t.title} · ${t.project.name}`,
      color: TASK_COLORS[t.priority] ?? 'bg-primary',
      onClick: () => handleTaskClick(t),
    }));

  if (isLoading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const TaskCard = ({ task }: { task: MyTaskWithProject }) => {
    const priority = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.medium;
    const parsedDue = parseDateOnly(task.due_date);
    const dueBucket = getDueBucket(task.due_date, task.status.is_completed, todayStr);
    const isOverdue = dueBucket === 'overdue';
    const isDueToday = dueBucket === 'due_today';

    return (
      <div
        onClick={() => handleTaskClick(task)}
        className={cn(
          'p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md hover:brightness-95',
          isOverdue ? 'border-red-300 bg-red-50/80' : isDueToday ? 'border-amber-300 bg-amber-50/80' : priority.cardBg,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs shrink-0">
                {task.project.key}-{task.task_number}
              </Badge>
              <Badge className={cn('text-xs', priority.className)}>
                {priority.label}
              </Badge>
            </div>
            <p className="font-medium truncate">{task.title}</p>
            {/* Project name as link */}
            <Link
              to={`/projects/${task.project.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1 font-medium"
            >
              {task.project.name}
            </Link>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge
              style={{ backgroundColor: task.status.color + '20', color: task.status.color, borderColor: task.status.color }}
              variant="outline"
              className="text-xs"
            >
              {task.status.name}
            </Badge>
            {task.due_date && (
              <span className={cn(
                'text-xs',
                isOverdue ? 'text-red-600 font-medium' : isDueToday ? 'text-amber-700 font-medium' : 'text-muted-foreground',
              )}>
                {isOverdue && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                {isDueToday ? 'Vence hoy' : parsedDue ? format(parsedDue, 'dd MMM yyyy', { locale: es }) : null}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container max-w-4xl">
      <div className="page-header">
        <h1 className="page-title">Mis Tareas</h1>
        <p className="page-description">Tareas asignadas a ti en todos los proyectos</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <ListTodo className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{tasks.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold">{pendingTasks.length}</p>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-red-500" />
            <p className="text-2xl font-bold">{overdueTasks.length}</p>
            <p className="text-xs text-muted-foreground">Vencidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{completedTasks.length}</p>
            <p className="text-xs text-muted-foreground">Completadas</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pendientes ({pendingTasks.length})</TabsTrigger>
          <TabsTrigger value="overdue">Vencidas ({overdueTasks.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Próximas ({upcomingTasks.length})</TabsTrigger>
          <TabsTrigger value="completed">Completadas ({completedTasks.length})</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Calendario
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pendingTasks.length === 0 ? (
            <Card><CardContent className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <p className="text-muted-foreground">No tienes tareas pendientes</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {pendingTasks.map((task) => <TaskCard key={task.id} task={task} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="overdue" className="mt-4">
          {overdueTasks.length === 0 ? (
            <Card><CardContent className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <p className="text-muted-foreground">No tienes tareas vencidas</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {overdueTasks.map((task) => <TaskCard key={task.id} task={task} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          {upcomingTasks.length === 0 ? (
            <Card><CardContent className="p-8 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No tienes tareas próximas a vencer (7 días)</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map((task) => <TaskCard key={task.id} task={task} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completedTasks.length === 0 ? (
            <Card><CardContent className="p-8 text-center">
              <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No has completado tareas aún</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {completedTasks.map((task) => <TaskCard key={task.id} task={task} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          {calendarEvents.length === 0 ? (
            <Card><CardContent className="p-8 text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No hay tareas con fecha de vencimiento</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Haz clic en un día para ver las tareas. Los colores indican prioridad.
              </p>
              <div className="flex gap-3 text-xs flex-wrap">
                {[
                  { label: 'Baja', color: 'bg-gray-400' },
                  { label: 'Media', color: 'bg-amber-400' },
                  { label: 'Alta', color: 'bg-orange-500' },
                  { label: 'Urgente', color: 'bg-red-500' },
                ].map((l) => (
                  <span key={l.label} className="flex items-center gap-1.5 text-slate-500">
                    <span className={cn('h-2.5 w-2.5 rounded-full', l.color)} />
                    {l.label}
                  </span>
                ))}
              </div>
              <MiniCalendar events={calendarEvents} />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedTask && (
        <TaskDetailSheet
          task={selectedTask}
          projectKey={selectedTask.project.key}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      )}
    </div>
  );
}
