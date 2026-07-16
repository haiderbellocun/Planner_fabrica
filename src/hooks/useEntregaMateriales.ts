import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface EntregaMaterial {
  id: string;
  entrega_id: string;
  asignatura_id: string;
  asignatura_name: string;
  material_type_id: string;
  material_type_name: string;
  material_type_icon: string | null;
  cantidad_entregada: number;
  cantidad_requerida: number;
  created_at: string;
  updated_at: string;
}

export interface EntregaMaterialResumenRow {
  entrega_id: string;
  fecha_entrega: string;
  estado: string;
  tipo_entrega: string;
  escuela: string | null;
  nivel_programa: string | null;
  proyecto_id: string | null;
  nombre_proyecto: string;
  asignatura_id: string;
  asignatura_name: string;
  material_type_id: string;
  material_type_name: string;
  material_type_icon: string | null;
  cantidad_entregada: number;
  cantidad_requerida: number;
}

export interface EntregaMaterialItemInput {
  asignatura_id: string;
  material_type_id: string;
  cantidad_entregada: number;
}

export function useEntregaMateriales(entregaId: string | undefined) {
  return useQuery({
    queryKey: ['entrega-materiales', entregaId],
    queryFn: () => api.get<EntregaMaterial[]>(`/api/entregas/${entregaId}/materiales`),
    enabled: !!entregaId,
  });
}

export function useSetEntregaMateriales() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: EntregaMaterialItemInput[] }) =>
      api.put<EntregaMaterial[]>(`/api/entregas/${id}/materiales`, { items }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['entrega-materiales', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['entrega-materiales', 'resumen'] });
    },
    onError: () => toast.error('Error al guardar el detalle de materiales'),
  });
}

export function useEntregaMaterialesResumen() {
  return useQuery({
    queryKey: ['entrega-materiales', 'resumen'],
    queryFn: () => api.get<EntregaMaterialResumenRow[]>('/api/entregas/materiales'),
  });
}
