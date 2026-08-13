import type { TaskStatus } from '@/types/database';

// Mirrors server/src/utils/taskStatusTransitions.ts -- kept in sync by hand
// since frontend/backend don't share a module, but both encode the same rule.
export const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  'Sin iniciar': ['En proceso'],
  'En proceso': ['En revisión'],
  'Ajustes': ['En revisión'],
};

export function getAllowedNextStatuses(
  statuses: TaskStatus[],
  currentStatusName: string | null | undefined,
  isAdminOrLeader: boolean
): TaskStatus[] {
  if (isAdminOrLeader) {
    return statuses;
  }
  const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatusName || ''] || [];
  return statuses.filter((status) => status.name === currentStatusName || allowedNext.includes(status.name));
}
