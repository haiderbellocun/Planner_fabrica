import { TaskWithDetails, useTaskHistory, useTaskActivityLog, useTaskStatuses } from '@/hooks/useTasks';
import { useTaskComments, useCreateTaskComment, useDeleteTaskComment } from '@/hooks/useTaskComments';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { format, formatDistanceToNow, formatDuration, intervalToDuration } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Calendar, User, Tag, ArrowRight, History, MessageSquare, Trash2, Send } from 'lucide-react';
import { useUpdateTask } from '@/hooks/useTasks';
import { useProfiles } from '@/hooks/useProfiles';
import { useProject } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { parseDateOnly } from '@/lib/dates';
import { useState } from 'react';

interface TaskDetailSheetProps {
  task: TaskWithDetails | null;
  projectKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityConfig = {
  low: { label: 'Baja', className: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Media', className: 'bg-amber-100 text-amber-700' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgente', className: 'bg-red-100 text-red-700' },
};

export function TaskDetailSheet({ task, projectKey, open, onOpenChange }: TaskDetailSheetProps) {
  const { data: history = [] } = useTaskHistory(task?.id);
  const { data: activity = [] } = useTaskActivityLog(task?.id);
  const { data: statuses = [] } = useTaskStatuses();
  const { data: profiles = [] } = useProfiles();
  const { data: project } = useProject(task?.project_id);
  const { data: comments = [] } = useTaskComments(task?.id);
  const { user } = useAuth();
  const updateTask = useUpdateTask();
  const createComment = useCreateTaskComment(task?.id || '');
  const deleteComment = useDeleteTaskComment(task?.id || '');
  const [newComment, setNewComment] = useState('');

  if (!task) return null;

  // Check if user can change assignee: admin or project leader of this specific project
  const canChangeAssignee = user?.role === 'admin' ||
    project?.members?.some(
      (member) => member.user_id === user?.profileId && member.role === 'leader'
    );

  const priorityInfo = priorityConfig[task.priority];

  const formatDurationSeconds = (seconds: number | null) => {
    if (!seconds) return '-';
    const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
    
    const parts = [];
    if (duration.days) parts.push(`${duration.days}d`);
    if (duration.hours) parts.push(`${duration.hours}h`);
    if (duration.minutes) parts.push(`${duration.minutes}m`);
    if (duration.seconds && !duration.days && !duration.hours) parts.push(`${duration.seconds}s`);
    
    return parts.length > 0 ? parts.join(' ') : '< 1s';
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleStatusChange = (statusId: string) => {
    updateTask.mutate({ id: task.id, status_id: statusId });
  };

  const handleAssigneeChange = (assigneeId: string) => {
    updateTask.mutate({ id: task.id, assignee_id: assigneeId || null });
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      createComment.mutate(newComment, {
        onSuccess: () => {
          setNewComment('');
        },
      });
    }
  };

  const handleDeleteComment = (commentId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este comentario?')) {
      deleteComment.mutate(commentId);
    }
  };

  // Calculate total time in each status
  const timeByStatus = history.reduce((acc: Record<string, number>, entry: any) => {
    if (entry.duration_seconds && entry.from_status) {
      const statusName = entry.from_status.name;
      acc[statusName] = (acc[statusName] || 0) + entry.duration_seconds;
    }
    return acc;
  }, {});

  // Calculate current status time
  const currentStatusEntry = history.find((h: any) => !h.ended_at);
  const currentStatusTime = currentStatusEntry
    ? Math.floor((Date.now() - new Date(currentStatusEntry.started_at).getTime()) / 1000)
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-mono">
              {projectKey}-{task.task_number}
            </span>
            <Badge className={cn('text-xs', priorityInfo.className)}>
              {priorityInfo.label}
            </Badge>
          </div>
          <SheetTitle className="text-left">{task.title}</SheetTitle>
          <SheetDescription className="text-left">
            {task.description || 'Sin descripción'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status and Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={task.status_id} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        {status.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Responsable</label>
              <Select
                value={task.assignee_id || 'unassigned'}
                onValueChange={(v) => handleAssigneeChange(v === 'unassigned' ? '' : v)}
                disabled={!canChangeAssignee}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Sin asignar</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name || profile.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!canChangeAssignee && (
                <p className="text-xs text-muted-foreground">
                  Solo administradores y líderes de proyecto pueden cambiar el responsable
                </p>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="flex flex-wrap gap-4 text-sm">
            {task.due_date && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  Vence:{' '}
                  {(() => {
                    const d = parseDateOnly(task.due_date);
                    return d ? format(d, 'd MMM yyyy', { locale: es }) : null;
                  })()}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Creada: {formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: es })}
              </span>
            </div>
          </div>

          <Separator />

          {/* Time Tracking Summary */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tiempo por Estado
            </h4>
            <div className="space-y-2">
              {statuses.map((status) => {
                const time = status.name === task.status?.name
                  ? (timeByStatus[status.name] || 0) + currentStatusTime
                  : timeByStatus[status.name] || 0;
                
                return (
                  <div
                    key={status.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="text-sm">{status.name}</span>
                      {status.name === task.status?.name && (
                        <Badge variant="outline" className="text-xs">Actual</Badge>
                      )}
                    </div>
                    <span className="text-sm font-mono text-muted-foreground">
                      {formatDurationSeconds(time)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* History Tabs */}
          <Tabs defaultValue="history" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="history">Historial de Estados</TabsTrigger>
              <TabsTrigger value="activity">Actividad</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-4 space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin historial de cambios
                </p>
              ) : (
                history.map((entry: any) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 py-2 px-3 rounded-lg bg-secondary/30"
                  >
                    <History className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.from_status ? (
                          <>
                            <Badge variant="outline" className="text-xs">
                              {entry.from_status.name}
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Creada como</span>
                        )}
                        <Badge
                          className="text-xs"
                          style={{
                            backgroundColor: `${entry.to_status?.color}20`,
                            color: entry.to_status?.color,
                            borderColor: entry.to_status?.color,
                          }}
                        >
                          {entry.to_status?.name}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>
                          {format(new Date(entry.started_at), "d MMM 'a las' HH:mm", { locale: es })}
                        </span>
                        {entry.duration_seconds && (
                          <>
                            <span>•</span>
                            <span>Duración: {formatDurationSeconds(entry.duration_seconds)}</span>
                          </>
                        )}
                      </div>
                      {entry.changed_by_profile && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <span>Por: {entry.changed_by_profile.full_name || 'Usuario'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-4 space-y-3">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin actividad registrada
                </p>
              ) : (
                activity.map((entry: any) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 py-2 px-3 rounded-lg bg-secondary/30"
                  >
                    <Avatar className="h-6 w-6 flex-shrink-0">
                      <AvatarImage src={entry.performed_by_profile?.avatar_url} />
                      <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                        {getInitials(entry.performed_by_profile?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">
                          {entry.performed_by_profile?.full_name || 'Usuario'}
                        </span>{' '}
                        <span className="text-muted-foreground">
                          {entry.action === 'task_created' && 'creó la tarea'}
                          {entry.action === 'status_changed' && (
                            <>cambió el estado de "{entry.old_value}" a "{entry.new_value}"</>
                          )}
                          {entry.action === 'assigned' && 'asignó la tarea'}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                  </div>
                ))
              )}

              {/* Comentarios Section */}
              <Separator className="my-4" />
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Comentarios
                </h4>

                {/* Comment input */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Escribe un comentario..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[80px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || createComment.isPending}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Comentar
                    </Button>
                  </div>
                </div>

                {/* Comments list */}
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay comentarios aún
                  </p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="flex items-start gap-3 py-2 px-3 rounded-lg bg-secondary/30"
                      >
                        <Avatar className="h-6 w-6 flex-shrink-0">
                          <AvatarImage src={comment.user?.avatar_url} />
                          <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                            {getInitials(comment.user?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {comment.user?.full_name || 'Usuario'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: es })}
                              </p>
                            </div>
                            {(comment.user_id === user?.profileId || user?.role === 'admin') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <p className="text-sm mt-2 whitespace-pre-wrap break-words">
                            {comment.comment}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
