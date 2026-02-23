import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMyTasks, TaskWithDetails, useTaskStatuses } from '@/hooks/useTasks';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ListTodo, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const priorityConfig = {
  low: { label: 'Baja', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  medium: { label: 'Media', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  urgent: { label: 'Urgente', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

type MyTask = TaskWithDetails & { project: { id: string; name: string; key: string } };

export default function MyTasksPage() {
  const { data: tasks = [], isLoading } = useMyTasks();
  const { data: statuses = [] } = useTaskStatuses();
  const [selectedTask, setSelectedTask] = useState<MyTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const pendingTasks = tasks.filter((t) => !t.status.is_completed);
  const completedTasks = tasks.filter((t) => t.status.is_completed);
  const overdueTasks = pendingTasks.filter(
    (t) => t.due_date && isBefore(new Date(t.due_date), new Date())
  );
  const upcomingTasks = pendingTasks.filter(
    (t) => t.due_date && isAfter(new Date(t.due_date), new Date()) && isBefore(new Date(t.due_date), addDays(new Date(), 7))
  );

  const handleTaskClick = (task: MyTask) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const TaskCard = ({ task }: { task: MyTask }) => {
    const priority = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.medium;
    const isOverdue = task.due_date && isBefore(new Date(task.due_date), new Date()) && !task.status.is_completed;

    return (
      <div
        onClick={() => handleTaskClick(task)}
        className={cn(
          'p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors',
          isOverdue && 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
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
            <p className="text-xs text-muted-foreground mt-1">
              Proyecto: {task.project.name}
            </p>
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
              <span className={cn('text-xs', isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                {isOverdue && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                {format(new Date(task.due_date), 'dd MMM yyyy', { locale: es })}
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
        <p className="page-description">
          Tareas asignadas a ti en todos los proyectos
        </p>
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
          <TabsTrigger value="pending">
            Pendientes ({pendingTasks.length})
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Vencidas ({overdueTasks.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Próximas ({upcomingTasks.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completadas ({completedTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pendingTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                <p className="text-muted-foreground">No tienes tareas pendientes</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="overdue" className="mt-4">
          {overdueTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                <p className="text-muted-foreground">No tienes tareas vencidas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {overdueTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          {upcomingTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No tienes tareas próximas a vencer (7 días)</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completedTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No has completado tareas aún</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
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
