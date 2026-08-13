import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Sprint } from '@/types/database';

export type { Sprint };

export interface CreateSprintData {
  name: string;
  goal?: string;
  start_date?: string;
  end_date?: string;
}

export function useSprints(projectId: string | undefined) {
  return useQuery({
    queryKey: ['sprints', projectId],
    queryFn: async (): Promise<Sprint[]> => {
      if (!projectId) return [];
      return api.get<Sprint[]>(`/api/projects/${projectId}/sprints`);
    },
    enabled: !!projectId,
  });
}

export interface SprintBurndownDay {
  date: string;
  total: number;
  remaining: number;
  ideal: number;
}

export interface SprintBurndownResponse {
  sprint: Pick<Sprint, 'id' | 'name' | 'status' | 'start_date' | 'end_date'>;
  days: SprintBurndownDay[];
  meta: { truncated: boolean; day_count: number; reason?: 'not_started' };
}

export function useSprintBurndown(projectId: string | undefined, sprintId: string | undefined) {
  return useQuery({
    queryKey: ['sprint-burndown', projectId, sprintId],
    queryFn: async (): Promise<SprintBurndownResponse> =>
      api.get<SprintBurndownResponse>(`/api/projects/${projectId}/sprints/${sprintId}/burndown`),
    enabled: !!projectId && !!sprintId,
  });
}

export function useCreateSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSprintData) =>
      api.post<Sprint>(`/api/projects/${projectId}/sprints`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      toast.success('Sprint creado correctamente');
    },
    onError: () => toast.error('Error al crear el sprint'),
  });
}

export function useUpdateSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sprintId,
      data,
    }: {
      sprintId: string;
      data: Partial<CreateSprintData> & { display_order?: number };
    }) => api.patch<Sprint>(`/api/projects/${projectId}/sprints/${sprintId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      toast.success('Sprint actualizado');
    },
    onError: () => toast.error('Error al actualizar el sprint'),
  });
}

export function useDeleteSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sprintId: string) =>
      api.delete(`/api/projects/${projectId}/sprints/${sprintId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Sprint eliminado');
    },
    onError: () => toast.error('Error al eliminar el sprint'),
  });
}

export function useStartSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sprintId: string) =>
      api.post<Sprint>(`/api/projects/${projectId}/sprints/${sprintId}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      toast.success('Sprint iniciado');
    },
    onError: (error: any) => toast.error(error?.message || 'Error al iniciar el sprint'),
  });
}

export function useCompleteSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sprintId, moveTo }: { sprintId: string; moveTo: string }) =>
      api.post<{ sprint: Sprint; moved_count: number }>(
        `/api/projects/${projectId}/sprints/${sprintId}/complete`,
        { move_to: moveTo }
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success(
        result.moved_count > 0
          ? `Sprint completado. ${result.moved_count} tarea(s) movida(s).`
          : 'Sprint completado'
      );
    },
    onError: (error: any) => toast.error(error?.message || 'Error al completar el sprint'),
  });
}
