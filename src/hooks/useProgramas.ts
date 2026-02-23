import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface Asignatura {
  id: string;
  programa_id: string;
  name: string;
  code: string | null;
  description: string | null;
  semestre: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Programa {
  id: string;
  project_id: string;
  name: string;
  code: string | null;
  description: string | null;
  tipo_programa: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  asignaturas_count?: number;
  asignaturas?: Asignatura[];
}

export interface CreateProgramaData {
  name: string;
  code?: string | null;
  description?: string | null;
  tipo_programa?: string | null;
  display_order?: number;
}

export interface UpdateProgramaData {
  name?: string;
  code?: string | null;
  description?: string | null;
  tipo_programa?: string | null;
  display_order?: number;
}

export function useProgramas(projectId: string | undefined) {
  return useQuery({
    queryKey: ['programas', projectId],
    queryFn: async (): Promise<Programa[]> => {
      if (!projectId) return [];
      return await api.get(`/api/projects/${projectId}/programas`);
    },
    enabled: !!projectId,
  });
}

export function usePrograma(id: string | undefined) {
  return useQuery({
    queryKey: ['programa', id],
    queryFn: async () => {
      if (!id) return null;
      return await api.get(`/api/programas/${id}`);
    },
    enabled: !!id,
  });
}

export function useCreatePrograma(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateProgramaData) => {
      return await api.post(`/api/projects/${projectId}/programas`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programas', projectId] });
      toast.success('Programa creado');
    },
    onError: (error: any) => {
      toast.error('Error al crear programa: ' + error.message);
    },
  });
}

export function useUpdatePrograma(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProgramaData }) => {
      return await api.patch(`/api/programas/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programas', projectId] });
      toast.success('Programa actualizado');
    },
    onError: (error: any) => {
      toast.error('Error al actualizar programa: ' + error.message);
    },
  });
}

export function useDeletePrograma(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/api/programas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programas', projectId] });
      toast.success('Programa eliminado');
    },
    onError: (error: any) => {
      toast.error('Error al eliminar programa: ' + error.message);
    },
  });
}
