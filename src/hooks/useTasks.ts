import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Task, TaskStatus, Profile } from '@/types/database';
import { TaskFilters, taskFiltersToQuery } from '@/lib/taskFilters';
import { toast } from 'sonner';

export interface TaskWithDetails extends Task {
  status: TaskStatus;
  assignee: Profile | null;
  reporter: Profile | null;
}

export function useTaskStatuses() {
  return useQuery({
    queryKey: ['task-statuses'],
    queryFn: async (): Promise<TaskStatus[]> => {
      const statuses = await api.get<TaskStatus[]>('/api/task-statuses');
      return statuses;
    },
  });
}

export function useTasks(projectId: string | undefined, filters?: TaskFilters) {
  const qs = taskFiltersToQuery(filters);
  return useQuery({
    // No filters -> key identical to before, so every existing caller/invalidation is unaffected.
    queryKey: qs ? ['tasks', projectId, qs] : ['tasks', projectId],
    queryFn: async (): Promise<TaskWithDetails[]> => {
      if (!projectId) return [];
      const tasks = await api.get<TaskWithDetails[]>(`/api/projects/${projectId}/tasks${qs ? `?${qs}` : ''}`);
      if (import.meta.env.DEV) {
        console.log('🔍 useTasks received from API:', {
          projectId,
          tasksCount: tasks.length,
          tasks: tasks.map(t => ({ id: t.id, title: t.title, reporter_id: t.reporter_id })),
        });
      }
      return tasks;
    },
    enabled: !!projectId,
    placeholderData: keepPreviousData,
  });
}

export function useProjectTags(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-tags', projectId],
    queryFn: async (): Promise<string[]> => {
      if (!projectId) return [];
      return api.get<string[]>(`/api/projects/${projectId}/tasks/tags`);
    },
    enabled: !!projectId,
  });
}

export function useTask(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async (): Promise<TaskWithDetails | null> => {
      if (!taskId) return null;
      const task = await api.get<TaskWithDetails>(`/api/tasks/${taskId}`);
      return task;
    },
    enabled: !!taskId,
  });
}

export function useTaskHistory(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-history', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const history = await api.get(`/api/tasks/${taskId}/history`);
      return history;
    },
    enabled: !!taskId,
  });
}

export function useTaskActivityLog(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-activity', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const activity = await api.get(`/api/tasks/${taskId}/activity`);
      return activity;
    },
    enabled: !!taskId,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      project_id: string;
      title: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      assignee_id?: string;
      due_date?: string;
      tags?: string[];
      asignatura_id?: string;
      epic_id?: string;
      team_id?: string;
      horas_estimadas?: number;
    }) => {
      const task = await api.post<Task>(`/api/projects/${data.project_id}/tasks`, data);
      return task;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', variables.project_id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Tarea creada exitosamente');
    },
    onError: (error: any) => {
      toast.error('Error al crear tarea: ' + error.message);
    },
  });
}

export function useCreateSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      parentTaskId,
      projectId,
      title,
      description,
      priority,
      assignee_id,
      due_date,
      horas_estimadas,
    }: {
      parentTaskId: string;
      projectId: string;
      title: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      assignee_id?: string;
      due_date?: string;
      horas_estimadas?: number;
    }) => {
      const task = await api.post<Task>(`/api/tasks/${parentTaskId}/subtasks`, {
        title,
        description,
        priority,
        assignee_id,
        due_date,
        horas_estimadas,
      });
      return { task, parentTaskId, projectId };
    },
    onSuccess: ({ parentTaskId, projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task', parentTaskId] });
      toast.success('Subtarea creada');
    },
    onError: (error: any) => {
      toast.error('Error al crear subtarea: ' + error.message);
    },
  });
}

export function useWatchTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, watching }: { taskId: string; watching: boolean }) => {
      if (watching) {
        await api.post(`/api/tasks/${taskId}/watchers`, {});
      } else {
        await api.delete(`/api/tasks/${taskId}/watchers`);
      }
      return { taskId, watching };
    },
    onSuccess: ({ taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
    onError: (error: any) => {
      toast.error('Error al actualizar seguimiento: ' + error.message);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, project_id, ...data }: Partial<Task> & { id: string; project_id?: string }) => {
      const task = await api.patch<Task>(`/api/tasks/${id}`, data);
      return { ...task, project_id: project_id || task.project_id };
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', task.project_id] });
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
      queryClient.invalidateQueries({ queryKey: ['task-history', task.id] });
      queryClient.invalidateQueries({ queryKey: ['task-activity', task.id] });
    },
    onError: (error: any) => {
      toast.error('Error al actualizar: ' + error.message);
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, statusId, projectId }: { taskId: string; statusId: string; projectId?: string }) => {
      const task = await api.patch<Task>(`/api/tasks/${taskId}/status`, { status_id: statusId });
      return { ...task, project_id: projectId || task.project_id };
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', task.project_id] });
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
      queryClient.invalidateQueries({ queryKey: ['task-history', task.id] });
      toast.success('Estado actualizado');
    },
    onError: (error: any) => {
      toast.error('Error al cambiar estado: ' + error.message);
    },
  });
}

export interface BulkUpdateTasksVars {
  project_id: string;
  task_ids: string[];
  status_id?: string;
  assignee_id?: string | null;
  sprint_id?: string | null;
}

export function useBulkUpdateTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: BulkUpdateTasksVars) => {
      const result = await api.patch<{ updated: number; tasks: Task[] }>('/api/tasks/bulk', vars);
      return { ...result, project_id: vars.project_id };
    },
    onSuccess: ({ updated, project_id }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', project_id] });
      toast.success(`${updated} tarea${updated === 1 ? '' : 's'} actualizada${updated === 1 ? '' : 's'}`);
    },
    onError: (error: any) => {
      toast.error('Error al actualizar tareas: ' + error.message);
    },
  });
}

export interface UpdateTaskRankVars {
  taskId: string;
  projectId: string;
  list?: 'board' | 'backlog';
  prev_task_id: string | null;
  next_task_id: string | null;
  statusId?: string;
}

export function useUpdateTaskRank() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, list, prev_task_id, next_task_id }: UpdateTaskRankVars) =>
      api.patch(`/api/tasks/${taskId}/rank`, { list, prev_task_id, next_task_id }),
    onMutate: async (vars) => {
      const filter = { queryKey: ['tasks', vars.projectId] };
      await queryClient.cancelQueries(filter);
      const snapshot = queryClient.getQueriesData<TaskWithDetails[]>(filter);

      const rankField: 'board_rank' | 'backlog_rank' = vars.list === 'backlog' ? 'backlog_rank' : 'board_rank';
      // Look up the neighbours' current ranks from whatever cached list we have.
      let neighbourPrev: number | null = null;
      let neighbourNext: number | null = null;
      for (const [, tasks] of snapshot) {
        if (!tasks) continue;
        for (const t of tasks) {
          if (vars.prev_task_id && t.id === vars.prev_task_id) neighbourPrev = t[rankField] ?? null;
          if (vars.next_task_id && t.id === vars.next_task_id) neighbourNext = t[rankField] ?? null;
        }
      }
      const newRank =
        neighbourPrev === null && neighbourNext === null
          ? 1000
          : neighbourPrev === null
            ? (neighbourNext as number) - 1000
            : neighbourNext === null
              ? neighbourPrev + 1000
              : (neighbourPrev + neighbourNext) / 2;

      queryClient.setQueriesData<TaskWithDetails[]>(filter, (old) =>
        old?.map((t) =>
          t.id === vars.taskId
            ? { ...t, [rankField]: newRank, ...(vars.statusId ? { status_id: vars.statusId } : {}) }
            : t
        )
      );

      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', vars.projectId] });
    },
  });
}

export type MyTaskWithProject = TaskWithDetails & { project: { id: string; name: string; key: string } };

export function useMyTasks() {
  const query = useQuery({
    queryKey: ['my-tasks'],
    queryFn: async (): Promise<MyTaskWithProject[]> => {
      return await api.get('/api/my-tasks');
    },
  });
  const tasks: MyTaskWithProject[] = query.data ?? [];
  return { ...query, tasks };
}

export interface LeadersFocusTask {
  id: string;
  title: string;
  due_date: string;
  status: { name: string; color: string; is_completed: boolean };
  assignee: { full_name: string | null; email: string | null; cargo: string | null };
  project: { id: string; name: string; key: string };
}

export function useLeadersFocus(enabled: boolean) {
  return useQuery({
    queryKey: ['leaders-focus'],
    queryFn: async (): Promise<LeadersFocusTask[]> => {
      return await api.get('/api/leaders/focus');
    },
    enabled,
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, projectId }: { taskId: string; projectId: string }) => {
      await api.delete(`/api/tasks/${taskId}`);
      return { taskId, projectId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Tarea eliminada');
    },
    onError: (error: any) => {
      toast.error('Error al eliminar: ' + error.message);
    },
  });
}
