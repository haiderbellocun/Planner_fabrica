import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

export const getCalendarEvents = async (req: AuthRequest, res: Response) => {
  try {
    const projectsResult = await query(`
      SELECT
        p.id, p.name, p.key, p.end_date, p.status,
        ROUND(
          COUNT(t.id) FILTER (WHERE ts.is_completed = true)::numeric * 100.0
          / NULLIF(COUNT(t.id), 0), 0
        ) AS completion_rate
      FROM public.projects p
      LEFT JOIN public.tasks t ON t.project_id = p.id
      LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
      WHERE p.end_date IS NOT NULL
      GROUP BY p.id
      ORDER BY p.end_date ASC
    `);

    const tasksResult = await query(`
      SELECT
        t.id, t.title, t.due_date,
        ts.name AS status_name, ts.color AS status_color, ts.is_completed,
        assignee.id AS assignee_id, assignee.full_name AS assignee_name,
        assignee.avatar_url,
        proj.name AS project_name, proj.key AS project_key
      FROM public.tasks t
      JOIN public.task_statuses ts ON ts.id = t.status_id
      LEFT JOIN public.profiles assignee ON assignee.id = t.assignee_id
      JOIN public.projects proj ON proj.id = t.project_id
      WHERE t.due_date IS NOT NULL
      ORDER BY t.due_date ASC
    `);

    res.json({
      projects: projectsResult.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        key: r.key,
        end_date: r.end_date instanceof Date ? r.end_date.toISOString().slice(0, 10) : typeof r.end_date === 'string' ? r.end_date.slice(0, 10) : null,
        status: r.status,
        completion_rate: Number(r.completion_rate ?? 0),
      })),
      tasks: tasksResult.rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        due_date: r.due_date instanceof Date ? r.due_date.toISOString().slice(0, 10) : typeof r.due_date === 'string' ? r.due_date.slice(0, 10) : null,
        status_name: r.status_name,
        status_color: r.status_color,
        is_completed: r.is_completed,
        assignee_id: r.assignee_id ?? null,
        assignee_name: r.assignee_name ?? null,
        avatar_url: r.avatar_url ?? null,
        project_name: r.project_name,
        project_key: r.project_key,
      })),
    });
  } catch (error) {
    console.error('Calendar events error:', error);
    res.status(500).json({ error: 'Error al cargar eventos del calendario' });
  }
};
