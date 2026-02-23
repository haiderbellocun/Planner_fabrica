import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Notification } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export function useNotifications() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['notifications', profile?.id],
    queryFn: async (): Promise<Notification[]> => {
      if (!profile) return [];
      const notifications = await api.get<Notification[]>('/api/notifications');
      return notifications;
    },
    enabled: !!profile,
  });
}

export function useUnreadNotificationsCount() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['notifications-count', profile?.id],
    queryFn: async (): Promise<number> => {
      if (!profile) return 0;
      const result = await api.get<{ count: number }>('/api/notifications/unread/count');
      return result.count;
    },
    enabled: !!profile,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await api.patch(`/api/notifications/${notificationId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', profile?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count', profile?.id] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!profile) return;

      // Get all unread notifications and mark them individually
      // (backend doesn't have bulk update endpoint yet)
      const notifications = await api.get<Notification[]>('/api/notifications');
      const unread = notifications.filter(n => !n.read);

      await Promise.all(
        unread.map(n => api.patch(`/api/notifications/${n.id}/read`, {}))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', profile?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count', profile?.id] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      // Note: Backend doesn't have delete endpoint yet, so this will fail
      // TODO: Add DELETE /api/notifications/:id endpoint
      await api.delete(`/api/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', profile?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count', profile?.id] });
    },
  });
}
