import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface MaterialType {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  created_at: string;
}

export interface MaterialRequerido {
  id: string;
  asignatura_id: string;
  material_type_id: string;
  cantidad: number;
  descripcion: string | null;
  created_at: string;
  material_type: MaterialType;
}

export interface CreateMaterialData {
  material_type_id: string;
  cantidad: number;
  descripcion?: string | null;
}

export interface UpdateMaterialData {
  cantidad?: number;
  descripcion?: string | null;
}

export function useMaterialTypes() {
  return useQuery({
    queryKey: ['material-types'],
    queryFn: async (): Promise<MaterialType[]> => {
      return await api.get('/api/material-types');
    },
  });
}

export function useMaterialesAsignatura(asignaturaId: string | undefined) {
  return useQuery({
    queryKey: ['materiales', asignaturaId],
    queryFn: async (): Promise<MaterialRequerido[]> => {
      if (!asignaturaId) return [];
      return await api.get(`/api/asignaturas/${asignaturaId}/materiales`);
    },
    enabled: !!asignaturaId,
  });
}

export function useMaterialesTema(temaId: string | undefined) {
  return useQuery({
    queryKey: ['materiales', 'tema', temaId],
    queryFn: async (): Promise<MaterialRequerido[]> => {
      if (!temaId) return [];
      return await api.get(`/api/temas/${temaId}/materiales`);
    },
    enabled: !!temaId,
  });
}

export function useCreateMaterialTema(temaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMaterialData) => {
      return await api.post(`/api/temas/${temaId}/materiales`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiales', 'tema', temaId] });
      queryClient.invalidateQueries({ queryKey: ['temas'] });
      toast.success('Material agregado');
    },
    onError: (error: any) => {
      toast.error('Error al agregar material: ' + error.message);
    },
  });
}

export function useDeleteMaterialTema(temaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/api/materiales/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiales', 'tema', temaId] });
      queryClient.invalidateQueries({ queryKey: ['temas'] });
      toast.success('Material eliminado');
    },
    onError: (error: any) => {
      toast.error('Error al eliminar material: ' + error.message);
    },
  });
}

export function useCreateMaterial(asignaturaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMaterialData) => {
      return await api.post(`/api/asignaturas/${asignaturaId}/materiales`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiales', asignaturaId] });
      toast.success('Material agregado');
    },
    onError: (error: any) => {
      toast.error('Error al agregar material: ' + error.message);
    },
  });
}

export function useUpdateMaterial(asignaturaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateMaterialData }) => {
      return await api.patch(`/api/materiales/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiales', asignaturaId] });
      toast.success('Material actualizado');
    },
    onError: (error: any) => {
      toast.error('Error al actualizar material: ' + error.message);
    },
  });
}

export function useDeleteMaterial(asignaturaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/api/materiales/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiales', asignaturaId] });
      toast.success('Material eliminado');
    },
    onError: (error: any) => {
      toast.error('Error al eliminar material: ' + error.message);
    },
  });
}
