import { useMemo, useState } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Loader2 } from 'lucide-react';
import { CreateSprintDialog } from './CreateSprintDialog';
import { SprintSection } from './SprintSection';
import {
  Sprint,
  useSprints,
  useDeleteSprint,
  useStartSprint,
  useCompleteSprint,
} from '@/hooks/useSprints';
import { useUpdateTask, useUpdateTaskRank, TaskWithDetails } from '@/hooks/useTasks';

const BACKLOG_DROPPABLE = 'backlog';
const sprintDroppableId = (sprintId: string) => `sprint:${sprintId}`;
const sprintIdFromDroppable = (droppableId: string) =>
  droppableId === BACKLOG_DROPPABLE ? null : droppableId.replace(/^sprint:/, '');

interface BacklogPanelProps {
  projectId: string;
  projectKey: string;
  canManage: boolean;
  tasks: TaskWithDetails[];
  onTaskClick: (task: TaskWithDetails) => void;
}

export function BacklogPanel({ projectId, projectKey, canManage, tasks, onTaskClick }: BacklogPanelProps) {
  const { data: sprints = [], isLoading } = useSprints(projectId);
  const deleteSprint = useDeleteSprint(projectId);
  const startSprint = useStartSprint(projectId);
  const completeSprint = useCompleteSprint(projectId);
  const updateTask = useUpdateTask();
  const updateTaskRank = useUpdateTaskRank();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);
  const [completingSprint, setCompletingSprint] = useState<Sprint | null>(null);
  const [moveTo, setMoveTo] = useState<string>('backlog');

  const activeSprint = sprints.find((s) => s.status === 'active');
  const plannedSprints = sprints
    .filter((s) => s.status === 'planned')
    .sort((a, b) => a.display_order - b.display_order);
  const completedSprints = sprints
    .filter((s) => s.status === 'completed')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));

  const sortByBacklogRank = (list: TaskWithDetails[]) =>
    [...list].sort((a, b) => {
      const ra = a.backlog_rank ?? Infinity;
      const rb = b.backlog_rank ?? Infinity;
      if (ra !== rb) return ra - rb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const tasksBySprint = useMemo(() => {
    const map = new Map<string, TaskWithDetails[]>();
    for (const task of tasks) {
      if (!task.sprint_id) continue;
      const list = map.get(task.sprint_id) ?? [];
      list.push(task);
      map.set(task.sprint_id, list);
    }
    for (const [key, list] of map) map.set(key, sortByBacklogRank(list));
    return map;
  }, [tasks]);

  const backlogTasks = useMemo(
    () => sortByBacklogRank(tasks.filter((t) => !t.sprint_id)),
    [tasks]
  );

  const getListFor = (droppableId: string) =>
    droppableId === BACKLOG_DROPPABLE ? backlogTasks : (tasksBySprint.get(sprintIdFromDroppable(droppableId)!) ?? []);

  const handleCreate = () => {
    setSelectedSprint(null);
    setDialogOpen(true);
  };

  const handleEdit = (sprint: Sprint) => {
    setSelectedSprint(sprint);
    setDialogOpen(true);
  };

  const handleDelete = (sprint: Sprint) => {
    if (!confirm(`¿Eliminar el sprint "${sprint.name}"? Sus tareas volverán al backlog.`)) return;
    deleteSprint.mutate(sprint.id);
  };

  const handleComplete = (sprint: Sprint) => {
    setMoveTo('backlog');
    setCompletingSprint(sprint);
  };

  const confirmComplete = () => {
    if (!completingSprint) return;
    completeSprint.mutate(
      { sprintId: completingSprint.id, moveTo },
      { onSuccess: () => setCompletingSprint(null) }
    );
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const destList = getListFor(destination.droppableId).filter((t) => t.id !== draggableId);
    const prev = destList[destination.index - 1] ?? null;
    const next = destList[destination.index] ?? null;
    const destSprintId = sprintIdFromDroppable(destination.droppableId);
    const sameGroup = destination.droppableId === source.droppableId;

    const rankArgs = {
      taskId: draggableId,
      projectId,
      list: 'backlog' as const,
      prev_task_id: prev?.id ?? null,
      next_task_id: next?.id ?? null,
    };

    if (sameGroup) {
      updateTaskRank.mutate(rankArgs);
      return;
    }

    updateTask.mutate(
      { id: draggableId, project_id: projectId, sprint_id: destSprintId },
      { onSuccess: () => updateTaskRank.mutate(rankArgs) }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">Cargando backlog...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo sprint
          </Button>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-3">
          {activeSprint && (
            <SprintSection
              droppableId={sprintDroppableId(activeSprint.id)}
              title={activeSprint.name}
              sprint={activeSprint}
              tasks={tasksBySprint.get(activeSprint.id) ?? []}
              projectKey={projectKey}
              canManage={canManage}
              defaultExpanded
              hasActiveSprint={!!activeSprint}
              onTaskClick={onTaskClick}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStart={(s) => startSprint.mutate(s.id)}
              onComplete={handleComplete}
            />
          )}

          {plannedSprints.map((sprint) => (
            <SprintSection
              key={sprint.id}
              droppableId={sprintDroppableId(sprint.id)}
              title={sprint.name}
              sprint={sprint}
              tasks={tasksBySprint.get(sprint.id) ?? []}
              projectKey={projectKey}
              canManage={canManage}
              defaultExpanded={false}
              hasActiveSprint={!!activeSprint}
              onTaskClick={onTaskClick}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStart={(s) => startSprint.mutate(s.id)}
              onComplete={handleComplete}
            />
          ))}

          <SprintSection
            droppableId={BACKLOG_DROPPABLE}
            title="Backlog (sin sprint)"
            tasks={backlogTasks}
            projectKey={projectKey}
            canManage={canManage}
            defaultExpanded
            onTaskClick={onTaskClick}
          />

          {completedSprints.map((sprint) => (
            <SprintSection
              key={sprint.id}
              droppableId={sprintDroppableId(sprint.id)}
              title={sprint.name}
              sprint={sprint}
              tasks={tasksBySprint.get(sprint.id) ?? []}
              projectKey={projectKey}
              canManage={canManage}
              defaultExpanded={false}
              onTaskClick={onTaskClick}
            />
          ))}

          {sprints.length === 0 && (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                No hay sprints en este proyecto. Crea uno para empezar a planificar.
              </CardContent>
            </Card>
          )}
        </div>
      </DragDropContext>

      <CreateSprintDialog
        projectId={projectId}
        sprint={selectedSprint}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedSprint(null);
        }}
      />

      <Dialog open={!!completingSprint} onOpenChange={(open) => !open && setCompletingSprint(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Completar sprint</DialogTitle>
            <DialogDescription>
              Las tareas incompletas de "{completingSprint?.name}" se moverán a donde elijas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Mover tareas incompletas a</Label>
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backlog">Backlog</SelectItem>
                {plannedSprints
                  .filter((s) => s.id !== completingSprint?.id)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCompletingSprint(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmComplete} disabled={completeSprint.isPending}>
              {completeSprint.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Completar sprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
