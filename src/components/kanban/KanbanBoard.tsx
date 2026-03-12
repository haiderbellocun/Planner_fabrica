import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { TaskWithDetails, useTaskStatuses, useUpdateTaskStatus } from '@/hooks/useTasks';
import { TaskStatus } from '@/types/database';
import { TaskCard } from './TaskCard';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface KanbanBoardProps {
  tasks: TaskWithDetails[];
  projectKey: string;
  onTaskClick: (task: TaskWithDetails) => void;
  isLoading?: boolean;
}

export function KanbanBoard({ tasks, projectKey, onTaskClick, isLoading }: KanbanBoardProps) {
  const { user } = useAuth();
  const { data: statuses = [], isLoading: statusesLoading } = useTaskStatuses();
  const updateTaskStatus = useUpdateTaskStatus();

  const getTasksByStatus = (statusId: string) => {
    return tasks.filter((task) => task.status_id === statusId);
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const newStatusId = destination.droppableId;
    updateTaskStatus.mutate({ taskId: draggableId, statusId: newStatusId });
  };

  if (statusesLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px] -mx-8 px-8 items-stretch">
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            tasks={getTasksByStatus(status.id)}
            projectKey={projectKey}
            onTaskClick={onTaskClick}
            userRole={user?.role}
          />
        ))}
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

function KanbanColumn({ status, tasks, projectKey, onTaskClick, userRole }: KanbanColumnProps) {
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
            className={`space-y-2 min-h-[200px] rounded-lg p-1 transition-colors flex-1 ${
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
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <TaskCard
                        task={task}
                        projectKey={projectKey}
                        onClick={() => onTaskClick(task)}
                        isDragging={snapshot.isDragging}
                      />
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
