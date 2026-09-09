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

// Inverso de taskFiltersToQuery -- reconstruye TaskFilters a partir de los parámetros de la URL,
// para que un enlace con filtros (?status_id=...&priority=...) sea compartible y sobreviva a un F5.
export function taskFiltersFromQuery(params: URLSearchParams): TaskFilters {
  const filters: TaskFilters = {};
  const search = params.get('search');
  if (search) filters.search = search;
  const statusId = params.get('status_id');
  if (statusId) filters.status_id = statusId.split(',').filter(Boolean);
  const priority = params.get('priority');
  if (priority) filters.priority = priority.split(',').filter(Boolean) as TaskFilters['priority'];
  const assigneeId = params.get('assignee_id');
  if (assigneeId) filters.assignee_id = assigneeId;
  const epicId = params.get('epic_id');
  if (epicId) filters.epic_id = epicId;
  const teamId = params.get('team_id');
  if (teamId) filters.team_id = teamId;
  const sprintId = params.get('sprint_id');
  if (sprintId) filters.sprint_id = sprintId;
  const tag = params.get('tag');
  if (tag) filters.tag = tag;
  return filters;
}

export interface SavedTaskView {
  id: string;
  name: string;
  filters: TaskFilters;
  view: 'board' | 'list';
}
