import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Profile } from '@/types/database';
import { toast } from 'sonner';

export interface TemaAssignee {
  id: string;
  task_id: string;
  tema_id: string;
  assignee_id: string;
  assignee: Profile;
  tema_title: string;
}

export interface TemaAssignment {
  tema_id: string;
  assignee_id: string | null;
}

export function useTemaAssignees(taskId: string | undefined) {
  return useQuery({
    queryKey: ['tema-assignees', taskId],
    queryFn: async (): Promise<TemaAssignee[]> => {
      if (!taskId) return [];
      const assignees = await api.get<TemaAssignee[]>(`/api/tasks/${taskId}/tema-assignees`);
      return assignees;
    },
    enabled: !!taskId,
  });
}

export function useUpdateTemaAssignees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, assignments }: { taskId: string; assignments: TemaAssignment[] }) => {
      const result = await api.put<TemaAssignee[]>(`/api/tasks/${taskId}/tema-assignees`, { assignments });
      return { taskId, result };
    },
    onSuccess: ({ taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['tema-assignees', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      toast.success('Responsables por tema actualizados');
    },
    onError: (error: any) => {
      toast.error('Error al actualizar responsables: ' + error.message);
    },
  });
}
