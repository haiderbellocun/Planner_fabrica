import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface Asignatura {
  id: string;
  project_id: string;
  name: string;
  code: string | null;
  description: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateAsignaturaData {
  name?: string;
  code?: string | null;
  description?: string | null;
  display_order?: number;
}

export function useAsignaturas(projectId: string | undefined) {
  return useQuery({
    queryKey: ['asignaturas', projectId],
    queryFn: async (): Promise<Asignatura[]> => {
      if (!projectId) return [];
      return await api.get(`/api/projects/${projectId}/asignaturas`);
    },
    enabled: !!projectId,
  });
}

export function useAsignaturasByPrograma(programaId: string | undefined) {
  return useQuery({
    queryKey: ['asignaturas', 'programa', programaId],
    queryFn: async (): Promise<Asignatura[]> => {
      if (!programaId) return [];
      return await api.get(`/api/programas/${programaId}/asignaturas`);
    },
    enabled: !!programaId,
  });
}

export function useUpdateAsignatura(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAsignaturaData }) => {
      return await api.patch(`/api/asignaturas/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asignaturas', projectId] });
      toast.success('Asignatura actualizada');
    },
    onError: (error: any) => {
      toast.error('Error al actualizar asignatura: ' + error.message);
    },
  });
}

export function useDeleteAsignatura(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/api/asignaturas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asignaturas', projectId] });
      toast.success('Asignatura eliminada');
    },
    onError: (error: any) => {
      toast.error('Error al eliminar asignatura: ' + error.message);
    },
  });
}
