import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Profile } from '@/types/database';
import { toast } from 'sonner';

export interface MaterialAssignee {
  id: string;
  task_id: string;
  material_id: string;
  assignee_id: string;
  horas_estimadas: number | null;
  assignee: Profile;
  material_type_name: string;
  material_type_icon: string;
}

export interface MaterialAssignment {
  material_id: string;
  assignee_id: string | null;
  horas_estimadas?: number | null;
}

export function useMaterialAssignees(taskId: string | undefined) {
  return useQuery({
    queryKey: ['material-assignees', taskId],
    queryFn: async (): Promise<MaterialAssignee[]> => {
      if (!taskId) return [];
      return await api.get<MaterialAssignee[]>(`/api/tasks/${taskId}/material-assignees`);
    },
    enabled: !!taskId,
  });
}

export function useUpdateMaterialAssignees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, assignments }: { taskId: string; assignments: MaterialAssignment[] }) => {
      const result = await api.put<MaterialAssignee[]>(`/api/tasks/${taskId}/material-assignees`, { assignments });
      return { taskId, result };
    },
    onSuccess: ({ taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['material-assignees', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tiempo-tarea', taskId] });
      toast.success('Responsables por material actualizados');
    },
    onError: (error: any) => {
      toast.error('Error al actualizar responsables: ' + error.message);
    },
  });
}
