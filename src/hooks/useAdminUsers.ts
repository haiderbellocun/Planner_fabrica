import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AdminUser {
  id: string;
  profile_id: string | null;
  email: string;
  full_name: string;
  cargo: string | null;
  role: 'admin' | 'project_leader' | 'user';
  is_active: boolean;
}

export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-users'],
    enabled,
    queryFn: async (): Promise<AdminUser[]> => {
      return await api.get('/api/admin/users');
    },
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      full_name: string;
      email: string;
      password: string;
      cargo?: string | null;
      role: 'admin' | 'project_leader' | 'user';
    }) => {
      return await api.post<AdminUser>('/api/admin/users', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useToggleUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      return await api.patch(`/api/admin/users/${id}/active`, { is_active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

