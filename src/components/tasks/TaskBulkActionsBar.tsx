import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useTaskStatuses, useBulkUpdateTasks, type TaskWithDetails } from '@/hooks/useTasks';
import { useProfiles } from '@/hooks/useProfiles';
import { useSprints } from '@/hooks/useSprints';
import { ALLOWED_STATUS_TRANSITIONS } from '@/lib/taskStatusTransitions';

interface TaskBulkActionsBarProps {
  projectId: string;
  selectedTasks: TaskWithDetails[];
  isDesarrollo?: boolean;
  isAdminOrLeader: boolean;
  onClearSelection: () => void;
}

export function TaskBulkActionsBar({
  projectId,
  selectedTasks,
  isDesarrollo,
  isAdminOrLeader,
  onClearSelection,
}: TaskBulkActionsBarProps) {
  const { data: statuses = [] } = useTaskStatuses();
  const { data: profiles = [] } = useProfiles();
  const { data: sprints = [] } = useSprints(projectId);
  const bulkUpdate = useBulkUpdateTasks();
  // Bumped after every apply so the three Selects reset to their placeholder
  // instead of appearing to "remember" the last picked value -- a mixed
  // selection has no single current value to show.
  const [applyNonce, setApplyNonce] = useState(0);

  const taskIds = useMemo(() => selectedTasks.map((t) => t.id), [selectedTasks]);
  const selectKey = `${taskIds.join(',')}-${applyNonce}`;

  const commonNextStatusIds = useMemo(() => {
    if (selectedTasks.length === 0) return [];
    if (isAdminOrLeader) return statuses.map((s) => s.id);
    const perTaskAllowed = selectedTasks.map((t) => {
      const allowedNext = ALLOWED_STATUS_TRANSITIONS[t.status?.name || ''] || [];
      return new Set(statuses.filter((s) => allowedNext.includes(s.name)).map((s) => s.id));
    });
    return statuses.map((s) => s.id).filter((id) => perTaskAllowed.every((set) => set.has(id)));
  }, [selectedTasks, statuses, isAdminOrLeader]);

  const applyStatus = (statusId: string) => {
    bulkUpdate.mutate({ project_id: projectId, task_ids: taskIds, status_id: statusId });
    setApplyNonce((n) => n + 1);
  };

  const applyAssignee = (value: string) => {
    bulkUpdate.mutate({ project_id: projectId, task_ids: taskIds, assignee_id: value === 'unassigned' ? null : value });
    setApplyNonce((n) => n + 1);
  };

  const applySprint = (value: string) => {
    bulkUpdate.mutate({ project_id: projectId, task_ids: taskIds, sprint_id: value === 'none' ? null : value });
    setApplyNonce((n) => n + 1);
  };

  if (selectedTasks.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-2.5">
      <span className="text-sm font-medium">
        {selectedTasks.length} tarea{selectedTasks.length === 1 ? '' : 's'} seleccionada{selectedTasks.length === 1 ? '' : 's'}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-col gap-1">
          <Select key={`status-${selectKey}`} onValueChange={applyStatus} disabled={commonNextStatusIds.length === 0 || bulkUpdate.isPending}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue placeholder="Cambiar estado..." />
            </SelectTrigger>
            <SelectContent>
              {statuses.filter((s) => commonNextStatusIds.includes(s.id)).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {commonNextStatusIds.length === 0 && (
            <p className="text-xs text-muted-foreground">Ningún estado común disponible para esta selección</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Select key={`assignee-${selectKey}`} onValueChange={applyAssignee} disabled={!isAdminOrLeader || bulkUpdate.isPending}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="Cambiar responsable..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Sin asignar</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || 'Usuario'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isAdminOrLeader && (
            <p className="text-xs text-muted-foreground">Solo administradores y líderes de proyecto pueden cambiar el responsable</p>
          )}
        </div>

        {isDesarrollo && (
          <Select key={`sprint-${selectKey}`} onValueChange={applySprint} disabled={bulkUpdate.isPending}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue placeholder="Cambiar sprint..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin sprint</SelectItem>
              {sprints.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Button variant="ghost" size="sm" className="ml-auto gap-1.5" onClick={onClearSelection}>
        <X className="h-3.5 w-3.5" />
        Limpiar selección
      </Button>
    </div>
  );
}
