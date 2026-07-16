import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Team } from '@/types/database';

export type { Team };

export interface CreateTeamData {
  name: string;
  color?: string;
}

export function useTeams(projectId: string | undefined) {
  return useQuery({
    queryKey: ['teams', projectId],
    queryFn: async (): Promise<Team[]> => {
      if (!projectId) return [];
      return api.get<Team[]>(`/api/projects/${projectId}/teams`);
    },
    enabled: !!projectId,
  });
}

export function useCreateTeam(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateTeamData) =>
      api.post<Team>(`/api/projects/${projectId}/teams`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', projectId] });
      toast.success('Equipo creado correctamente');
    },
    onError: () => toast.error('Error al crear el equipo'),
  });
}

export function useUpdateTeam(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      teamId,
      data,
    }: {
      teamId: string;
      data: Partial<CreateTeamData> & { display_order?: number };
    }) => api.patch<Team>(`/api/projects/${projectId}/teams/${teamId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', projectId] });
      toast.success('Equipo actualizado');
    },
    onError: () => toast.error('Error al actualizar el equipo'),
  });
}

export function useDeleteTeam(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) =>
      api.delete(`/api/projects/${projectId}/teams/${teamId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Equipo eliminado');
    },
    onError: () => toast.error('Error al eliminar el equipo'),
  });
}

export function useSetTeamMembers(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, profileIds }: { teamId: string; profileIds: string[] }) =>
      api.put<Team['members']>(`/api/projects/${projectId}/teams/${teamId}/members`, { profileIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', projectId] });
    },
    onError: () => toast.error('Error al actualizar los miembros del equipo'),
  });
}
