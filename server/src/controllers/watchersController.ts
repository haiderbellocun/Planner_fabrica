import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

/**
 * GET /api/tasks/:id/watchers
 * Anyone authenticated can see who's watching -- watching itself carries no
 * extra project permission, same as commenting.
 */
export const listWatchers = async (req: AuthRequest, res: Response) => {
  try {
    const { id: taskId } = req.params;
    const profileId = req.user?.profileId;

    const result = await query(
      `SELECT p.id, p.full_name, p.avatar_url
       FROM public.task_watchers tw
       JOIN public.profiles p ON p.id = tw.user_id
       WHERE tw.task_id = $1
       ORDER BY tw.created_at ASC`,
      [taskId]
    );

    res.json({
      watchers: result.rows,
      is_watching: result.rows.some((w: any) => w.id === profileId),
    });
  } catch (error) {
    console.error('List watchers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/tasks/:id/watchers
 * Start watching this task (self only).
 */
export const followTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id: taskId } = req.params;
    const profileId = req.user?.profileId;

    const taskExists = await query('SELECT id FROM public.tasks WHERE id = $1', [taskId]);
    if (taskExists.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await query(
      `INSERT INTO public.task_watchers (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [taskId, profileId]
    );

    res.status(201).json({ watching: true });
  } catch (error) {
    console.error('Follow task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/tasks/:id/watchers
 * Stop watching this task (self only).
 */
export const unfollowTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id: taskId } = req.params;
    const profileId = req.user?.profileId;

    await query('DELETE FROM public.task_watchers WHERE task_id = $1 AND user_id = $2', [taskId, profileId]);

    res.json({ watching: false });
  } catch (error) {
    console.error('Unfollow task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
