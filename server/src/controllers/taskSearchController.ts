import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { validUuidOrNull } from './reportsMetrics.js';

/**
 * GET /api/tasks/search?q=&assignee_id=
 * Buscador de tareas cruzado entre TODOS los proyectos, con datos ricos
 * (proyecto, estado, asignado, fecha) -- usado por el picker de tareas del
 * plan semanal de equipos. A diferencia de GET /api/search (el typeahead del
 * nav, que filtra por rol), esta ruta no filtra por proyecto/rol porque queda
 * restringida a admin/project_leader (planEditorMiddleware), que ya ven todo
 * en cualquier otro lado de la app -- no crea una fuga de visibilidad nueva.
 */
export const searchTasksForPicker = async (req: AuthRequest, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const assigneeId = validUuidOrNull(req.query.assignee_id);

    if (q.length < 2 && !assigneeId) {
      return res.json([]);
    }

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (q.length >= 2) {
      conditions.push(`t.title ILIKE $${i++}`);
      params.push(`%${q}%`);
    }
    if (assigneeId) {
      conditions.push(`t.assignee_id = $${i++}`);
      params.push(assigneeId);
    }

    const result = await query(
      `SELECT
         t.id, t.title, t.task_number, t.due_date, t.priority,
         proj.id AS project_id, proj.name AS project_name, proj.key AS project_key,
         ts.id AS status_id, ts.name AS status_name, ts.color AS status_color, ts.is_completed AS status_is_completed,
         assignee.id AS assignee_id, assignee.full_name AS assignee_name, assignee.avatar_url AS assignee_avatar
       FROM public.tasks t
       JOIN public.projects proj ON proj.id = t.project_id
       JOIN public.task_statuses ts ON ts.id = t.status_id
       LEFT JOIN public.profiles assignee ON assignee.id = t.assignee_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.updated_at DESC
       LIMIT 20`,
      params
    );

    res.json(result.rows.map(r => ({
      id: r.id,
      title: r.title,
      task_number: r.task_number,
      due_date: r.due_date,
      priority: r.priority,
      project: { id: r.project_id, name: r.project_name, key: r.project_key },
      status: { id: r.status_id, name: r.status_name, color: r.status_color, is_completed: r.status_is_completed },
      assignee: r.assignee_id ? { id: r.assignee_id, full_name: r.assignee_name, avatar_url: r.assignee_avatar } : null,
    })));
  } catch (error) {
    console.error('Search tasks for picker error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
