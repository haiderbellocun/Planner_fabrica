import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ProjectActivityEvent {
  id: string;
  type: 'task_created' | 'status_changed' | 'comment';
  created_at: string;
  task: { id: string; task_number: number | null; title: string };
  actor: { id: string; full_name: string | null; avatar_url: string | null } | null;
  detail: { from?: string; to?: string; comment?: string };
}

export function useProjectActivity(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: async (): Promise<ProjectActivityEvent[]> => {
      if (!projectId) return [];
      return api.get<ProjectActivityEvent[]>(`/api/projects/${projectId}/activity`);
    },
    enabled: !!projectId,
  });
}
