import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { EquipoPlan, TaskSearchResult } from '@/types/database';

export type { EquipoPlan, EquipoPlanSection, EquipoPlanItem, EquipoPlanTask, TaskSearchResult } from '@/types/database';

export function useEquipoPlan(equipoId: string | undefined, weekStart: string | undefined) {
  return useQuery({
    queryKey: ['equipo-plan', equipoId, weekStart],
    queryFn: async (): Promise<EquipoPlan> => api.get<EquipoPlan>(`/api/equipos/${equipoId}/plan?week=${weekStart}`),
    enabled: !!equipoId && !!weekStart,
  });
}

export function useAddEquipoPlanItem(equipoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { profile_id: string; task_id: string; week_start: string }) =>
      api.post(`/api/equipos/${equipoId}/plan/items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipo-plan', equipoId] });
      toast.success('Tarea agregada al plan');
    },
    onError: (error: any) => toast.error(error?.message || 'Error al agregar la tarea'),
  });
}

export function useRemoveEquipoPlanItem(equipoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => api.delete(`/api/equipos/${equipoId}/plan/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipo-plan', equipoId] });
      toast.success('Tarea quitada del plan');
    },
    onError: () => toast.error('Error al quitar la tarea'),
  });
}

export function useTaskSearch(q: string, assigneeId?: string) {
  return useQuery({
    queryKey: ['task-search', q, assigneeId],
    queryFn: async (): Promise<TaskSearchResult[]> => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (assigneeId) params.set('assignee_id', assigneeId);
      return api.get<TaskSearchResult[]>(`/api/tasks/search?${params.toString()}`);
    },
    enabled: q.trim().length >= 2 || !!assigneeId,
  });
}
