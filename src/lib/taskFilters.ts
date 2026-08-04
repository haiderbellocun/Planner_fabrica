import type { TaskPriority } from '@/types/database';

export interface TaskFilters {
  status_id?: string[];
  priority?: TaskPriority[];
  assignee_id?: string; // uuid | 'unassigned'
  epic_id?: string; // uuid | 'none'
  team_id?: string; // uuid | 'none'
  sprint_id?: string; // uuid | 'none'
  tag?: string;
  search?: string;
}

export const EMPTY_TASK_FILTERS: TaskFilters = {};

// Stable key order so the resulting string (and therefore the React Query key) is deterministic.
const KEY_ORDER: (keyof TaskFilters)[] = [
  'search',
  'status_id',
  'priority',
  'assignee_id',
  'epic_id',
  'team_id',
  'sprint_id',
  'tag',
];

export function taskFiltersToQuery(filters?: TaskFilters): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  for (const key of KEY_ORDER) {
    const value = filters[key];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

export function hasActiveFilters(filters?: TaskFilters): boolean {
  return countActiveFilters(filters) > 0;
}

export function countActiveFilters(filters?: TaskFilters): number {
  if (!filters) return 0;
  return KEY_ORDER.reduce((count, key) => {
    const value = filters[key];
    if (value === undefined || value === null || value === '') return count;
    if (Array.isArray(value) && value.length === 0) return count;
    return count + 1;
  }, 0);
}
