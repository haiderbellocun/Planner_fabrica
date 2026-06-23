import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { CreateEpicDialog } from './CreateEpicDialog';
import { Epic, useDeleteEpic, useEpics } from '@/hooks/useEpics';
import { TaskWithDetails } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';

const priorityConfig = {
  low: { label: 'Baja', className: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Media', className: 'bg-amber-100 text-amber-700' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgente', className: 'bg-red-100 text-red-700' },
};

interface EpicsPanelProps {
  projectId: string;
  canManage: boolean;
  tasks?: TaskWithDetails[];
  onTaskClick?: (task: TaskWithDetails) => void;
}

const STATUS_META: Record<Epic['status'], { label: string; className: string }> = {
  open: { label: 'Abierta', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress: { label: 'En progreso', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed: { label: 'Completada', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelada', className: 'bg-gray-100 text-gray-700 border-gray-200' },
};

export function EpicsPanel({ projectId, canManage, tasks = [], onTaskClick }: EpicsPanelProps) {
  const { data: epics = [], isLoading } = useEpics(projectId);
  const deleteEpic = useDeleteEpic(projectId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEpic, setSelectedEpic] = useState<Epic | null>(null);
  const [expandedEpicId, setExpandedEpicId] = useState<string | null>(null);

  const sortedEpics = useMemo(
    () =>
      [...epics].sort((a, b) => {
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }),
    [epics]
  );

  const handleCreate = () => {
    setSelectedEpic(null);
    setDialogOpen(true);
  };

  const handleEdit = (epic: Epic) => {
    setSelectedEpic(epic);
    setDialogOpen(true);
  };

  const handleDelete = (epic: Epic) => {
    if (!confirm(`¿Eliminar la épica "${epic.title}"? Las tareas quedarán sin épica.`)) return;
    deleteEpic.mutate(epic.id);
  };

  const parseDate = (val: string) => new Date(val.slice(0, 10) + 'T00:00:00');

  const formatRange = (start: string | null, end: string | null) => {
    if (!start && !end) return null;
    if (start && end) {
      return `${format(parseDate(start), 'd MMM yyyy', { locale: es })} - ${format(parseDate(end), 'd MMM yyyy', { locale: es })}`;
    }
    if (start) return `Desde ${format(parseDate(start), 'd MMM yyyy', { locale: es })}`;
    return `Hasta ${format(parseDate(end as string), 'd MMM yyyy', { locale: es })}`;
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva épica
          </Button>
        </div>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Cargando épicas...</CardContent>
        </Card>
      ) : sortedEpics.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No hay épicas creadas en este proyecto.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sortedEpics.map((epic) => {
            const epicTasks = tasks.filter((t) => (t as any).epic_id === epic.id);
            const isExpanded = expandedEpicId === epic.id;

            return (
              <Card key={epic.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div style={{ borderLeft: `4px solid ${epic.color}` }}>
                    {/* Epic header — click to expand */}
                    <div
                      className="flex items-start gap-2 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setExpandedEpicId(isExpanded ? null : epic.id)}
                    >
                      <div className="mt-0.5 text-muted-foreground">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium truncate">{epic.title}</h4>
                          <Badge variant="outline" className={cn('text-xs', STATUS_META[epic.status].className)}>
                            {STATUS_META[epic.status].label}
                          </Badge>
                          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                            {epicTasks.length} {epicTasks.length === 1 ? 'tarea' : 'tareas'}
                          </span>
                        </div>
                        {epic.description && (
                          <p className="text-sm text-muted-foreground">{epic.description}</p>
                        )}
                        {formatRange(epic.start_date, epic.end_date) && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{formatRange(epic.start_date, epic.end_date)}</span>
                          </div>
                        )}
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(epic)}
                            title="Editar épica"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(epic)}
                            title="Eliminar épica"
                            disabled={deleteEpic.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Task list — visible when expanded */}
                    {isExpanded && (
                      <div className="border-t bg-muted/20">
                        {epicTasks.length === 0 ? (
                          <p className="text-sm text-muted-foreground px-10 py-4">
                            No hay tareas asignadas a esta épica.
                          </p>
                        ) : (
                          <div className="divide-y">
                            {epicTasks.map((task) => (
                              <div
                                key={task.id}
                                className="flex items-center gap-3 px-10 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={(e) => { e.stopPropagation(); onTaskClick?.(task); }}
                              >
                                <span
                                  className="h-2 w-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: task.status?.color || '#94a3b8' }}
                                />
                                <span className="text-sm font-medium flex-1 truncate">{task.title}</span>
                                <Badge
                                  className={cn('text-xs flex-shrink-0', priorityConfig[task.priority].className)}
                                >
                                  {priorityConfig[task.priority].label}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-xs flex-shrink-0"
                                  style={{
                                    backgroundColor: `${task.status?.color}15`,
                                    color: task.status?.color,
                                    borderColor: task.status?.color,
                                  }}
                                >
                                  {task.status?.name}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateEpicDialog
        projectId={projectId}
        epic={selectedEpic}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedEpic(null);
        }}
      />
    </div>
  );
}
