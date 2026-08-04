import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface Epic {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  color: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  start_date: string | null;
  end_date: string | null;
  display_order: number;
  created_by: string | null;
  equipo_id: string | null;
  created_at: string;
  updated_at: string;
  creator_name?: string | null;
  equipo_name?: string | null;
  equipo_color?: string | null;
}

export interface CreateEpicData {
  title: string;
  description?: string;
  color?: string;
  status?: Epic['status'];
  start_date?: string;
  end_date?: string;
  equipo_id?: string | null;
}

export function useEpics(projectId: string | undefined) {
  return useQuery({
    queryKey: ['epics', projectId],
    queryFn: async (): Promise<Epic[]> => {
      if (!projectId) return [];
      return api.get<Epic[]>(`/api/projects/${projectId}/epics`);
    },
    enabled: !!projectId,
  });
}

export function useCreateEpic(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateEpicData) =>
      api.post<Epic>(`/api/projects/${projectId}/epics`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epics', projectId] });
      toast.success('Épica creada correctamente');
    },
    onError: () => toast.error('Error al crear la épica'),
  });
}

export function useUpdateEpic(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      epicId,
      data,
    }: {
      epicId: string;
      data: Partial<CreateEpicData> & { display_order?: number };
    }) => api.patch<Epic>(`/api/projects/${projectId}/epics/${epicId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epics', projectId] });
      toast.success('Épica actualizada');
    },
    onError: () => toast.error('Error al actualizar la épica'),
  });
}

export function useDeleteEpic(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (epicId: string) =>
      api.delete(`/api/projects/${projectId}/epics/${epicId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epics', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Épica eliminada');
    },
    onError: () => toast.error('Error al eliminar la épica'),
  });
}
