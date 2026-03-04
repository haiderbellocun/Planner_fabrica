import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

/**
 * GET /api/projects/:projectId/asignaturas
 * List all asignaturas for a project
 */
export const listAsignaturas = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const result = await query(
      `SELECT a.*,
        COUNT(mr.id) as materiales_count
       FROM public.asignaturas a
       LEFT JOIN public.materiales_requeridos mr ON mr.asignatura_id = a.id
       WHERE a.project_id = $1
       GROUP BY a.id
       ORDER BY a.display_order ASC, a.created_at ASC`,
      [projectId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List asignaturas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/programas/:programaId/asignaturas
 * List all asignaturas for a programa
 */
export const listAsignaturasByPrograma = async (req: AuthRequest, res: Response) => {
  try {
    const { programaId } = req.params;

    const result = await query(
      `SELECT a.*,
        COUNT(mr.id) as materiales_count
       FROM public.asignaturas a
       LEFT JOIN public.materiales_requeridos mr ON mr.asignatura_id = a.id
       WHERE a.programa_id = $1
       GROUP BY a.id
       ORDER BY a.display_order ASC, a.created_at ASC`,
      [programaId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List asignaturas by programa error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/asignaturas/:id
 * Get single asignatura with materiales
 */
export const getAsignatura = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const asignaturaResult = await query(
      'SELECT * FROM public.asignaturas WHERE id = $1',
      [id]
    );

    if (asignaturaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Asignatura not found' });
    }

    const asignatura = asignaturaResult.rows[0];

    // Get materiales for this asignatura
    const materialesResult = await query(
      `SELECT mr.*, mt.name as material_name, mt.icon as material_icon
       FROM public.materiales_requeridos mr
       JOIN public.material_types mt ON mt.id = mr.material_type_id
       WHERE mr.asignatura_id = $1
       ORDER BY mt.display_order ASC`,
      [id]
    );

    res.json({
      ...asignatura,
      materiales: materialesResult.rows,
    });
  } catch (error) {
    console.error('Get asignatura error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/projects/:projectId/asignaturas
 * Create new asignatura (DEPRECATED - use createAsignaturaInPrograma instead)
 */
export const createAsignatura = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { name, code, description, display_order } = req.body;

    const result = await query(
      `INSERT INTO public.asignaturas (project_id, name, code, description, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectId, name, code || null, description || null, display_order || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create asignatura error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/programas/:programaId/asignaturas
 * Create new asignatura in a programa
 */
export const createAsignaturaInPrograma = async (req: AuthRequest, res: Response) => {
  try {
    const { programaId } = req.params;
    const { name, code, description, display_order, semestre, tipo_asignatura } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await query(
      `INSERT INTO public.asignaturas (programa_id, name, code, description, display_order, semestre, tipo_asignatura)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        programaId,
        name.trim(),
        code || null,
        description || null,
        display_order || 0,
        semestre || null,
        tipo_asignatura || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create asignatura in programa error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/asignaturas/:id
 * Update asignatura
 */
export const updateAsignatura = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, description, display_order, semestre, tipo_asignatura } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (code !== undefined) {
      updates.push(`code = $${paramCount++}`);
      values.push(code);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramCount++}`);
      values.push(display_order);
    }
    if (semestre !== undefined) {
      updates.push(`semestre = $${paramCount++}`);
      values.push(semestre);
    }
    if (tipo_asignatura !== undefined) {
      updates.push(`tipo_asignatura = $${paramCount++}`);
      values.push(tipo_asignatura);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await query(
      `UPDATE public.asignaturas
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asignatura not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update asignatura error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/asignaturas/:id
 * Delete asignatura (cascades to materiales)
 */
export const deleteAsignatura = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM public.asignaturas WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asignatura not found' });
    }

    res.json({ message: 'Asignatura deleted successfully' });
  } catch (error) {
    console.error('Delete asignatura error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/asignaturas/:id/temas-with-materiales
 * Get all temas with their materials for an asignatura (for task assignment)
 */
export const getTemasWithMateriales = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get all temas for this asignatura
    const temasResult = await query(
      `SELECT t.*
       FROM public.temas t
       WHERE t.asignatura_id = $1
       ORDER BY t.display_order ASC, t.created_at ASC`,
      [id]
    );

    // For each tema, get its materials
    const temasWithMateriales = await Promise.all(
      temasResult.rows.map(async (tema) => {
        const materialesResult = await query(
          `SELECT mr.*, mt.name, mt.icon, mt.description
           FROM public.materiales_requeridos mr
           JOIN public.material_types mt ON mt.id = mr.material_type_id
           WHERE mr.tema_id = $1
           ORDER BY mt.display_order ASC`,
          [tema.id]
        );

        return {
          ...tema,
          materiales: materialesResult.rows,
        };
      })
    );

    res.json(temasWithMateriales);
  } catch (error) {
    console.error('Get temas with materiales error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
