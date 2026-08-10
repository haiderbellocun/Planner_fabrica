import { TaskWithDetails, useTask, useTaskHistory, useTaskActivityLog, useTaskStatuses } from '@/hooks/useTasks';
import { useTaskComments, useCreateTaskComment, useDeleteTaskComment } from '@/hooks/useTaskComments';
import { useUpdateTemaAssignees, TemaAssignment } from '@/hooks/useTemaAssignees';
import { useUpdateMaterialAssignees, MaterialAssignment } from '@/hooks/useMaterialAssignees';
import { useTiempoTarea } from '@/hooks/useTiemposEstimados';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { useUpdateTask, useUpdateTaskStatus, useDeleteTask } from '@/hooks/useTasks';
import { useProfiles } from '@/hooks/useProfiles';
import { useProject } from '@/hooks/useProjects';
import { useTeams } from '@/hooks/useTeams';
import { useSprints } from '@/hooks/useSprints';
import { TagsEditor } from './TagsEditor';
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

// `profiles` only lists active users (disabled accounts can't be assigned new
// work). If a task is already assigned to someone since disabled, they'd be
// missing from that list and the Select would render blank — so we splice the
// current assignee back in, shown but not re-selectable.
function buildAssigneeOptions(
  profiles: { id: string; full_name: string | null; email: string | null }[],
  current?: { id: string; full_name: string | null; email?: string | null } | null
) {
  const options = profiles.map((p) => ({ id: p.id, label: p.full_name || p.email || 'Usuario', disabled: false }));
  if (current && !profiles.some((p) => p.id === current.id)) {
    options.push({ id: current.id, label: `${current.full_name || current.email || 'Usuario'} (deshabilitado)`, disabled: true });
  }
  return options;
}

export function TaskDetailSheet({ task, projectKey, open, onOpenChange }: TaskDetailSheetProps) {
  // Fetch full task details with temas_materiales
  const { data: fullTask } = useTask(task?.id);
  const { data: history = [] } = useTaskHistory(task?.id);
  const { data: activity = [] } = useTaskActivityLog(task?.id);
  const { data: statuses = [] } = useTaskStatuses();
  const { data: profiles = [] } = useProfiles();
  const { data: project } = useProject(task?.project_id);
  const { data: teams = [] } = useTeams(task?.project_id);
  const { data: sprints = [] } = useSprints(task?.project_id);
  const { data: comments = [] } = useTaskComments(task?.id);
  const { user } = useAuth();
  const updateTask = useUpdateTask();
  const updateTaskStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();
  const updateTemaAssignees = useUpdateTemaAssignees();
  const updateMaterialAssignees = useUpdateMaterialAssignees();
  const createComment = useCreateTaskComment(task?.id || '');
  const deleteComment = useDeleteTaskComment(task?.id || '');
  const [newComment, setNewComment] = useState('');
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
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
    user?.role === 'project_leader' ||
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
    updateTaskStatus.mutate({ taskId: taskData.id, statusId, projectId: taskData.project_id });
  };

  const handleAssigneeChange = (assigneeId: string) => {
    updateTask.mutate({ id: taskData.id, assignee_id: assigneeId || null });
  };

  const isDesarrolloProject = project?.tipo_programa === 'desarrollo';

  const handleTeamChange = (teamId: string) => {
    updateTask.mutate({ id: taskData.id, team_id: teamId || null });
  };

  const handleSprintChange = (sprintId: string) => {
    updateTask.mutate({ id: taskData.id, sprint_id: sprintId || null });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full p-0 overflow-hidden rounded-2xl shadow-2xl" style={{ maxHeight: '88vh' }}>
        <div className="flex h-full" style={{ maxHeight: '88vh' }}>
          {/* ── LEFT PANEL ── */}
          <div
            className="flex flex-col flex-1 overflow-hidden border-r border-border relative"
            style={{
              backgroundImage: 'url(./FONDO_3.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0 bg-white/80 pointer-events-none" />
            {/* Task header */}
            <div className="relative z-10 px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                  {projectKey}-{taskData.task_number}
                </span>
                <Badge className={cn('text-xs', priorityInfo.className)}>{priorityInfo.label}</Badge>
                {user?.role === 'admin' && (
                  <Button
                    variant="ghost" size="icon"
                    className="ml-auto text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7"
                    disabled={deleteTask.isPending}
                    onClick={() => {
                      if (!confirm(`¿Eliminar la tarea "${taskData.title}"?`)) return;
                      deleteTask.mutate({ taskId: taskData.id, projectId: taskData.project_id }, { onSuccess: () => onOpenChange(false) });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <DialogTitle className="text-base font-bold text-foreground leading-snug">
                {user?.role === 'admin' && editingTitle ? (
                  <input
                    type="text"
                    className="w-full border border-border rounded px-2 py-1 text-base font-bold bg-background text-foreground"
                    defaultValue={taskData.title}
                    autoFocus
                    onBlur={(e) => {
                      setEditingTitle(false);
                      const newTitle = e.target.value.trim();
                      if (newTitle && newTitle !== taskData.title) {
                        updateTask.mutate({ id: taskData.id, projectId: taskData.project_id, title: newTitle });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEditingTitle(false);
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                  />
                ) : (
                  <span
                    className={user?.role === 'admin' ? 'cursor-pointer hover:text-primary' : ''}
                    onClick={() => user?.role === 'admin' && setEditingTitle(true)}
                    title={user?.role === 'admin' ? 'Clic para editar el nombre' : undefined}
                  >
                    {taskData.title}
                  </span>
                )}
              </DialogTitle>
              {taskData.description && (
                <DialogDescription className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {taskData.description}
                </DialogDescription>
              )}
            </div>

            {/* Scrollable details */}
            <div className="relative z-10 flex-1 overflow-y-auto px-6 py-5 space-y-5">
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
                  {buildAssigneeOptions(profiles, taskData.assignee).map((opt) => (
                    <SelectItem key={opt.id} value={opt.id} disabled={opt.disabled}>
                      {opt.label}
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

            {isDesarrolloProject && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Equipo</label>
                <Select
                  value={taskData.team_id || 'none'}
                  onValueChange={(v) => handleTeamChange(v === 'none' ? '' : v)}
                  disabled={!canChangeAssignee}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin equipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin equipo</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          {team.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!canChangeAssignee && (
                  <p className="text-xs text-muted-foreground">
                    Solo administradores y líderes de proyecto pueden cambiar el equipo
                  </p>
                )}
              </div>
            )}

            {isDesarrolloProject && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Sprint</label>
                <Select
                  value={taskData.sprint_id || 'none'}
                  onValueChange={(v) => handleSprintChange(v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin sprint" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin sprint (backlog)</SelectItem>
                    {sprints
                      .filter((s) => s.status !== 'completed')
                      .map((sprint) => (
                        <SelectItem key={sprint.id} value={sprint.id}>
                          {sprint.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <TagsEditor taskId={taskData.id} projectId={taskData.project_id} tags={taskData.tags || []} />

          {/* Dates */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {user?.role === 'admin' && editingDueDate ? (
                <input
                  type="date"
                  className="border border-border rounded px-2 py-0.5 text-sm bg-background text-foreground"
                  defaultValue={taskData.due_date ? taskData.due_date.slice(0, 10) : ''}
                  autoFocus
                  onBlur={(e) => {
                    setEditingDueDate(false);
                    if (e.target.value) {
                      updateTask.mutate({ id: taskData.id, projectId: taskData.project_id, due_date: e.target.value });
                    }
                  }}
                  onKeyDown={(e) => e.key === 'Escape' && setEditingDueDate(false)}
                />
              ) : (
                <span
                  className={user?.role === 'admin' ? 'cursor-pointer hover:text-foreground hover:underline' : ''}
                  onClick={() => user?.role === 'admin' && setEditingDueDate(true)}
                  title={user?.role === 'admin' ? 'Clic para editar fecha' : undefined}
                >
                  Vence:{' '}
                  {taskData.due_date
                    ? (() => {
                        const d = parseDateOnly(taskData.due_date);
                        return d ? format(d, 'd MMM yyyy', { locale: es }) : 'Sin fecha';
                      })()
                    : 'Sin fecha'}
                </span>
              )}
            </div>
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
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
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
                                    {buildAssigneeOptions(profiles, tema.assignee).map((opt) => (
                                      <SelectItem key={opt.id} value={opt.id} disabled={opt.disabled}>
                                        {opt.label}
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
                                            {buildAssigneeOptions(profiles, material.assignee).map((opt) => (
                                              <SelectItem key={opt.id} value={opt.id} disabled={opt.disabled}>
                                                {opt.label}
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

            </div>{/* end scrollable details */}
          </div>{/* end LEFT PANEL */}

          {/* ── RIGHT PANEL — activity + comments ── */}
          <div className="w-72 flex-shrink-0 flex flex-col bg-slate-50/60">
            {/* Activity feed */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Actividad</p>

              {activity.length === 0 && comments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Sin actividad</p>
              ) : null}

              {activity.map((entry: any) => (
                <div key={entry.id} className="flex items-start gap-2.5">
                  <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                    <AvatarImage src={entry.performed_by_profile?.avatar_url} />
                    <AvatarFallback className="text-[10px] bg-primary/80 text-white">
                      {getInitials(entry.performed_by_profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug">
                      <span className="font-semibold text-foreground">{entry.performed_by_profile?.full_name || 'Usuario'}</span>{' '}
                      <span className="text-muted-foreground">
                        {entry.action === 'task_created' && 'creó la tarea'}
                        {entry.action === 'status_changed' && <>cambió el estado de "{entry.old_value}" a "{entry.new_value}"</>}
                        {entry.action === 'assigned' && 'asignó la tarea'}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </div>
              ))}

              {comments.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Comentarios</p>
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-2.5">
                      <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                        <AvatarImage src={comment.user?.avatar_url} />
                        <AvatarFallback className="text-[10px] bg-primary/80 text-white">
                          {getInitials(comment.user?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground">{comment.user?.full_name || 'Usuario'}</p>
                          {(comment.user_id === user?.profileId || user?.role === 'admin') && (
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteComment(comment.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: es })}
                        </p>
                        <p className="text-xs mt-1 whitespace-pre-wrap break-words text-foreground/80">{comment.comment}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Comment input — pinned at bottom */}
            <div className="border-t border-border bg-white px-4 py-3 flex-shrink-0">
              <Textarea
                placeholder="Escribe un comentario..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[72px] resize-none text-sm bg-slate-50 border-slate-200"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleAddComment(); }
                }}
              />
              <div className="flex justify-end mt-2">
                <Button size="sm" className="rounded-xl" onClick={handleAddComment} disabled={!newComment.trim() || createComment.isPending}>
                  <Send className="h-3 w-3 mr-1.5" />
                  Comentar
                </Button>
              </div>
            </div>
          </div>{/* end RIGHT PANEL */}

        </div>{/* end flex row */}
      </DialogContent>
    </Dialog>
  );
}
