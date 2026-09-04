import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export type Prioridad = 'alta' | 'media' | 'baja';
export type EstadoInsumos = 'pendiente' | 'recibido' | 'incompleto';
export type EstadoProduccion = 'pendiente' | 'en_diseno' | 'en_revision' | 'aprobado' | 'publicado';

export interface SolicitudMarketing {
  id: string;
  folio: number;
  fecha_registro: string;
  fecha_limite: string;
  area_solicitante: string;
  solicitante: string;
  contacto: string | null;
  numero_ticket: string | null;
  campana: string;
  proyecto_id: string | null;
  proyecto_name: string | null;
  brief: string | null;
  objetivo_comunicacion: string | null;
  publico_objetivo: string | null;
  canal: string | null;             // JSON array serializado
  tipo_pieza: string | null;
  formato_medidas: string | null;
  cantidad: number | null;
  entregables_especificos: string | null;
  mensaje_clave: string | null;
  cta: string | null;
  insumos_disponibles: boolean;
  link_insumos: string | null;
  restricciones: string | null;
  prioridad: Prioridad;
  estado_insumos: EstadoInsumos;
  estado_produccion: EstadoProduccion;
  fecha_estimada_entrega: string | null;
  observaciones: string | null;
  entregas_links: string | null;
  nuevas_observaciones: string | null;
  observaciones_adicionales: string | null;
  created_by: string | null;
  creator_name: string | null;
  updated_at: string;
}

export type SolicitudMarketingInput = Omit<
  SolicitudMarketing,
  'id' | 'folio' | 'fecha_registro' | 'proyecto_name' | 'created_by' | 'creator_name' | 'updated_at'
>;

export function parseCanales(value: string | null | undefined): string[] {
  if (!value) return [];
  try { return JSON.parse(value); } catch { return []; }
}

export function serializeCanales(canales: string[]): string | null {
  return canales.length > 0 ? JSON.stringify(canales) : null;
}

export function useSolicitudesMarketing() {
  return useQuery({
    queryKey: ['solicitudes-marketing'],
    queryFn: () => api.get<SolicitudMarketing[]>('/api/solicitudes-marketing'),
  });
}

export function useCreateSolicitudMarketing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SolicitudMarketingInput) =>
      api.post<SolicitudMarketing>('/api/solicitudes-marketing', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes-marketing'] });
      toast.success('Solicitud creada');
    },
    onError: () => toast.error('Error al crear la solicitud'),
  });
}

export function useUpdateSolicitudMarketing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<SolicitudMarketingInput> & { id: string }) =>
      api.patch<SolicitudMarketing>(`/api/solicitudes-marketing/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes-marketing'] });
      toast.success('Solicitud actualizada');
    },
    onError: () => toast.error('Error al actualizar la solicitud'),
  });
}

export function useDeleteSolicitudMarketing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/solicitudes-marketing/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes-marketing'] });
      toast.success('Solicitud eliminada');
    },
    onError: () => toast.error('Error al eliminar la solicitud'),
  });
}
