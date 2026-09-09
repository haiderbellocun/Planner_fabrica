import { TaskWithDetails } from '@/hooks/useTasks';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar, Tag, ListChecks } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { parseDateOnly } from '@/lib/dates';
import { getBusinessTodayStr, getDueBucket } from '@/lib/dueDate';
import { EpicBadge } from '@/components/epics/EpicBadge';
import { TeamBadge } from '@/components/teams/TeamBadge';

interface TaskCardProps {
  task: TaskWithDetails & {
    epic?: { id: string; title: string; color: string } | null;
    team?: { id: string; name: string; color: string } | null;
  };
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
  const dueBucket = getDueBucket(task.due_date, !!task.status?.is_completed, getBusinessTodayStr());

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

      {(task.epic || task.team) && (
        <div className="flex items-center gap-1 mb-1 flex-wrap">
          {task.epic && <EpicBadge epic={task.epic} />}
          {task.team && <TeamBadge team={task.team} />}
        </div>
      )}

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
          {!!task.subtask_count && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ListChecks className="h-3 w-3" />
              <span>{task.subtask_completed_count ?? 0}/{task.subtask_count}</span>
            </div>
          )}
          {task.due_date && (
            <div className={cn(
              'flex items-center gap-1 text-xs',
              dueBucket === 'overdue' ? 'text-red-600 font-medium' : dueBucket === 'due_today' ? 'text-amber-700 font-medium' : 'text-muted-foreground',
            )}>
              <Calendar className="h-3 w-3" />
              <span>
                {dueBucket === 'due_today' ? 'Vence hoy' : (() => {
                  const d = parseDateOnly(task.due_date);
                  return d ? format(d, 'd MMM', { locale: es }) : null;
                })()}
              </span>
            </div>
          )}
        </div>

        {task.assignee && (
          <div className="flex items-center gap-2 max-w-[55%] justify-end">
            <Avatar className="h-6 w-6 flex-shrink-0">
              <AvatarImage src={task.assignee.avatar_url || undefined} />
              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                {getInitials(task.assignee.full_name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">
              {task.assignee.full_name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
