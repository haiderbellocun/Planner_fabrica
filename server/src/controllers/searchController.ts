import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

/**
 * GET /api/search?q=texto
 * Returns up to 5 matching projects and 5 matching tasks.
 * Respects visibility: admin/project_leader see all; members see their own.
 */
export const search = async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (q.length < 2) {
      return res.json({ projects: [], tasks: [] });
    }

    const profileId = req.user?.profileId;
    const userRole = req.user?.role;
    const pattern = `%${q}%`;

    // --- Projects ---
    let projectsQuery: string;
    let projectsParams: (string | null)[];

    if (userRole === 'admin' || userRole === 'project_leader') {
      projectsQuery = `
        SELECT id, name, tipo_programa, category, (status = 'completed') AS is_completed
        FROM public.projects
        WHERE name ILIKE $1
        ORDER BY name
        LIMIT 5
      `;
      projectsParams = [pattern];
    } else {
      projectsQuery = `
        SELECT p.id, p.name, p.tipo_programa, p.category, (p.status = 'completed') AS is_completed
        FROM public.projects p
        WHERE p.name ILIKE $1
          AND (
            EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2)
            OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.project_id = p.id AND t.assignee_id = $2)
            OR EXISTS (
              SELECT 1 FROM public.task_material_assignees tma
              JOIN public.tasks t2 ON t2.id = tma.task_id
              WHERE t2.project_id = p.id AND tma.assignee_id = $2
            )
          )
        ORDER BY p.name
        LIMIT 5
      `;
      projectsParams = [pattern, profileId!];
    }

    // --- Tasks ---
    let tasksQuery: string;
    let tasksParams: (string | null)[];

    if (userRole === 'admin' || userRole === 'project_leader') {
      tasksQuery = `
        SELECT t.id, t.title, t.project_id, p.name AS project_name, ts.name AS status_name
        FROM public.tasks t
        JOIN public.projects p ON p.id = t.project_id
        JOIN public.task_statuses ts ON ts.id = t.status_id
        WHERE t.title ILIKE $1
        ORDER BY t.title
        LIMIT 5
      `;
      tasksParams = [pattern];
    } else {
      tasksQuery = `
        SELECT t.id, t.title, t.project_id, p.name AS project_name, ts.name AS status_name
        FROM public.tasks t
        JOIN public.projects p ON p.id = t.project_id
        JOIN public.task_statuses ts ON ts.id = t.status_id
        WHERE t.title ILIKE $1
          AND (
            t.assignee_id = $2
            OR EXISTS (SELECT 1 FROM public.task_material_assignees tma WHERE tma.task_id = t.id AND tma.assignee_id = $2)
            OR EXISTS (SELECT 1 FROM public.task_tema_assignees tta WHERE tta.task_id = t.id AND tta.assignee_id = $2)
          )
        ORDER BY t.title
        LIMIT 5
      `;
      tasksParams = [pattern, profileId!];
    }

    const [projectsResult, tasksResult] = await Promise.all([
      query(projectsQuery, projectsParams),
      query(tasksQuery, tasksParams),
    ]);

    res.json({
      projects: projectsResult.rows,
      tasks: tasksResult.rows,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
