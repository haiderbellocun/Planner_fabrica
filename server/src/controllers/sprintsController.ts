import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

export const listSprints = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      `SELECT s.*, p.full_name AS creator_name,
        (SELECT COUNT(*)::int FROM public.tasks t WHERE t.sprint_id = s.id) AS task_count,
        (SELECT COUNT(*)::int FROM public.tasks t
           JOIN public.task_statuses ts ON ts.id = t.status_id
          WHERE t.sprint_id = s.id AND ts.is_completed) AS completed_count
       FROM public.sprints s
       LEFT JOIN public.profiles p ON p.id = s.created_by
       WHERE s.project_id = $1
       ORDER BY s.display_order ASC, s.created_at ASC`,
      [projectId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List sprints error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createSprint = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const profileId = req.user?.profileId;
    const { name, goal, start_date, end_date } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await query(
      `INSERT INTO public.sprints (project_id, name, goal, start_date, end_date, created_by, display_order)
       VALUES ($1, $2, $3, $4, $5, $6,
         COALESCE((SELECT MAX(display_order) + 1 FROM public.sprints WHERE project_id = $1), 0))
       RETURNING *`,
      [projectId, name, goal || null, start_date || null, end_date || null, profileId || null]
    );
    res.status(201).json({ ...result.rows[0], task_count: 0, completed_count: 0 });
  } catch (error) {
    console.error('Create sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSprint = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, sprintId } = req.params;
    const { name, goal, start_date, end_date, display_order } = req.body;

    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let i = 1;

    if (name !== undefined)          { updates.push(`name = $${i++}`);          values.push(name); }
    if (goal !== undefined)          { updates.push(`goal = $${i++}`);          values.push(goal ?? null); }
    if (start_date !== undefined)    { updates.push(`start_date = $${i++}`);    values.push(start_date || null); }
    if (end_date !== undefined)      { updates.push(`end_date = $${i++}`);      values.push(end_date || null); }
    if (display_order !== undefined) { updates.push(`display_order = $${i++}`); values.push(display_order); }

    values.push(sprintId, projectId);
    const result = await query(
      `UPDATE public.sprints SET ${updates.join(', ')} WHERE id = $${i++} AND project_id = $${i} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sprint not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const startSprint = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, sprintId } = req.params;

    const result = await query(
      `UPDATE public.sprints
          SET status = 'active', start_date = COALESCE(start_date, CURRENT_DATE), updated_at = NOW()
        WHERE id = $1 AND project_id = $2 AND status = 'planned'
        RETURNING *`,
      [sprintId, projectId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Solo se pueden iniciar sprints planificados' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Ya hay un sprint activo en este proyecto' });
    }
    console.error('Start sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const completeSprint = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, sprintId } = req.params;
    const moveTo: string = req.body?.move_to ?? 'backlog';

    let destSprintId: string | null = null;
    if (moveTo !== 'backlog') {
      const destCheck = await query(
        `SELECT id FROM public.sprints WHERE id = $1 AND project_id = $2 AND status <> 'completed'`,
        [moveTo, projectId]
      );
      if (destCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Sprint de destino inválido' });
      }
      destSprintId = moveTo;
    }

    const result = await query(
      `WITH closed AS (
         UPDATE public.sprints
            SET status = 'completed', completed_at = NOW(),
                end_date = COALESCE(end_date, CURRENT_DATE), updated_at = NOW()
          WHERE id = $1 AND project_id = $2 AND status = 'active'
          RETURNING id
       ), moved AS (
         UPDATE public.tasks t
            SET sprint_id = $3, updated_at = NOW()
          WHERE t.sprint_id = (SELECT id FROM closed)
            AND EXISTS (
              SELECT 1 FROM public.task_statuses ts
              WHERE ts.id = t.status_id AND ts.is_completed = false
            )
          RETURNING t.id
       )
       SELECT (SELECT COUNT(*) FROM closed)::int AS closed_count,
              (SELECT COUNT(*) FROM moved)::int AS moved_count`,
      [sprintId, projectId, destSprintId]
    );

    const { closed_count, moved_count } = result.rows[0];
    if (closed_count === 0) {
      return res.status(400).json({ error: 'Solo se puede completar el sprint activo' });
    }

    const sprintResult = await query('SELECT * FROM public.sprints WHERE id = $1', [sprintId]);
    res.json({ sprint: sprintResult.rows[0], moved_count });
  } catch (error) {
    console.error('Complete sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/projects/:projectId/sprints/:sprintId/burndown
 * Retroactive reconstruction: uses TODAY's sprint_id membership crossed with
 * task_status_history to derive remaining-work-per-day. A task moved into/out
 * of the sprint mid-flight will look like it was always/never there -- an
 * accepted approximation since sprint_id changes leave no history.
 */
export const getSprintBurndown = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, sprintId } = req.params;

    const sprintResult = await query(
      `SELECT
        s.id, s.name, s.status,
        to_char(s.start_date, 'YYYY-MM-DD') AS start_date,
        to_char(s.end_date, 'YYYY-MM-DD')   AS end_date,
        to_char(COALESCE(s.end_date, (NOW() AT TIME ZONE 'America/Bogota')::date), 'YYYY-MM-DD') AS effective_end,
        to_char(LEAST(
          COALESCE(s.end_date, (NOW() AT TIME ZONE 'America/Bogota')::date),
          s.start_date + INTERVAL '365 days'
        )::date, 'YYYY-MM-DD') AS effective_end_capped
       FROM public.sprints s
       WHERE s.id = $1 AND s.project_id = $2`,
      [sprintId, projectId]
    );

    if (sprintResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sprint not found' });
    }

    const sprint = sprintResult.rows[0];

    if (!sprint.start_date) {
      return res.json({
        sprint: { id: sprint.id, name: sprint.name, status: sprint.status, start_date: null, end_date: null },
        days: [],
        meta: { truncated: false, day_count: 0, reason: 'not_started' },
      });
    }

    const truncated = sprint.effective_end !== sprint.effective_end_capped;

    const burndownResult = await query(
      `WITH day_series AS (
         SELECT generate_series($2::date, $3::date, INTERVAL '1 day')::date AS day
       ),
       sprint_tasks AS (
         SELECT t.id, t.created_at FROM public.tasks t WHERE t.sprint_id = $1
       ),
       creation_events AS (
         SELECT
           GREATEST(LEAST((t.created_at AT TIME ZONE 'America/Bogota')::date, $3::date), $2::date) AS day,
           COUNT(*)::int AS delta
         FROM sprint_tasks t
         GROUP BY 1
       ),
       completion_events AS (
         SELECT
           GREATEST(LEAST((tsh.started_at AT TIME ZONE 'America/Bogota')::date, $3::date), $2::date) AS day,
           SUM(CASE
             WHEN ts_to.is_completed AND NOT COALESCE(ts_from.is_completed, false) THEN 1
             WHEN NOT ts_to.is_completed AND COALESCE(ts_from.is_completed, false) THEN -1
             ELSE 0
           END)::int AS delta
         FROM public.task_status_history tsh
         JOIN sprint_tasks st ON st.id = tsh.task_id
         JOIN public.task_statuses ts_to ON ts_to.id = tsh.to_status_id
         LEFT JOIN public.task_statuses ts_from ON ts_from.id = tsh.from_status_id
         GROUP BY 1
       )
       SELECT
         to_char(ds.day, 'YYYY-MM-DD') AS date,
         COALESCE(SUM(ce.delta)  OVER (ORDER BY ds.day), 0)::int AS total,
         COALESCE(SUM(cpe.delta) OVER (ORDER BY ds.day), 0)::int AS done
       FROM day_series ds
       LEFT JOIN creation_events   ce  ON ce.day  = ds.day
       LEFT JOIN completion_events cpe ON cpe.day = ds.day
       ORDER BY ds.day`,
      [sprintId, sprint.start_date, sprint.effective_end_capped]
    );

    const rows = burndownResult.rows;
    const total0 = rows[0]?.total ?? 0;
    const n = rows.length;
    const days = rows.map((r: any, i: number) => ({
      date: r.date,
      total: r.total,
      remaining: r.total - r.done,
      ideal: n <= 1 ? 0 : Math.round(total0 * (1 - i / (n - 1)) * 1000) / 1000,
    }));

    res.json({
      sprint: { id: sprint.id, name: sprint.name, status: sprint.status, start_date: sprint.start_date, end_date: sprint.end_date },
      days,
      meta: { truncated, day_count: n },
    });
  } catch (error) {
    console.error('Get sprint burndown error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSprint = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, sprintId } = req.params;
    await query('UPDATE public.tasks SET sprint_id = NULL WHERE sprint_id = $1', [sprintId]);
    const result = await query(
      'DELETE FROM public.sprints WHERE id = $1 AND project_id = $2 RETURNING id',
      [sprintId, projectId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sprint not found' });
    res.json({ message: 'Sprint deleted' });
  } catch (error) {
    console.error('Delete sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
