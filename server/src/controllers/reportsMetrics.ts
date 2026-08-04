// Shared, canonical SQL fragments and helpers for the reformulated report endpoints
// (person-metrics, capacity-forecast, throughput, production-by-person).
//
// These exist so the "correct" definitions of assigned work, real completion time,
// and capacity are written ONCE and reused, instead of being re-derived (and drifting)
// in every handler — which is exactly how the previous bugs in reportsController.ts
// happened (a correct join existed in one place, a broken copy in another).
//
// IMPORTANT: fragments below contain no `$n` placeholders. Parameterised filtering
// (project_id, date_from, date_to, cargo) is applied by the caller in the outer query
// via `buildScope`, which manages placeholder numbering.

export const REPORT_TZ = 'America/Bogota';

export const WORK_SCHEDULE = {
  MON_THU_HOURS: 8.25,
  FRIDAY_HOURS: 7.25,
  WEEKLY_HOURS: 8.25 * 4 + 7.25, // 40.25
  AVG_DAILY_HOURS: (8.25 * 4 + 7.25) / 5, // 8.05
};

export const RISK_BANDS = {
  OVER: 100,
  WARNING: 90,
  AVAILABLE: 50,
};

/**
 * Canonical per-person assigned-work unit.
 *
 * Verified against production data (Phase 0): tasks do NOT form a real
 * parent/copy/leaf hierarchy (only 1 of 3480 tasks has parent_task_id set), and the
 * join `tma.task_id = t.parent_task_id` used by the original getTeamCapacity/
 * getProjectsTimeline/getUserMiniReport matches ZERO rows in practice — those
 * endpoints have been silently returning 0 hours for everyone.
 *
 * The real relationship: `task_material_assignees.task_id` points DIRECTLY at the
 * task. A single task (usually one per asignatura) can have many materials, each
 * assigned to a different person via `tma.assignee_id`, each with its own
 * `horas_estimadas`. Due date / status / completion are tracked at the task level
 * (task_status_history has no material-level granularity), so every material row
 * within a task shares that task's due_date and completion event.
 *
 * Only ~114 of 3480 tasks (all with asignatura_id) currently have any
 * task_material_assignees rows — "desarrollo" project tasks have no material
 * breakdown and therefore no hours dimension at all. Those tasks still need to
 * show up (as `sin_estimacion`), attributed to `tasks.assignee_id`, just without hours.
 */
export const ASSIGNED_WORK_CTE = `
  assigned_work AS (
    -- Material-level work: hours-weighted, attributed to whoever the material was assigned to
    SELECT
      tma.assignee_id       AS profile_id,
      t.id                  AS task_id,
      tma.material_id,
      tma.horas_estimadas,
      false                 AS sin_estimacion,
      t.project_id, t.due_date, t.status_id, ts.name AS status_name, ts.is_completed, t.created_at
    FROM public.task_material_assignees tma
    JOIN public.tasks t ON t.id = tma.task_id
    JOIN public.task_statuses ts ON ts.id = t.status_id

    UNION ALL

    -- Tasks with no material breakdown at all: fall back to the task's own assignee,
    -- with no hours (never invent an estimate that doesn't exist).
    SELECT
      t.assignee_id         AS profile_id,
      t.id                  AS task_id,
      NULL::uuid            AS material_id,
      NULL::numeric         AS horas_estimadas,
      true                  AS sin_estimacion,
      t.project_id, t.due_date, t.status_id, ts.name AS status_name, ts.is_completed, t.created_at
    FROM public.tasks t
    JOIN public.task_statuses ts ON ts.id = t.status_id
    WHERE t.assignee_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.task_material_assignees x WHERE x.task_id = t.id)
  )
`;

/**
 * Canonical real completion timestamp, generalised from the one query that already
 * got this right (getOntimeByEquipo): the transition INTO a completed status,
 * using task_status_history.started_at — NOT tasks.updated_at (a mutable
 * last-modified column that multiple existing endpoints wrongly treat as
 * "when the task was finished").
 */
export const TASK_COMPLETION_CTE = `
  task_completion AS (
    SELECT
      tsh.task_id,
      MIN(tsh.started_at) AS first_completed_at,
      MAX(tsh.started_at) AS completed_at,
      COUNT(*)            AS completion_events
    FROM public.task_status_history tsh
    JOIN public.task_statuses ts_c ON ts_c.id = tsh.to_status_id AND ts_c.is_completed = true
    GROUP BY tsh.task_id
  )
`;

/**
 * How many distinct people are assigned somewhere within a task (across its materials).
 * task_status_history tracks time-in-status at the TASK level, not per material — so
 * when a task has several assignees (common: tasks average multiple materials split
 * across different people), effort-hours cannot be attributed to any one of them.
 * Any effort-hours rollup MUST restrict to n_assignees = 1, or it silently charges
 * every co-assignee the task's full active time (verified empirically: charging all
 * co-assignees inflated per-person "horas reales" into the thousands).
 */
export const TASK_ASSIGNEE_COUNT_CTE = `
  task_assignee_counts AS (
    SELECT task_id, COUNT(DISTINCT profile_id) AS n_assignees
    FROM assigned_work
    WHERE profile_id IS NOT NULL
    GROUP BY task_id
  )
`;

/** Active-effort hours per task, corrected for the to_status_id/from_status_id mislabeling
 * found elsewhere on the page (out of scope to fix there — this is a fresh, correct
 * computation for the new endpoints only). duration_seconds is dwell time in `to_status_id`.
 */
export const EFFORT_HOURS_CTE = `
  effort_hours AS (
    SELECT
      tsh.task_id,
      SUM(tsh.duration_seconds) FILTER (WHERE ts_to.name = 'En proceso') / 3600.0 AS h_proceso,
      SUM(tsh.duration_seconds) FILTER (WHERE ts_to.name = 'Ajustes')    / 3600.0 AS h_ajustes,
      SUM(tsh.duration_seconds) FILTER (WHERE ts_to.name = 'En revisión') / 3600.0 AS h_revision,
      SUM(tsh.duration_seconds) FILTER (WHERE ts_to.name = 'Sin iniciar') / 3600.0 AS h_espera,
      SUM(tsh.duration_seconds) / 3600.0 AS h_total
    FROM public.task_status_history tsh
    JOIN public.task_statuses ts_to ON ts_to.id = tsh.to_status_id
    WHERE tsh.duration_seconds IS NOT NULL AND tsh.duration_seconds > 0
    GROUP BY tsh.task_id
  )
`;

export interface ScopeFilters {
  project_id?: string;
  date_from?: string;
  date_to?: string;
  cargo?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns the value if it's a well-formed UUID, else null — safe to bind as `$n::uuid`. */
export function validUuidOrNull(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

/** Returns the value if it's a well-formed YYYY-MM-DD date, else null — safe to bind as `$n::date`. */
export function validDateOrNull(value: unknown): string | null {
  return typeof value === 'string' && DATE_RE.test(value) ? value : null;
}

/**
 * Builds a parameterised WHERE-fragment array for the common report filters, sharing
 * placeholder numbering with whatever the caller already built. Never interpolates
 * user input directly — every accepted value is bound.
 */
export function buildScope(
  filters: ScopeFilters,
  startIndex: number,
  columns: { projectId: string; completedAt?: string; cargo?: string }
): { conditions: string[]; params: unknown[]; nextIndex: number } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = startIndex;

  if (filters.project_id && UUID_RE.test(filters.project_id)) {
    conditions.push(`${columns.projectId} = $${i++}::uuid`);
    params.push(filters.project_id);
  }
  if (columns.completedAt && filters.date_from && DATE_RE.test(filters.date_from)) {
    conditions.push(`${columns.completedAt} >= $${i++}::date`);
    params.push(filters.date_from);
  }
  if (columns.completedAt && filters.date_to && DATE_RE.test(filters.date_to)) {
    conditions.push(`${columns.completedAt} < ($${i++}::date + INTERVAL '1 day')`);
    params.push(filters.date_to);
  }
  if (columns.cargo && filters.cargo) {
    conditions.push(`${columns.cargo} = $${i++}`);
    params.push(filters.cargo);
  }

  return { conditions, params, nextIndex: i };
}

/** Skips weekends, matching the day-estimation logic already used by getTeamCapacity. */
export function addBusinessDays(from: Date, days: number): Date {
  const current = new Date(from);
  let remaining = Math.ceil(days);
  while (remaining > 0) {
    current.setDate(current.getDate() + 1);
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return current;
}

export type RiskLevel = 'available' | 'ok' | 'warning' | 'over';

export function riskBand(utilizationPct: number, includeAvailable = false): {
  level: RiskLevel;
  label: string;
  color: 'sky' | 'emerald' | 'amber' | 'red';
} {
  if (utilizationPct >= RISK_BANDS.OVER) return { level: 'over', label: 'SOBRECARGADO', color: 'red' };
  if (utilizationPct >= RISK_BANDS.WARNING) return { level: 'warning', label: 'RIESGO', color: 'amber' };
  if (includeAvailable && utilizationPct < RISK_BANDS.AVAILABLE) {
    return { level: 'available', label: 'DISPONIBLE', color: 'sky' };
  }
  return { level: 'ok', label: 'OK', color: 'emerald' };
}

export function assertEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}
