import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string | null;
  comment: string;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email: string;
  } | null;
}

export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: async (): Promise<TaskComment[]> => {
      if (!taskId) return [];
      return await api.get(`/api/tasks/${taskId}/comments`);
    },
    enabled: !!taskId,
  });
}

export function useCreateTaskComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (comment: string) => {
      return await api.post(`/api/tasks/${taskId}/comments`, { comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
      toast.success('Comentario agregado');
    },
    onError: (error: any) => {
      toast.error('Error al agregar comentario: ' + error.message);
    },
  });
}

export function useDeleteTaskComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      return await api.delete(`/api/tasks/${taskId}/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
      toast.success('Comentario eliminado');
    },
    onError: (error: any) => {
      toast.error('Error al eliminar comentario: ' + error.message);
    },
  });
}
