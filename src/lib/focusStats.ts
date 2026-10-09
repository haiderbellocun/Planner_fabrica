// Indicadores de «Mi foco» / «Foco del equipo». Función pura: la misma regla se aplica al
// conjunto de tareas de cada contexto (propias o del equipo), nunca mezclando ambos.
import { getDueBucket } from '@/lib/dueDate';

export interface FocusTaskLike {
  id: string;
  due_date?: string | null;
  status?: { name?: string | null; is_completed?: boolean | null } | null;
}

export interface FocusStats<T extends FocusTaskLike> {
  /** Tareas pendientes (no completadas) del conjunto. */
  pending: T[];
  vencenHoy: T[];
  vencidas: T[];
  /** Vencen entre hoy y el fin de la semana (inclusive). */
  estaSemana: T[];
  /** Aproximación por nombre de estado ("revis"): no existe un flag semántico en task_statuses. */
  enRevision: T[];
}

const dueOf = (t: FocusTaskLike): string | null =>
  typeof t.due_date === 'string' && t.due_date ? t.due_date : null;

export function computeFocusStats<T extends FocusTaskLike>(
  tasks: readonly T[],
  todayStr: string,
  endOfWeekStr: string,
): FocusStats<T> {
  const pending = tasks.filter((t) => t && !t.status?.is_completed);
  const withBucket = (bucket: 'due_today' | 'overdue') =>
    pending.filter((t) => {
      const due = dueOf(t);
      return due !== null && getDueBucket(due, false, todayStr) === bucket;
    });
  const estaSemana = pending.filter((t) => {
    const due = dueOf(t);
    if (!due) return false;
    const d = due.slice(0, 10);
    return d >= todayStr && d <= endOfWeekStr;
  });
  const enRevision = pending.filter((t) => typeof t.status?.name === 'string' && /revis/i.test(t.status.name));
  return {
    pending,
    vencenHoy: withBucket('due_today'),
    vencidas: withBucket('overdue'),
    estaSemana,
    enRevision,
  };
}

/** Prioridad personal: vencidas, luego las de hoy y luego el resto por fecha (sin fecha al final). */
export function prioritize<T extends FocusTaskLike>(stats: FocusStats<T>, limit = 5): T[] {
  const taken = new Set([...stats.vencidas, ...stats.vencenHoy].map((t) => t.id));
  const time = (t: T) => {
    const due = dueOf(t);
    const ms = due ? new Date(`${due.slice(0, 10)}T12:00:00`).getTime() : NaN;
    return Number.isNaN(ms) ? Infinity : ms;
  };
  const rest = stats.pending.filter((t) => !taken.has(t.id)).sort((a, b) => time(a) - time(b));
  return [...stats.vencidas, ...stats.vencenHoy, ...rest].slice(0, limit);
}
