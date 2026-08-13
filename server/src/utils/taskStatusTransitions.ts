// Shared status-transition rule, used by both the single-task PATCH
// /api/tasks/:id/status (updateTaskStatus) and the bulk PATCH /api/tasks/bulk
// (bulkUpdateTasks), so the two endpoints can never drift apart.
export const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  'Sin iniciar': ['En proceso'],
  'En proceso': ['En revisión'],
  'Ajustes': ['En revisión'],
};

export interface StatusTransitionResult {
  allowed: boolean;
  error?: string;
  detail?: string;
}

export function checkStatusTransition(
  currentStatusName: string,
  newStatusName: string,
  isAdminOrLeader: boolean,
  userRole?: string
): StatusTransitionResult {
  if (currentStatusName === 'Finalizado' && userRole !== 'admin') {
    return {
      allowed: false,
      error: 'No tienes permiso para mover tareas finalizadas',
      detail: 'Solo los administradores pueden cambiar el estado de tareas finalizadas',
    };
  }

  if (!isAdminOrLeader) {
    const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatusName] || [];
    if (!allowedNext.includes(newStatusName)) {
      return {
        allowed: false,
        error: 'No tienes permiso para cambiar a este estado',
        detail: `Solo puedes cambiar de "${currentStatusName}" a: ${allowedNext.join(', ') || 'ningún estado'}`,
      };
    }
  }

  return { allowed: true };
}
