import { query } from '../config/database.js';
/**
 * GET /api/material-types
 * List all material types (catalog)
 */
export const listMaterialTypes = async (req, res) => {
    try {
        const result = await query('SELECT * FROM public.material_types ORDER BY display_order ASC');
        res.json(result.rows);
    }
    catch (error) {
        console.error('List material types error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * GET /api/asignaturas/:asignaturaId/materiales
 * Get materiales for an asignatura
 */
export const listMaterialesForAsignatura = async (req, res) => {
    try {
        const { asignaturaId } = req.params;
        const result = await query(`SELECT
        mr.id,
        mr.asignatura_id,
        mr.material_type_id,
        mr.cantidad,
        mr.descripcion,
        mr.created_at,
        json_build_object(
          'id', mt.id,
          'name', mt.name,
          'description', mt.description,
          'icon', mt.icon,
          'created_at', mt.created_at
        ) as material_type
       FROM public.materiales_requeridos mr
       JOIN public.material_types mt ON mt.id = mr.material_type_id
       WHERE mr.asignatura_id = $1
       ORDER BY mt.display_order ASC`, [asignaturaId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('List materiales error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * POST /api/asignaturas/:asignaturaId/materiales
 * Add material requirement to asignatura
 */
export const createMaterialRequerido = async (req, res) => {
    try {
        const { asignaturaId } = req.params;
        const { material_type_id, cantidad, descripcion } = req.body;
        const result = await query(`INSERT INTO public.materiales_requeridos (asignatura_id, material_type_id, cantidad, descripcion)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [asignaturaId, material_type_id, cantidad || 1, descripcion || null]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Create material requerido error:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Este tipo de material ya está agregado a esta asignatura' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * PATCH /api/materiales/:id
 * Update material requirement (cantidad/descripcion)
 */
export const updateMaterialRequerido = async (req, res) => {
    try {
        const { id } = req.params;
        const { cantidad, descripcion } = req.body;
        const updates = [];
        const values = [];
        let paramCount = 1;
        if (cantidad !== undefined) {
            updates.push(`cantidad = $${paramCount++}`);
            values.push(cantidad);
        }
        if (descripcion !== undefined) {
            updates.push(`descripcion = $${paramCount++}`);
            values.push(descripcion);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        values.push(id);
        const result = await query(`UPDATE public.materiales_requeridos
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Material requirement not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Update material requerido error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * DELETE /api/materiales/:id
 * Remove material requirement
 */
export const deleteMaterialRequerido = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM public.materiales_requeridos WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Material requirement not found' });
        }
        res.json({ message: 'Material requirement deleted successfully' });
    }
    catch (error) {
        console.error('Delete material requerido error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * GET /api/temas/:temaId/materiales
 * Get materiales for a tema
 */
export const listMaterialesForTema = async (req, res) => {
    try {
        const { temaId } = req.params;
        const result = await query(`SELECT
        mr.id,
        mr.tema_id,
        mr.material_type_id,
        mr.cantidad,
        mr.descripcion,
        mr.created_at,
        json_build_object(
          'id', mt.id,
          'name', mt.name,
          'description', mt.description,
          'icon', mt.icon,
          'created_at', mt.created_at
        ) as material_type
       FROM public.materiales_requeridos mr
       JOIN public.material_types mt ON mt.id = mr.material_type_id
       WHERE mr.tema_id = $1
       ORDER BY mt.display_order ASC`, [temaId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('List materiales for tema error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * POST /api/temas/:temaId/materiales
 * Add material requirement to tema
 */
export const createMaterialRequeridoForTema = async (req, res) => {
    try {
        const { temaId } = req.params;
        const { material_type_id, cantidad, descripcion } = req.body;
        const result = await query(`INSERT INTO public.materiales_requeridos (tema_id, material_type_id, cantidad, descripcion)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [temaId, material_type_id, cantidad || 1, descripcion || null]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Create material requerido for tema error:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Este tipo de material ya está agregado a este tema' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};
