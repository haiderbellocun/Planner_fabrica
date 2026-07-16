import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export type NivelPrograma = 'pregrado' | 'especializacion' | 'maestria' | 'doctorado' | 'diplomado' | 'curso_rapido';
export type Modalidad = 'virtual' | 'hibrida' | 'presencial';
export type TipoEntrega = 'primera_entrega' | 'correccion' | 'final';
export type EstadoEntrega = 'aceptado' | 'con_observaciones' | 'rechazado' | 'pendiente';

export interface Entrega {
  id: string;
  nombre_proyecto: string;
  proyecto_id: string | null;
  escuela: string | null;
  nivel_programa: NivelPrograma | null;
  modalidad: Modalidad | null;
  fecha_entrega: string;
  entregado_a: string | null;
  tipo_entrega: TipoEntrega;
  estado: EstadoEntrega;
  notas: string | null;
  cantidad_semestres: number | null;
  materias: string | null;             // JSON array stored as text
  materiales_entregados: string | null; // JSON array stored as text
  created_by: string | null;
  creator_name: string | null;
  created_at: string;
  updated_at: string;
}

export type EntregaInput = Omit<Entrega, 'id' | 'created_by' | 'creator_name' | 'created_at' | 'updated_at'>;

export function parseTags(value: string | null | undefined): string[] {
  if (!value) return [];
  try { return JSON.parse(value); } catch { return []; }
}

export function serializeTags(tags: string[]): string | null {
  return tags.length > 0 ? JSON.stringify(tags) : null;
}

export function useEntregas() {
  return useQuery({
    queryKey: ['entregas'],
    queryFn: () => api.get<Entrega[]>('/api/entregas'),
  });
}

export function useCreateEntrega() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: EntregaInput) => api.post<Entrega>('/api/entregas', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      toast.success('Entrega registrada');
    },
    onError: () => toast.error('Error al registrar la entrega'),
  });
}

export function useUpdateEntrega() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<EntregaInput> & { id: string }) =>
      api.patch<Entrega>(`/api/entregas/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      toast.success('Entrega actualizada');
    },
    onError: () => toast.error('Error al actualizar la entrega'),
  });
}

export function useDeleteEntrega() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/entregas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      toast.success('Entrega eliminada');
    },
    onError: () => toast.error('Error al eliminar la entrega'),
  });
}
