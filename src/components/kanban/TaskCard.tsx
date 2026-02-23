import { TaskWithDetails } from '@/hooks/useTasks';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: TaskWithDetails;
  projectKey: string;
  onClick: () => void;
  isDragging?: boolean;
}

const priorityConfig = {
  low: { label: 'Baja', className: 'priority-low' },
  medium: { label: 'Media', className: 'priority-medium' },
  high: { label: 'Alta', className: 'priority-high' },
  urgent: { label: 'Urgente', className: 'priority-urgent' },
};

export function TaskCard({ task, projectKey, onClick, isDragging }: TaskCardProps) {
  const priorityInfo = priorityConfig[task.priority];

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'task-card animate-fade-in',
        isDragging && 'task-card-dragging'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs text-muted-foreground font-mono">
          {projectKey}-{task.task_number}
        </span>
        <div className={cn('text-xs font-medium', priorityInfo.className)}>
          {priorityInfo.label}
        </div>
      </div>

      <h4 className="font-medium text-sm mb-2 line-clamp-2">{task.title}</h4>

      {task.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
              <Tag className="h-2.5 w-2.5 mr-1" />
              {tag}
            </Badge>
          ))}
          {task.tags.length > 3 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              +{task.tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.due_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(task.due_date), 'd MMM', { locale: es })}</span>
            </div>
          )}
        </div>

        {task.assignee && (
          <Avatar className="h-6 w-6">
            <AvatarImage src={task.assignee.avatar_url || undefined} />
            <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
              {getInitials(task.assignee.full_name)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
