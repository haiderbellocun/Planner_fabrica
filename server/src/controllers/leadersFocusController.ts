import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { env } from '../config/env.js';

// Schema: user_roles.user_id REFERENCES profiles(id). JWT profileId = profiles.id.
// Roles (in user_roles): Nathaly, Deyvis, German = project_leader; Haider = admin.

function mapRowsToTasks(rows: any[]) {
  return rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    due_date: row.due_date,
    status: {
      name: row.status_name,
      color: row.status_color,
      is_completed: row.status_is_completed,
    },
    assignee: {
      full_name: row.assignee_full_name ?? null,
      email: row.assignee_email ?? null,
      cargo: row.assignee_cargo ?? null,
    },
    project: {
      id: row.project_id,
      name: row.project_name,
      key: row.project_key,
    },
  }));
}

const TASKS_SELECT = `
  SELECT
    t.id,
    t.title,
    t.due_date,
    ts.name AS status_name,
    ts.color AS status_color,
    ts.is_completed AS status_is_completed,
    assignee.full_name AS assignee_full_name,
    assignee.email AS assignee_email,
    assignee.cargo AS assignee_cargo,
    p.id AS project_id,
    p.name AS project_name,
    p.key AS project_key
  FROM public.tasks t
  JOIN public.task_statuses ts ON ts.id = t.status_id
  JOIN public.projects p ON p.id = t.project_id
  LEFT JOIN public.profiles assignee ON assignee.id = t.assignee_id
  WHERE ts.is_completed = false
    AND t.due_date IS NOT NULL
`;

const TASKS_SELECT_FOR_LEADER_PROJECTS = `
  SELECT
    t.id,
    t.title,
    t.due_date,
    ts.name AS status_name,
    ts.color AS status_color,
    ts.is_completed AS status_is_completed,
    assignee.full_name AS assignee_full_name,
    assignee.email AS assignee_email,
    assignee.cargo AS assignee_cargo,
    p.id AS project_id,
    p.name AS project_name,
    p.key AS project_key
  FROM public.tasks t
  JOIN public.task_statuses ts ON ts.id = t.status_id
  JOIN public.projects p ON p.id = t.project_id
  JOIN public.project_members pm ON pm.project_id = p.id AND pm.user_id = $1 AND pm.role = 'leader'
  LEFT JOIN public.profiles assignee ON assignee.id = t.assignee_id
  WHERE ts.is_completed = false
    AND t.due_date IS NOT NULL
`;

/**
 * GET /api/leaders/focus
 * - admin: all non-completed tasks with due_date; optional ?cargo=val1,val2 to filter by assignee cargo.
 * - project_leader: only tasks whose assignee.cargo is in leader_cargo_scope for their profileId; no scope => 200 [].
 * - user: 403.
 */
export const getLeadersFocus = async (req: AuthRequest, res: Response) => {
  const userRole = req.user?.role;
  const profileId = req.user?.profileId;
  const userEmail = req.user?.email ?? 'unknown';

  if (userRole !== 'project_leader' && userRole !== 'admin') {
    return res.status(403).json({ error: 'Solo project leaders o admin pueden ver el foco del equipo' });
  }

  let cargos: string[] | null = null;

  try {
    if (userRole === 'admin') {
      const cargoParam = req.query.cargo;
      if (typeof cargoParam === 'string' && cargoParam.trim()) {
        cargos = cargoParam.split(',').map((c) => c.trim()).filter(Boolean);
      }
    } else {
      // project_leader: scope from leader_cargo_scope; if empty, show all tasks from projects they lead
      const validProfileId =
        typeof profileId === 'string' && profileId.trim() !== '' ? profileId.trim() : undefined;
      if (!validProfileId) {
        if (env.NODE_ENV === 'development') {
          console.warn('[leaders/focus] project_leader without profileId', { userEmail, userRole });
        }
        return res.status(200).json([]);
      }
      const scopeResult = await query(
        'SELECT cargo FROM public.leader_cargo_scope WHERE leader_profile_id = $1',
        [validProfileId]
      );
      cargos = (scopeResult?.rows ?? []).map((r: { cargo?: string }) => r.cargo).filter(Boolean) as string[];

      if (cargos.length === 0) {
        // Sin scope de cargo: mostrar todas las tareas de proyectos donde es líder
        const result = await query(
          `${TASKS_SELECT_FOR_LEADER_PROJECTS} ORDER BY t.due_date ASC`,
          [validProfileId]
        );
        return res.json(mapRowsToTasks(result.rows ?? []));
      }
    }

    const sql =
      cargos && cargos.length > 0
        ? `${TASKS_SELECT} AND assignee.cargo = ANY($1::text[]) ORDER BY t.due_date ASC`
        : `${TASKS_SELECT} ORDER BY t.due_date ASC`;
    const params = cargos && cargos.length > 0 ? [cargos] : [];

    const result = await query(sql, params);
    res.json(mapRowsToTasks(result.rows ?? []));
  } catch (error) {
    console.error('[leaders/focus] error', {
      userEmail,
      profileId: profileId ?? null,
      userRole,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Error al cargar el foco del equipo' });
  }
};
