import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

/**
 * POST /api/projects/:id/pin
 * Pin a project for the current user only -- personal, no project
 * management permission required beyond being able to see the project.
 */
export const pinProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const profileId = req.user?.profileId;

    const projectExists = await query('SELECT id FROM public.projects WHERE id = $1', [projectId]);
    if (projectExists.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await query(
      `INSERT INTO public.project_pins (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [projectId, profileId]
    );

    res.status(201).json({ pinned: true });
  } catch (error) {
    console.error('Pin project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/projects/:id/pin
 * Unpin a project for the current user.
 */
export const unpinProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const profileId = req.user?.profileId;

    await query('DELETE FROM public.project_pins WHERE project_id = $1 AND user_id = $2', [projectId, profileId]);

    res.json({ pinned: false });
  } catch (error) {
    console.error('Unpin project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
