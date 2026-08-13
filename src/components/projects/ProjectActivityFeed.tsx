import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, MessageSquare, ArrowRight, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useProjectActivity } from '@/hooks/useProjectActivity';

interface ProjectActivityFeedProps {
  projectId: string;
  projectKey: string;
  onTaskClick?: (taskId: string) => void;
}

const getInitials = (name: string | null) => {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

export function ProjectActivityFeed({ projectId, projectKey, onTaskClick }: ProjectActivityFeedProps) {
  const { data: events = [], isLoading } = useProjectActivity(projectId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Todavía no hay actividad en este proyecto.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/40 cursor-pointer"
          onClick={() => onTaskClick?.(event.task.id)}
        >
          <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
            <AvatarImage src={event.actor?.avatar_url || undefined} />
            <AvatarFallback className="text-[10px] bg-primary/80 text-white">
              {getInitials(event.actor?.full_name ?? null)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-snug">
              <span className="font-semibold text-foreground">{event.actor?.full_name || 'Alguien'}</span>{' '}
              <span className="text-muted-foreground">
                {event.type === 'task_created' && (
                  <>
                    <Sparkles className="inline h-3 w-3 mr-1 -mt-0.5" />
                    creó la tarea
                  </>
                )}
                {event.type === 'status_changed' && (
                  <>
                    <ArrowRight className="inline h-3 w-3 mr-1 -mt-0.5" />
                    cambió el estado de "{event.detail.from}" a "{event.detail.to}" en
                  </>
                )}
                {event.type === 'comment' && (
                  <>
                    <MessageSquare className="inline h-3 w-3 mr-1 -mt-0.5" />
                    comentó en
                  </>
                )}
              </span>{' '}
              <span className="font-mono text-xs text-muted-foreground">
                #{projectKey}-{event.task.task_number}
              </span>{' '}
              <span className="text-foreground">{event.task.title}</span>
            </p>
            {event.type === 'comment' && event.detail.comment && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.detail.comment}</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: es })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
