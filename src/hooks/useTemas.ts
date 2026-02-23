import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface Tema {
  id: string;
  asignatura_id: string;
  title: string;
  description: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  materiales_count?: number;
  materiales?: any[]; // Will be populated when fetching with materials
}

export interface CreateTemaData {
  title: string;
  description?: string | null;
  display_order?: number;
}

export interface UpdateTemaData {
  title?: string;
  description?: string | null;
  display_order?: number;
}

export function useTemas(asignaturaId: string | undefined) {
  return useQuery({
    queryKey: ['temas', asignaturaId],
    queryFn: async (): Promise<Tema[]> => {
      if (!asignaturaId) return [];
      return await api.get(`/api/asignaturas/${asignaturaId}/temas`);
    },
    enabled: !!asignaturaId,
  });
}

export function useTema(id: string | undefined) {
  return useQuery({
    queryKey: ['tema', id],
    queryFn: async () => {
      if (!id) return null;
      return await api.get(`/api/temas/${id}`);
    },
    enabled: !!id,
  });
}

export function useCreateTema(asignaturaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTemaData) => {
      return await api.post(`/api/asignaturas/${asignaturaId}/temas`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['temas', asignaturaId] });
      toast.success('Tema creado');
    },
    onError: (error: any) => {
      toast.error('Error al crear tema: ' + error.message);
    },
  });
}

export function useUpdateTema(asignaturaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTemaData }) => {
      return await api.patch(`/api/temas/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['temas', asignaturaId] });
      toast.success('Tema actualizado');
    },
    onError: (error: any) => {
      toast.error('Error al actualizar tema: ' + error.message);
    },
  });
}

export function useDeleteTema(asignaturaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/api/temas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['temas', asignaturaId] });
      toast.success('Tema eliminado');
    },
    onError: (error: any) => {
      toast.error('Error al eliminar tema: ' + error.message);
    },
  });
}

// Fetch temas with their materials for task assignment
export function useTemasWithMateriales(asignaturaId: string | undefined) {
  return useQuery({
    queryKey: ['temas-with-materiales', asignaturaId],
    queryFn: async (): Promise<Tema[]> => {
      if (!asignaturaId) return [];
      return await api.get(`/api/asignaturas/${asignaturaId}/temas-with-materiales`);
    },
    enabled: !!asignaturaId,
  });
}
