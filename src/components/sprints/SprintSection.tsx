import { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, ChevronRight, Pencil, Trash2, Play, CheckCircle2, Calendar } from 'lucide-react';
import type { Sprint } from '@/hooks/useSprints';
import type { TaskWithDetails } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';

const STATUS_META: Record<Sprint['status'], { label: string; className: string }> = {
  planned: { label: 'Planificado', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  active: { label: 'Activo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completed: { label: 'Completado', className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const priorityConfig = {
  low: { label: 'Baja', className: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Media', className: 'bg-amber-100 text-amber-700' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgente', className: 'bg-red-100 text-red-700' },
};

const parseDate = (val: string) => new Date(val.slice(0, 10) + 'T00:00:00');
const formatRange = (start: string | null, end: string | null) => {
  if (!start && !end) return null;
  if (start && end) {
    return `${format(parseDate(start), 'd MMM', { locale: es })} - ${format(parseDate(end), 'd MMM yyyy', { locale: es })}`;
  }
  if (start) return `Desde ${format(parseDate(start), 'd MMM yyyy', { locale: es })}`;
  return `Hasta ${format(parseDate(end as string), 'd MMM yyyy', { locale: es })}`;
};

interface SprintSectionProps {
  droppableId: string;
  title: string;
  sprint?: Sprint;
  tasks: TaskWithDetails[];
  projectKey: string;
  canManage: boolean;
  defaultExpanded?: boolean;
  hasActiveSprint?: boolean;
  onTaskClick: (task: TaskWithDetails) => void;
  onEdit?: (sprint: Sprint) => void;
  onDelete?: (sprint: Sprint) => void;
  onStart?: (sprint: Sprint) => void;
  onComplete?: (sprint: Sprint) => void;
}

export function SprintSection({
  droppableId,
  title,
  sprint,
  tasks,
  projectKey,
  canManage,
  defaultExpanded = true,
  hasActiveSprint = false,
  onTaskClick,
  onEdit,
  onDelete,
  onStart,
  onComplete,
}: SprintSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isReadOnly = sprint?.status === 'completed';
  const total = sprint?.task_count ?? tasks.length;
  const completed = sprint?.completed_count ?? 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div
          className="flex items-start gap-2 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="mt-0.5 text-muted-foreground">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium truncate">{title}</h4>
              {sprint && (
                <Badge variant="outline" className={cn('text-xs', STATUS_META[sprint.status].className)}>
                  {STATUS_META[sprint.status].label}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {total} {total === 1 ? 'tarea' : 'tareas'}
              </span>
            </div>
            {sprint?.goal && <p className="text-sm text-muted-foreground">{sprint.goal}</p>}
            {sprint && formatRange(sprint.start_date, sprint.end_date) && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{formatRange(sprint.start_date, sprint.end_date)}</span>
              </div>
            )}
            {sprint && total > 0 && (
              <div className="flex items-center gap-2 max-w-xs">
                <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{completed}/{total}</span>
              </div>
            )}
          </div>

          {sprint && canManage && (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {sprint.status === 'planned' && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onStart?.(sprint)}
                  disabled={hasActiveSprint}
                  title={hasActiveSprint ? 'Ya hay un sprint activo en este proyecto' : 'Iniciar sprint'}
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Iniciar
                </Button>
              )}
              {sprint.status === 'active' && (
                <Button type="button" size="sm" variant="outline" onClick={() => onComplete?.(sprint)}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Completar
                </Button>
              )}
              {sprint.status !== 'completed' && (
                <>
                  <Button type="button" size="icon" variant="ghost" onClick={() => onEdit?.(sprint)} title="Editar sprint">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete?.(sprint)}
                    title="Eliminar sprint"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {expanded && (
          <div className="border-t bg-muted/20">
            <Droppable droppableId={droppableId} isDropDisabled={isReadOnly}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'divide-y min-h-[40px]',
                    snapshot.isDraggingOver && 'bg-accent/40'
                  )}
                >
                  {tasks.length === 0 && (
                    <p className="text-sm text-muted-foreground px-10 py-4">
                      {sprint ? 'Arrastra tareas aquí para añadirlas al sprint.' : 'No hay tareas en el backlog.'}
                    </p>
                  )}
                  {tasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!canManage || isReadOnly}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          className={cn(
                            'flex items-center gap-3 px-6 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors',
                            dragSnapshot.isDragging && 'bg-background shadow-md'
                          )}
                          onClick={() => onTaskClick(task)}
                        >
                          <span
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: task.status?.color || '#94a3b8' }}
                          />
                          <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
                            {projectKey}-{task.task_number}
                          </span>
                          <span className="text-sm font-medium flex-1 truncate">{task.title}</span>
                          <Badge className={cn('text-xs flex-shrink-0', priorityConfig[task.priority].className)}>
                            {priorityConfig[task.priority].label}
                          </Badge>
                          {task.assignee && (
                            <span className="text-xs text-muted-foreground flex-shrink-0 truncate max-w-[100px]">
                              {task.assignee.full_name}
                            </span>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
