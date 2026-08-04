import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Equipo } from '@/types/database';

export type { Equipo };

export interface UpdateEquipoData {
  name?: string;
  color?: string;
}

export function useEquipos() {
  return useQuery({
    queryKey: ['equipos'],
    queryFn: async (): Promise<Equipo[]> => api.get<Equipo[]>('/api/equipos'),
  });
}

export function useUpdateEquipo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateEquipoData }) =>
      api.patch<Equipo>(`/api/equipos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipos'] });
      toast.success('Equipo actualizado');
    },
    onError: () => toast.error('Error al actualizar el equipo'),
  });
}

export function useSetEquipoMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, profileIds }: { id: string; profileIds: string[] }) =>
      api.put<Equipo['members']>(`/api/equipos/${id}/members`, { profileIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipos'] });
    },
    onError: () => toast.error('Error al actualizar los miembros del equipo'),
  });
}
