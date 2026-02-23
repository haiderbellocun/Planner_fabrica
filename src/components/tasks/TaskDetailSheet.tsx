import { TaskWithDetails, useTask, useTaskHistory, useTaskActivityLog, useTaskStatuses } from '@/hooks/useTasks';
import { useTaskComments, useCreateTaskComment, useDeleteTaskComment } from '@/hooks/useTaskComments';
import { useUpdateTemaAssignees, TemaAssignment } from '@/hooks/useTemaAssignees';
import { useUpdateMaterialAssignees, MaterialAssignment } from '@/hooks/useMaterialAssignees';
import { useTiempoTarea } from '@/hooks/useTiemposEstimados';
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
  // Fetch full task details with temas_materiales
  const { data: fullTask } = useTask(task?.id);
  const { data: history = [] } = useTaskHistory(task?.id);
  const { data: activity = [] } = useTaskActivityLog(task?.id);
  const { data: statuses = [] } = useTaskStatuses();
  const { data: profiles = [] } = useProfiles();
  const { data: project } = useProject(task?.project_id);
  const { data: comments = [] } = useTaskComments(task?.id);
  const { user } = useAuth();
  const updateTask = useUpdateTask();
  const updateTemaAssignees = useUpdateTemaAssignees();
  const updateMaterialAssignees = useUpdateMaterialAssignees();
  const createComment = useCreateTaskComment(task?.id || '');
  const deleteComment = useDeleteTaskComment(task?.id || '');
  const [newComment, setNewComment] = useState('');
  const { data: tiempoTarea } = useTiempoTarea(task?.id);

  // Use full task data if available, otherwise fall back to prop
  const taskData = fullTask || task;

  // Handle tema assignee change
  const handleTemaAssigneeChange = (temaId: string, assigneeId: string | null) => {
    if (!taskData?.id || !taskData?.temas_materiales) return;

    // Build assignments array for all temas
    const assignments: TemaAssignment[] = taskData.temas_materiales.map(tema => ({
      tema_id: tema.id,
      assignee_id: tema.id === temaId ? assigneeId : tema.assignee?.id || null,
    }));

    updateTemaAssignees.mutate({
      taskId: taskData.id,
      assignments,
    });
  };

  // Collect all material assignments preserving existing data
  const collectAssignments = (overrides?: { materialId: string; assigneeId?: string | null; horas_estimadas?: number | null }) => {
    const assignments: MaterialAssignment[] = [];
    taskData?.temas_materiales?.forEach((tema: any) => {
      if (tema.materiales) {
        tema.materiales.forEach((mat: any) => {
          const isTarget = overrides && mat.id === overrides.materialId;
          assignments.push({
            material_id: mat.id,
            assignee_id: isTarget && overrides.assigneeId !== undefined ? overrides.assigneeId : mat.assignee?.id || null,
            horas_estimadas: isTarget && overrides.horas_estimadas !== undefined ? overrides.horas_estimadas : mat.horas_estimadas || null,
          });
        });
      }
    });
    return assignments;
  };

  // Handle material assignee change
  const handleMaterialAssigneeChange = (materialId: string, assigneeId: string | null) => {
    if (!taskData?.id || !taskData?.temas_materiales) return;

    // When changing assignee, reset horas_estimadas since cargo may differ
    const assignments = collectAssignments({ materialId, assigneeId, horas_estimadas: null });

    updateMaterialAssignees.mutate({
      taskId: taskData.id,
      assignments,
    });
  };

  // Handle material duration change
  const handleMaterialHorasChange = (materialId: string, horas: number | null) => {
    if (!taskData?.id || !taskData?.temas_materiales) return;

    const assignments = collectAssignments({ materialId, horas_estimadas: horas });

    updateMaterialAssignees.mutate({
      taskId: taskData.id,
      assignments,
    });
  };

  if (!taskData) return null;

  // Check if user can change assignee: admin or project leader of this specific project
  const canChangeAssignee = user?.role === 'admin' ||
    project?.members?.some(
      (member) => member.user_id === user?.profileId && member.role === 'leader'
    );

  const priorityInfo = priorityConfig[taskData.priority];

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
    updateTask.mutate({ id: taskData.id, status_id: statusId });
  };

  const handleAssigneeChange = (assigneeId: string) => {
    updateTask.mutate({ id: taskData.id, assignee_id: assigneeId || null });
  };

  // Check which status transitions are allowed for current user
  const isAdminOrLeader = user?.role === 'admin' ||
    project?.members?.some(
      (member) => member.user_id === user?.profileId && member.role === 'leader'
    );

  const getAllowedStatuses = () => {
    if (isAdminOrLeader) {
      // Admin and leaders can change to any status
      return statuses;
    }

    // Normal users can only make specific transitions
    const currentStatusName = taskData.status?.name;
    const allowedTransitions: Record<string, string[]> = {
      'Sin iniciar': ['En proceso'],
      'En proceso': ['En revisión'],
      'Ajustes': ['En revisión'],
    };

    const allowedNext = allowedTransitions[currentStatusName || ''] || [];

    // Always include current status + allowed next statuses
    return statuses.filter(
      (status) => status.id === taskData.status_id || allowedNext.includes(status.name)
    );
  };

  const allowedStatuses = getAllowedStatuses();

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
              {projectKey}-{taskData.task_number}
            </span>
            <Badge className={cn('text-xs', priorityInfo.className)}>
              {priorityInfo.label}
            </Badge>
          </div>
          <SheetTitle className="text-left">{taskData.title}</SheetTitle>
          <SheetDescription className="text-left">
            {taskData.description || 'Sin descripción'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status and Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={taskData.status_id} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedStatuses.map((status) => (
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
              {!isAdminOrLeader && allowedStatuses.length <= 2 && (
                <p className="text-xs text-muted-foreground">
                  Transiciones limitadas desde "{taskData.status?.name}"
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Responsable</label>
              <Select
                value={taskData.assignee_id || 'unassigned'}
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
            {taskData.due_date && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Vence: {format(new Date(taskData.due_date), 'd MMM yyyy', { locale: es })}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Creada: {formatDistanceToNow(new Date(taskData.created_at), { addSuffix: true, locale: es })}
              </span>
            </div>
          </div>

          <Separator />

          {/* Current Status Time */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Estado Actual
            </h4>
            <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: taskData.status?.color }}
                />
                <span className="font-medium">{taskData.status?.name}</span>
              </div>
              <span className="text-sm font-mono text-muted-foreground">
                {formatDurationSeconds(currentStatusTime)}
              </span>
            </div>
          </div>

          {/* Academic Information */}
          {(taskData.programa || taskData.asignatura || taskData.temas_materiales) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Información Académica
                </h4>
                <div className="space-y-2">
                  {taskData.programa && (
                    <div className="py-2 px-3 rounded-lg bg-secondary/30">
                      <div className="text-xs text-muted-foreground mb-1">Programa</div>
                      <div className="text-sm font-medium">
                        {taskData.programa.name}
                        {taskData.programa.code && ` (${taskData.programa.code})`}
                        {taskData.programa.tipo_programa && (
                          <span className="ml-2 text-xs text-muted-foreground capitalize">
                            - {taskData.programa.tipo_programa}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {taskData.asignatura && (
                    <div className="py-2 px-3 rounded-lg bg-secondary/30">
                      <div className="text-xs text-muted-foreground mb-1">Asignatura</div>
                      <div className="text-sm font-medium">
                        {taskData.asignatura.name}
                        {taskData.asignatura.code && ` (${taskData.asignatura.code})`}
                        {taskData.asignatura.semestre && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            - Semestre {taskData.asignatura.semestre}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Show all temas and materiales */}
                  {taskData.temas_materiales && taskData.temas_materiales.length > 0 && (
                    <div className="py-2 px-3 rounded-lg bg-secondary/30">
                      <div className="text-xs text-muted-foreground mb-2">Temas y Materiales a Elaborar</div>
                      <div className="space-y-3">
                        {taskData.temas_materiales.map((tema) => (
                          <div key={tema.id} className="space-y-2">
                            <div className="text-sm font-semibold text-primary flex items-center gap-2">
                              <span>📚</span>
                              {tema.title}
                            </div>

                            {/* Assignee selector for tema (only for project leaders) */}
                            {canChangeAssignee && (
                              <div className="ml-6 mb-2">
                                <Select
                                  value={tema.assignee?.id || 'unassigned'}
                                  onValueChange={(value) => handleTemaAssigneeChange(tema.id, value === 'unassigned' ? null : value)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Asignar responsable del tema">
                                      {tema.assignee ? (
                                        <div className="flex items-center gap-2">
                                          <User className="h-3 w-3" />
                                          <span>{tema.assignee.full_name}</span>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground">Sin asignar</span>
                                      )}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                                    {profiles.map((profile) => (
                                      <SelectItem key={profile.id} value={profile.id}>
                                        {profile.full_name}{profile.cargo ? ` - ${profile.cargo}` : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {/* Show assigned user (read-only for normal users) */}
                            {!canChangeAssignee && tema.assignee && (
                              <div className="ml-6 mb-2 text-xs text-muted-foreground flex items-center gap-2">
                                <User className="h-3 w-3" />
                                <span>Responsable: {tema.assignee.full_name}</span>
                              </div>
                            )}

                            {tema.materiales && tema.materiales.length > 0 ? (
                              <div className="ml-6 space-y-2">
                                {tema.materiales.map((material: any) => (
                                  <div key={material.id} className="space-y-1">
                                    <div className="text-sm text-foreground/80 flex items-start gap-2">
                                      <span>{material.material_type.icon}</span>
                                      <span>
                                        {material.material_type.name}
                                        {material.descripcion && (
                                          <span className="text-muted-foreground text-xs"> - {material.descripcion}</span>
                                        )}
                                      </span>
                                    </div>

                                    {/* Material assignee selector (for project leaders) */}
                                    {canChangeAssignee && (
                                      <div className="ml-6 flex items-center gap-2">
                                        <Select
                                          value={material.assignee?.id || 'unassigned'}
                                          onValueChange={(value) => handleMaterialAssigneeChange(material.id, value === 'unassigned' ? null : value)}
                                        >
                                          <SelectTrigger className="h-7 text-xs flex-1">
                                            <SelectValue placeholder="Asignar responsable">
                                              {material.assignee ? (
                                                <div className="flex items-center gap-1">
                                                  <User className="h-3 w-3" />
                                                  <span>{material.assignee.full_name}</span>
                                                </div>
                                              ) : (
                                                <span className="text-muted-foreground">Sin asignar</span>
                                              )}
                                            </SelectValue>
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="unassigned">Sin asignar</SelectItem>
                                            {profiles.map((profile: any) => (
                                              <SelectItem key={profile.id} value={profile.id}>
                                                {profile.full_name}{profile.cargo ? ` - ${profile.cargo}` : ''}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>

                                        {/* Duration selector - shown when material has an assignee */}
                                        {material.assignee && (() => {
                                          const estimation = tiempoTarea?.material_assignee_estimations?.find(
                                            (ma) => ma.assignee_id === material.assignee?.id &&
                                              ma.material_type === material.material_type.name
                                          );
                                          const tiempos = estimation?.tiempos_disponibles || [];
                                          return tiempos.length > 0 ? (
                                            <Select
                                              value={material.horas_estimadas != null ? String(Number(material.horas_estimadas)) : 'none'}
                                              onValueChange={(value) => handleMaterialHorasChange(material.id, value === 'none' ? null : parseFloat(value))}
                                            >
                                              <SelectTrigger className="h-7 text-xs w-[130px]">
                                                <SelectValue placeholder="Duración">
                                                  {material.horas_estimadas != null ? (
                                                    <div className="flex items-center gap-1">
                                                      <Clock className="h-3 w-3" />
                                                      <span>{Number(material.horas_estimadas)}h</span>
                                                    </div>
                                                  ) : (
                                                    <span className="text-muted-foreground">Duración</span>
                                                  )}
                                                </SelectValue>
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="none">Sin asignar</SelectItem>
                                                {tiempos.map((t) => (
                                                  <SelectItem key={t.id} value={String(Number(t.horas))}>
                                                    {t.cantidad_descripcion} — {Number(t.horas)}h
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          ) : null;
                                        })()}
                                      </div>
                                    )}

                                    {/* Show assigned user and duration (read-only for normal users) */}
                                    {!canChangeAssignee && material.assignee && (
                                      <div className="ml-6 text-xs text-muted-foreground flex items-center gap-2">
                                        <User className="h-3 w-3" />
                                        <span>{material.assignee.full_name}</span>
                                        {material.horas_estimadas != null && (
                                          <Badge variant="outline" className="text-xs py-0 px-1.5">
                                            <Clock className="h-3 w-3 mr-1" />
                                            {Number(material.horas_estimadas)}h
                                          </Badge>
                                        )}
                                      </div>
                                    )}

                                    {/* Show duration badge for admins too (next to the selectors) */}
                                    {canChangeAssignee && material.assignee && material.horas_estimadas != null && (() => {
                                      const estimation = tiempoTarea?.material_assignee_estimations?.find(
                                        (ma) => ma.assignee_id === material.assignee?.id &&
                                          ma.material_type === material.material_type.name
                                      );
                                      const tiempos = estimation?.tiempos_disponibles || [];
                                      // If no tiempos available, show the saved value as a badge
                                      return tiempos.length === 0 ? (
                                        <div className="ml-6">
                                          <Badge variant="outline" className="text-xs py-0 px-1.5">
                                            <Clock className="h-3 w-3 mr-1" />
                                            {Number(material.horas_estimadas)}h
                                          </Badge>
                                        </div>
                                      ) : null;
                                    })()}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="ml-6 text-xs text-muted-foreground italic">
                                Sin materiales en este tema
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

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
