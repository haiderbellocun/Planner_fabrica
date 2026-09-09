import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

/**
 * GET /api/profiles
 * List all profiles
 */
export const listProfiles = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT p.id, p.full_name, p.avatar_url, p.email, p.cargo, p.created_at
       FROM public.profiles p
       JOIN public.users u ON u.id = p.user_id AND u.is_active = true
       ORDER BY p.full_name ASC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List profiles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/profiles/:id
 * Get single profile
 */
export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT id, full_name, avatar_url, email, cargo, created_at, updated_at FROM public.profiles WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/profiles/:id/capacity
 * Update a profile's weekly hours capacity. Admin/project_leader only (any profile);
 * a user may also set their own. `weekly_hours_capacity: null` clears it back to
 * "sin configurar" instead of forcing a default.
 */
export const updateCapacity = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { weekly_hours_capacity } = req.body;
    const role = req.user?.role;
    const isSelf = req.user?.profileId === id;

    if (role !== 'admin' && role !== 'project_leader' && !isSelf) {
      return res.status(403).json({ error: 'No tienes permiso para editar esta capacidad' });
    }

    let value: number | null = null;
    if (weekly_hours_capacity !== null && weekly_hours_capacity !== undefined) {
      value = Number(weekly_hours_capacity);
      if (Number.isNaN(value) || value < 0) {
        return res.status(400).json({ error: 'weekly_hours_capacity debe ser un número mayor o igual a 0' });
      }
    }

    const result = await query(
      'UPDATE public.profiles SET weekly_hours_capacity = $1 WHERE id = $2 RETURNING id, weekly_hours_capacity',
      [value, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update capacity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
