import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

export const listTeams = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      `SELECT
         t.*,
         COALESCE(
           (SELECT json_agg(json_build_object(
              'id', tm.id,
              'profile_id', tm.profile_id,
              'full_name', p.full_name,
              'avatar_url', p.avatar_url
            ) ORDER BY p.full_name)
            FROM public.team_members tm
            JOIN public.profiles p ON p.id = tm.profile_id
            WHERE tm.team_id = t.id
           ), '[]'::json
         ) AS members
       FROM public.teams t
       WHERE t.project_id = $1
       ORDER BY t.display_order ASC, t.created_at ASC`,
      [projectId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTeam = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const profileId = req.user?.profileId;
    const { name, color } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await query(
      `INSERT INTO public.teams (project_id, name, color, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [projectId, name, color || '#6366f1', profileId || null]
    );
    res.status(201).json({ ...result.rows[0], members: [] });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTeam = async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const { name, color, display_order } = req.body;

    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let i = 1;

    if (name !== undefined)          { updates.push(`name = $${i++}`);          values.push(name); }
    if (color !== undefined)         { updates.push(`color = $${i++}`);         values.push(color); }
    if (display_order !== undefined) { updates.push(`display_order = $${i++}`); values.push(display_order); }

    values.push(teamId);
    const result = await query(
      `UPDATE public.teams SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTeam = async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const result = await query('DELETE FROM public.teams WHERE id = $1 RETURNING id', [teamId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    res.json({ message: 'Team deleted' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const setTeamMembers = async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const profileIds: string[] = Array.isArray(req.body?.profileIds) ? req.body.profileIds : [];

    const teamExists = await query('SELECT id FROM public.teams WHERE id = $1', [teamId]);
    if (teamExists.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    await query('BEGIN');
    try {
      await query('DELETE FROM public.team_members WHERE team_id = $1', [teamId]);

      for (const profileId of profileIds) {
        if (!profileId) continue;
        await query(
          `INSERT INTO public.team_members (team_id, profile_id) VALUES ($1, $2)
           ON CONFLICT (team_id, profile_id) DO NOTHING`,
          [teamId, profileId]
        );
      }

      await query('COMMIT');
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

    const result = await query(
      `SELECT tm.id, tm.profile_id, p.full_name, p.avatar_url
       FROM public.team_members tm
       JOIN public.profiles p ON p.id = tm.profile_id
       WHERE tm.team_id = $1
       ORDER BY p.full_name`,
      [teamId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Set team members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
