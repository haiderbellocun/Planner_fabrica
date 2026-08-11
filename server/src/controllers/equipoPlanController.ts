import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { normalizeToMonday, todayMonday } from '../utils/weekDates.js';

/**
 * GET /api/equipos/:id/plan?week=YYYY-MM-DD
 * Plan semanal de un equipo, agrupado por colaborador. Cada item es un enlace
 * en vivo a una tarea real -- el estado "terminado" nunca se guarda aparte,
 * siempre se lee de task_statuses.is_completed en el momento de la consulta.
 */
export const listEquipoPlan = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const rawWeek = typeof req.query.week === 'string' ? req.query.week : undefined;
    const weekStart = rawWeek ? normalizeToMonday(rawWeek) : todayMonday();

    const equipoExists = await query('SELECT id FROM public.equipos WHERE id = $1', [id]);
    if (equipoExists.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo not found' });
    }

    // Auto-seed: para cada miembro que todavia no tiene NINGUN item en esta
    // semana, se le agregan automaticamente sus tareas (como responsable
    // directo) cuya fecha de entrega cae en esta semana -- para no obligar a
    // agregar a mano lo que ya esta planificado en Planner. Si la persona ya
    // tiene al menos un item (agregado a mano o por esta misma siembra antes),
    // no se vuelve a tocar su seccion -- se respeta lo que el lider haya
    // curado desde entonces (incluyendo si borro todo a proposito).
    await query(
      `INSERT INTO public.equipo_plan_items (equipo_id, profile_id, task_id, week_start, added_by)
       SELECT $1, t.assignee_id, t.id, $2, NULL
       FROM public.tasks t
       WHERE t.assignee_id IN (SELECT profile_id FROM public.equipo_members WHERE equipo_id = $1)
         AND t.due_date BETWEEN $2::date AND ($2::date + INTERVAL '6 days')
         AND t.assignee_id NOT IN (
           SELECT profile_id FROM public.equipo_plan_items WHERE equipo_id = $1 AND week_start = $2
         )
       ON CONFLICT (equipo_id, profile_id, task_id, week_start) DO NOTHING`,
      [id, weekStart]
    );

    const result = await query(
      `WITH member_base AS (
         SELECT em.profile_id, p.full_name, p.avatar_url, TRUE AS is_current_member
         FROM public.equipo_members em
         JOIN public.profiles p ON p.id = em.profile_id
         WHERE em.equipo_id = $1
         UNION
         SELECT epi.profile_id, p.full_name, p.avatar_url, FALSE AS is_current_member
         FROM public.equipo_plan_items epi
         JOIN public.profiles p ON p.id = epi.profile_id
         WHERE epi.equipo_id = $1 AND epi.week_start = $2
           AND epi.profile_id NOT IN (SELECT profile_id FROM public.equipo_members WHERE equipo_id = $1)
       )
       SELECT
         mb.profile_id, mb.full_name, mb.avatar_url, mb.is_current_member,
         epi.id            AS item_id,
         epi.created_at    AS item_added_at,
         epi.added_by,
         adder.full_name   AS added_by_name,
         t.id              AS task_id,
         t.title           AS task_title,
         t.task_number,
         t.due_date,
         t.priority,
         proj.id           AS project_id,
         proj.name         AS project_name,
         proj.key          AS project_key,
         ts.id             AS status_id,
         ts.name           AS status_name,
         ts.color          AS status_color,
         ts.is_completed   AS status_is_completed
       FROM member_base mb
       LEFT JOIN public.equipo_plan_items epi
         ON epi.equipo_id = $1 AND epi.profile_id = mb.profile_id AND epi.week_start = $2
       LEFT JOIN public.tasks t          ON t.id = epi.task_id
       LEFT JOIN public.projects proj    ON proj.id = t.project_id
       LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
       LEFT JOIN public.profiles adder   ON adder.id = epi.added_by
       ORDER BY mb.full_name ASC, epi.created_at ASC`,
      [id, weekStart]
    );

    const sectionsByProfile = new Map<string, {
      profile_id: string;
      full_name: string | null;
      avatar_url: string | null;
      is_current_member: boolean;
      items: unknown[];
    }>();

    for (const r of result.rows) {
      if (!sectionsByProfile.has(r.profile_id)) {
        sectionsByProfile.set(r.profile_id, {
          profile_id: r.profile_id,
          full_name: r.full_name,
          avatar_url: r.avatar_url,
          is_current_member: r.is_current_member,
          items: [],
        });
      }
      if (r.item_id) {
        sectionsByProfile.get(r.profile_id)!.items.push({
          id: r.item_id,
          added_by: r.added_by,
          added_by_name: r.added_by_name,
          created_at: r.item_added_at,
          task: {
            id: r.task_id,
            title: r.task_title,
            task_number: r.task_number,
            due_date: r.due_date,
            priority: r.priority,
            status: {
              id: r.status_id,
              name: r.status_name,
              color: r.status_color,
              is_completed: r.status_is_completed,
            },
            project: {
              id: r.project_id,
              name: r.project_name,
              key: r.project_key,
            },
          },
        });
      }
    }

    res.json({
      equipo_id: id,
      week_start: weekStart,
      sections: Array.from(sectionsByProfile.values()),
    });
  } catch (error) {
    console.error('List equipo plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/equipos/:id/plan/items
 * body: { profile_id, task_id, week_start }
 */
export const addEquipoPlanItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { profile_id, task_id, week_start } = req.body;
    const addedBy = req.user?.profileId;

    if (!profile_id || !task_id || !week_start) {
      return res.status(400).json({ error: 'profile_id, task_id y week_start son requeridos' });
    }

    const equipoExists = await query('SELECT id FROM public.equipos WHERE id = $1', [id]);
    if (equipoExists.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo not found' });
    }

    const isMember = await query(
      'SELECT 1 FROM public.equipo_members WHERE equipo_id = $1 AND profile_id = $2',
      [id, profile_id]
    );
    if (isMember.rows.length === 0) {
      return res.status(400).json({ error: 'La persona no pertenece a este equipo' });
    }

    const taskExists = await query('SELECT id FROM public.tasks WHERE id = $1', [task_id]);
    if (taskExists.rows.length === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    const normalizedWeek = normalizeToMonday(week_start);

    const result = await query(
      `INSERT INTO public.equipo_plan_items (equipo_id, profile_id, task_id, week_start, added_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (equipo_id, profile_id, task_id, week_start) DO NOTHING
       RETURNING *`,
      [id, profile_id, task_id, normalizedWeek, addedBy]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Esta tarea ya está en el plan de esta persona para esta semana' });
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add equipo plan item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/equipos/:id/plan/items/:itemId
 * Solo desvincula el item del plan -- nunca borra ni modifica la tarea real.
 */
export const removeEquipoPlanItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id, itemId } = req.params;

    const result = await query(
      'DELETE FROM public.equipo_plan_items WHERE id = $1 AND equipo_id = $2 RETURNING id',
      [itemId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Item removed' });
  } catch (error) {
    console.error('Remove equipo plan item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
