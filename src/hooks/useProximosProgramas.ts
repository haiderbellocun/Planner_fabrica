import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export type NivelPrograma = 'pregrado' | 'especializacion' | 'maestria' | 'doctorado' | 'diplomado' | 'curso_rapido';
export type ClasificacionPrograma = 'nuevo' | 'renovacion';
export type Modalidad = 'virtual' | 'hibrida' | 'presencial';
export type Prioridad = 'alta' | 'media' | 'baja';
export type EstadoPrograma = 'pendiente' | 'en_proceso' | 'completado';

export interface ProximoPrograma {
  id: string;
  escuela: string;
  nivel_programa: NivelPrograma;
  clasificacion_programa: ClasificacionPrograma;
  programa_con_cambio: string | null;
  programa_sin_cambio: string | null;
  modalidad: Modalidad;
  cantidad_asignaturas: number;
  fecha_envio_curriculo: string;
  prioridad: Prioridad;
  estado: EstadoPrograma;
  dependencia: string | null;
  link: string | null;
  notas: string | null;
  created_by: string | null;
  creator_name: string | null;
  created_at: string;
  updated_at: string;
}

export type ProximoProgramaInput = Omit<ProximoPrograma,
  'id' | 'created_by' | 'creator_name' | 'created_at' | 'updated_at'
>;

export function useProximosProgramas() {
  return useQuery({
    queryKey: ['proximos-programas'],
    queryFn: () => api.get<ProximoPrograma[]>('/api/proximos-programas'),
  });
}

export function useCreateProximoPrograma() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProximoProgramaInput) =>
      api.post<ProximoPrograma>('/api/proximos-programas', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proximos-programas'] });
      toast.success('Programa agregado correctamente');
    },
    onError: () => {
      toast.error('Error al agregar el programa');
    },
  });
}

export function useUpdateProximoPrograma() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<ProximoProgramaInput> & { id: string }) =>
      api.patch<ProximoPrograma>(`/api/proximos-programas/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proximos-programas'] });
      toast.success('Programa actualizado');
    },
    onError: () => {
      toast.error('Error al actualizar el programa');
    },
  });
}

export function useDeleteProximoPrograma() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/proximos-programas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proximos-programas'] });
      toast.success('Programa eliminado');
    },
    onError: () => {
      toast.error('Error al eliminar el programa');
    },
  });
}
