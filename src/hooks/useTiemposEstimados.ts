import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TiempoEstimado {
  id: string;
  producto: string;
  cargo: string;
  cantidad_descripcion: string;
  cantidad_valor: number;
  cantidad_unidad: string;
  horas: number;
  material_type_id: string | null;
  material_type_name: string | null;
  material_type_icon: string | null;
}

export interface TiempoTareaResponse {
  task_id: string;
  has_estimation: boolean;
  message?: string;
  task_material?: {
    type_name: string;
    icon: string;
    cantidad: number;
  } | null;
  assignee?: {
    name: string;
    cargo: string;
  } | null;
  tiempos_disponibles?: TiempoEstimado[];
  material_assignee_estimations?: {
    assignee_id: string;
    assignee_name: string;
    cargo: string;
    material_type: string;
    material_type_icon: string;
    tiempos_disponibles: TiempoEstimado[];
  }[];
  resumen?: {
    total_horas_estimadas: number;
    materiales_con_tiempo: number;
    materiales_total: number;
  };
}

export function useTiemposEstimados(filters?: {
  producto?: string;
  cargo?: string;
  material_type_id?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.producto) params.set('producto', filters.producto);
  if (filters?.cargo) params.set('cargo', filters.cargo);
  if (filters?.material_type_id) params.set('material_type_id', filters.material_type_id);
  const qs = params.toString();

  return useQuery({
    queryKey: ['tiempos-estimados', filters],
    queryFn: async (): Promise<TiempoEstimado[]> => {
      return await api.get<TiempoEstimado[]>(`/api/tiempos-estimados${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useTiempoTarea(taskId: string | undefined) {
  return useQuery({
    queryKey: ['tiempo-tarea', taskId],
    queryFn: async (): Promise<TiempoTareaResponse> => {
      return await api.get<TiempoTareaResponse>(`/api/tiempos-estimados/tarea/${taskId}`);
    },
    enabled: !!taskId,
  });
}

export function useProductos() {
  return useQuery({
    queryKey: ['tiempos-productos'],
    queryFn: async (): Promise<string[]> => {
      return await api.get<string[]>('/api/tiempos-estimados/productos');
    },
  });
}

export function useCargos() {
  return useQuery({
    queryKey: ['tiempos-cargos'],
    queryFn: async (): Promise<string[]> => {
      return await api.get<string[]>('/api/tiempos-estimados/cargos');
    },
  });
}
