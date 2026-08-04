import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

export const listEquipos = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT
         e.*,
         COALESCE(
           (SELECT json_agg(json_build_object(
              'id', em.id,
              'profile_id', em.profile_id,
              'full_name', p.full_name,
              'avatar_url', p.avatar_url
            ) ORDER BY p.full_name)
            FROM public.equipo_members em
            JOIN public.profiles p ON p.id = em.profile_id
            WHERE em.equipo_id = e.id
           ), '[]'::json
         ) AS members
       FROM public.equipos e
       ORDER BY e.slot ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List equipos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEquipo = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let i = 1;

    if (name !== undefined)  { updates.push(`name = $${i++}`);  values.push(name); }
    if (color !== undefined) { updates.push(`color = $${i++}`); values.push(color); }

    values.push(id);
    const result = await query(
      `UPDATE public.equipos SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Equipo not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update equipo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const setEquipoMembers = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const profileIds: string[] = Array.isArray(req.body?.profileIds) ? req.body.profileIds : [];

    const equipoExists = await query('SELECT id FROM public.equipos WHERE id = $1', [id]);
    if (equipoExists.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo not found' });
    }

    await query('BEGIN');
    try {
      // Una persona solo puede pertenecer a un equipo: se libera de este equipo
      // y de cualquier otro al que ya perteneciera antes de reasignarla.
      await query(
        'DELETE FROM public.equipo_members WHERE equipo_id = $1 OR profile_id = ANY($2::uuid[])',
        [id, profileIds]
      );

      for (const profileId of profileIds) {
        if (!profileId) continue;
        await query(
          `INSERT INTO public.equipo_members (equipo_id, profile_id) VALUES ($1, $2)
           ON CONFLICT (profile_id) DO NOTHING`,
          [id, profileId]
        );
      }

      await query('COMMIT');
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

    const result = await query(
      `SELECT em.id, em.profile_id, p.full_name, p.avatar_url
       FROM public.equipo_members em
       JOIN public.profiles p ON p.id = em.profile_id
       WHERE em.equipo_id = $1
       ORDER BY p.full_name`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Set equipo members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
