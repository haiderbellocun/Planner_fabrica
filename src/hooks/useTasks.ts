import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Task, TaskStatus, Profile } from '@/types/database';
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

export function useTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async (): Promise<TaskWithDetails[]> => {
      if (!projectId) return [];
      const tasks = await api.get<TaskWithDetails[]>(`/api/projects/${projectId}/tasks`);
      console.log('🔍 useTasks received from API:', {
        projectId,
        tasksCount: tasks.length,
        tasks: tasks.map(t => ({ id: t.id, title: t.title, reporter_id: t.reporter_id }))
      });
      return tasks;
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

export function useMyTasks() {
  return useQuery({
    queryKey: ['my-tasks'],
    queryFn: async (): Promise<(TaskWithDetails & { project: { id: string; name: string; key: string } })[]> => {
      return await api.get('/api/my-tasks');
    },
  });
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
