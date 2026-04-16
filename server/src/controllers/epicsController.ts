import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

export const listEpics = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      `SELECT e.*, p.full_name as creator_name
       FROM public.epics e
       LEFT JOIN public.profiles p ON p.id = e.created_by
       WHERE e.project_id = $1
       ORDER BY e.display_order ASC, e.created_at ASC`,
      [projectId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List epics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createEpic = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const profileId = req.user?.profileId;
    const { title, description, color, status, start_date, end_date } = req.body;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    const result = await query(
      `INSERT INTO public.epics (project_id, title, description, color, status, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'open'), $6, $7, $8)
       RETURNING *`,
      [
        projectId,
        title,
        description || null,
        color || '#6366f1',
        status || 'open',
        start_date || null,
        end_date || null,
        profileId || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create epic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEpic = async (req: AuthRequest, res: Response) => {
  try {
    const { epicId } = req.params;
    const { title, description, color, status, start_date, end_date, display_order } = req.body;

    const result = await query(
      `UPDATE public.epics
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           color = COALESCE($3, color),
           status = COALESCE($4, status),
           start_date = COALESCE($5, start_date),
           end_date = COALESCE($6, end_date),
           display_order = COALESCE($7, display_order),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [title, description, color, status, start_date, end_date, display_order, epicId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Epic not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update epic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteEpic = async (req: AuthRequest, res: Response) => {
  try {
    const { epicId } = req.params;
    await query('UPDATE public.tasks SET epic_id = NULL WHERE epic_id = $1', [epicId]);
    const result = await query('DELETE FROM public.epics WHERE id = $1 RETURNING id', [epicId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Epic not found' });
    res.json({ message: 'Epic deleted' });
  } catch (error) {
    console.error('Delete epic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
