import { KanbanSkeleton } from '@/components/shared/Skeletons';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { TaskWithDetails, useTaskStatuses, useUpdateTaskStatus, useUpdateTaskRank } from '@/hooks/useTasks';
import { TaskStatus } from '@/types/database';
import { TaskCard } from './TaskCard';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Referencia estable para columnas sin tareas: un `[]` nuevo en cada render anularía la memoización.
const NO_TASKS: TaskWithDetails[] = [];

interface KanbanBoardProps {
  tasks: TaskWithDetails[];
  projectKey: string;
  projectId: string;
  onTaskClick: (task: TaskWithDetails) => void;
  isLoading?: boolean;
}

export function KanbanBoard({ tasks, projectKey, projectId, onTaskClick, isLoading }: KanbanBoardProps) {
  const { user } = useAuth();
  const { data: statuses = [], isLoading: statusesLoading } = useTaskStatuses();
  const updateTaskStatus = useUpdateTaskStatus();
  const updateTaskRank = useUpdateTaskRank();
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const topScrollContentRef = useRef<HTMLDivElement | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScroll = useRef(false);
  // La función que llega por props cambia en cada render del padre; las columnas reciben una versión
  // estable que siempre llama a la última, para que React.memo pueda omitir columnas sin cambios.
  const onTaskClickRef = useRef(onTaskClick);
  onTaskClickRef.current = onTaskClick;
  const stableOnTaskClick = useCallback((task: TaskWithDetails) => onTaskClickRef.current(task), []);

  const tasksByStatus = useMemo(() => {
    const map = new Map<string, TaskWithDetails[]>();
    for (const task of tasks) {
      const list = map.get(task.status_id);
      if (list) list.push(task);
      else map.set(task.status_id, [task]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const ra = a.board_rank ?? Infinity;
        const rb = b.board_rank ?? Infinity;
        if (ra !== rb) return ra - rb;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return map;
  }, [tasks]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const destStatusId = destination.droppableId;
    const sameColumn = destStatusId === source.droppableId;

    // Pausar quita la fecha límite de la tarea (si no, se marca "vencida" mientras
    // está pausada a propósito). Por eso, al sacarla de "En pausa", hace falta una
    // fecha nueva -- eso requiere un selector de fecha que el drag-and-drop no
    // puede mostrar a mitad de un arrastre, así que aquí solo se bloquea el
    // movimiento y se pide abrir la tarea (TaskDetailSheet sí pide la fecha).
    if (!sameColumn) {
      const sourceTask = tasksByStatus.get(source.droppableId)?.find((t) => t.id === draggableId);
      const sourceStatusName = statuses.find((s) => s.id === source.droppableId)?.name;
      const destStatusName = statuses.find((s) => s.id === destStatusId)?.name;
      if (sourceStatusName === 'En pausa' && destStatusName !== 'En pausa' && !sourceTask?.due_date) {
        toast.error('Esta tarea está pausada sin fecha límite. Ábrela y asigna una nueva fecha antes de moverla.');
        return;
      }
    }

    // destination.index is expressed against the list with the dragged card already removed.
    const destList = (tasksByStatus.get(destStatusId) ?? []).filter((t) => t.id !== draggableId);
    const prev = destList[destination.index - 1] ?? null;
    const next = destList[destination.index] ?? null;
    const rankArgs = {
      taskId: draggableId,
      projectId,
      list: 'board' as const,
      prev_task_id: prev?.id ?? null,
      next_task_id: next?.id ?? null,
      statusId: destStatusId,
    };

    if (sameColumn) {
      updateTaskRank.mutate(rankArgs);
      return;
    }

    updateTaskStatus.mutate(
      { taskId: draggableId, statusId: destStatusId, projectId },
      { onSuccess: () => updateTaskRank.mutate(rankArgs) }
    );
  };

  useEffect(() => {
    const top = topScrollRef.current;
    const topContent = topScrollContentRef.current;
    const main = mainScrollRef.current;
    if (!top || !topContent || !main) return;

    const setTopContentWidth = () => {
      topContent.style.width = `${main.scrollWidth}px`;
    };

    setTopContentWidth();

    const ro = new ResizeObserver(() => {
      setTopContentWidth();
    });

    ro.observe(main);
    if (main.firstElementChild) ro.observe(main.firstElementChild);

    const onTopScroll = () => {
      if (syncingScroll.current) return;
      syncingScroll.current = true;
      main.scrollLeft = top.scrollLeft;
      syncingScroll.current = false;
    };

    const onMainScroll = () => {
      if (syncingScroll.current) return;
      syncingScroll.current = true;
      top.scrollLeft = main.scrollLeft;
      syncingScroll.current = false;
    };

    top.addEventListener('scroll', onTopScroll, { passive: true });
    main.addEventListener('scroll', onMainScroll, { passive: true });

    return () => {
      top.removeEventListener('scroll', onTopScroll);
      main.removeEventListener('scroll', onMainScroll);
      ro.disconnect();
    };
  }, [statuses.length]);

  if (statusesLoading || isLoading) {
    return <KanbanSkeleton />;
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="-mx-8 px-8">
        <div
          ref={topScrollRef}
          className="overflow-x-auto overflow-y-hidden h-3 mb-2"
          aria-hidden="true"
        >
          <div ref={topScrollContentRef} className="h-3" />
        </div>

        <div
          ref={mainScrollRef}
          className="flex gap-4 overflow-x-auto pb-4 min-h-[500px] items-stretch"
        >
          {statuses.map((status) => (
            <KanbanColumn
              key={status.id}
              status={status}
              tasks={tasksByStatus.get(status.id) ?? NO_TASKS}
              projectKey={projectKey}
              onTaskClick={stableOnTaskClick}
              userRole={user?.role}
            />
          ))}
        </div>
      </div>
    </DragDropContext>
  );
}

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: TaskWithDetails[];
  projectKey: string;
  onTaskClick: (task: TaskWithDetails) => void;
  userRole?: string;
}

// Memoizada: al cambiar el estado del padre (selección de tarea, filtros de URL…) las columnas cuyas
// tareas no cambiaron no se vuelven a renderizar.
const KanbanColumn = memo(function KanbanColumn({ status, tasks, projectKey, onTaskClick, userRole }: KanbanColumnProps) {
  return (
    <div className="kanban-column flex-shrink-0 w-72 flex flex-col">
      <div className="kanban-column-header">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <span className="font-medium text-sm">{status.name}</span>
        </div>
        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      <Droppable droppableId={status.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            // Fixed max-height ~ 8 average cards; beyond that the column scrolls
            // on its own instead of stretching the whole board page downward.
            className={`space-y-2 min-h-[200px] max-h-[950px] overflow-y-auto rounded-lg p-1 transition-colors flex-1 ${
              snapshot.isDraggingOver ? 'bg-accent/50' : ''
            }`}
          >
            {tasks.map((task, index) => {
              // Disable drag for finalized tasks if user is not admin
              const isDragDisabled = task.status.name === 'Finalizado' && userRole !== 'admin';

              return (
                <Draggable
                  key={task.id}
                  draggableId={task.id}
                  index={index}
                  isDragDisabled={isDragDisabled}
                >
                  {(provided, snapshot) => {
                    const card = (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={snapshot.isDragging ? 'z-[9999]' : undefined}
                      >
                        <TaskCard
                          task={task}
                          projectKey={projectKey}
                          onClick={() => onTaskClick(task)}
                          isDragging={snapshot.isDragging}
                        />
                      </div>
                    );
                    // The column has a backdrop-blur background, which creates a new
                    // containing block for position:fixed elements — that breaks the
                    // library's drag layer positioning. Render the dragged card in a
                    // portal so it escapes that containing block.
                    return snapshot.isDragging ? createPortal(card, document.body) : card;
                  }}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
});
