import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface MyCapacity {
  pending_hours_estimated: number;
  weekly_hours_capacity: number | null; // null = sin configurar, nunca inventar un valor
  utilization_pct: number | null; // null si no se puede calcular (capacidad sin configurar)
  tasks_without_estimate_count: number;
  tasks_count: number;
}

export function useMyCapacity() {
  return useQuery({
    queryKey: ['my-capacity'],
    queryFn: () => api.get<MyCapacity>('/api/capacity/me'),
    staleTime: 60 * 1000,
  });
}
