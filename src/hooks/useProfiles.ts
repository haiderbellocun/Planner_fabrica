import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Profile } from '@/types/database';

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async (): Promise<Profile[]> => {
      const profiles = await api.get<Profile[]>('/api/profiles');
      return profiles;
    },
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async (): Promise<Profile | null> => {
      if (!userId) return null;
      const profile = await api.get<Profile>(`/api/profiles/${userId}`);
      return profile;
    },
    enabled: !!userId,
  });
}
