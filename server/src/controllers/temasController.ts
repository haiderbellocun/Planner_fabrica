import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

/**
 * GET /api/asignaturas/:asignaturaId/temas
 * List all temas for an asignatura
 */
export const listTemas = async (req: AuthRequest, res: Response) => {
  try {
    const { asignaturaId } = req.params;

    const result = await query(
      `SELECT t.*,
        COUNT(mr.id) as materiales_count
       FROM public.temas t
       LEFT JOIN public.materiales_requeridos mr ON mr.tema_id = t.id
       WHERE t.asignatura_id = $1
       GROUP BY t.id
       ORDER BY t.display_order ASC, t.created_at ASC`,
      [asignaturaId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List temas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/temas/:id
 * Get single tema with materiales
 */
export const getTema = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const temaResult = await query(
      'SELECT * FROM public.temas WHERE id = $1',
      [id]
    );

    if (temaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tema not found' });
    }

    const tema = temaResult.rows[0];

    // Get materiales for this tema
    const materialesResult = await query(
      `SELECT mr.*, mt.name as material_name, mt.icon as material_icon
       FROM public.materiales_requeridos mr
       JOIN public.material_types mt ON mt.id = mr.material_type_id
       WHERE mr.tema_id = $1
       ORDER BY mt.display_order ASC`,
      [id]
    );

    res.json({
      ...tema,
      materiales: materialesResult.rows,
    });
  } catch (error) {
    console.error('Get tema error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/asignaturas/:asignaturaId/temas
 * Create new tema
 */
export const createTema = async (req: AuthRequest, res: Response) => {
  try {
    const { asignaturaId } = req.params;
    const { title, description, display_order } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await query(
      `INSERT INTO public.temas (asignatura_id, title, description, display_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [asignaturaId, title.trim(), description || null, display_order || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create tema error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/temas/:id
 * Update tema
 */
export const updateTema = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, display_order } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramCount++}`);
      values.push(display_order);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await query(
      `UPDATE public.temas
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tema not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update tema error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/temas/:id
 * Delete tema (cascades to materiales)
 */
export const deleteTema = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM public.temas WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tema not found' });
    }

    res.json({ message: 'Tema deleted successfully' });
  } catch (error) {
    console.error('Delete tema error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
