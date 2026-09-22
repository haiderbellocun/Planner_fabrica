import { query } from '../config/database.js';
/**
 * GET /api/projects/:projectId/programas
 * List all programas for a project with their asignaturas
 */
export const listProgramas = async (req, res) => {
    try {
        const { projectId } = req.params;
        // Get all programas for the project
        const programasResult = await query(`SELECT p.*
       FROM public.programas p
       WHERE p.project_id = $1
       ORDER BY p.display_order ASC, p.created_at ASC`, [projectId]);
        // Get every asignatura for every programa in one shot instead of one
        // query per programa (N+1) -- with dozens of programas that pattern was
        // firing that many near-simultaneous queries and exhausting the DB's
        // connection pool.
        const programaIds = programasResult.rows.map((p) => p.id);
        const asignaturasResult = programaIds.length
            ? await query(`SELECT a.*, COUNT(t.id) AS temas_count
           FROM public.asignaturas a
           LEFT JOIN public.temas t ON t.asignatura_id = a.id
           WHERE a.programa_id = ANY($1)
           GROUP BY a.id
           ORDER BY a.programa_id, a.display_order ASC, a.created_at ASC`, [programaIds])
            : { rows: [] };
        const asignaturasByPrograma = new Map();
        for (const asignatura of asignaturasResult.rows) {
            const key = String(asignatura.programa_id);
            if (!asignaturasByPrograma.has(key))
                asignaturasByPrograma.set(key, []);
            asignaturasByPrograma.get(key).push({
                ...asignatura,
                temas_count: parseInt(asignatura.temas_count, 10),
            });
        }
        const programasWithAsignaturas = programasResult.rows.map((programa) => {
            const asignaturas = asignaturasByPrograma.get(String(programa.id)) || [];
            return {
                ...programa,
                asignaturas,
                asignaturas_count: asignaturas.length,
            };
        });
        res.json(programasWithAsignaturas);
    }
    catch (error) {
        console.error('List programas error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * GET /api/programas/:id
 * Get single programa with asignaturas
 */
export const getPrograma = async (req, res) => {
    try {
        const { id } = req.params;
        const programaResult = await query('SELECT * FROM public.programas WHERE id = $1', [id]);
        if (programaResult.rows.length === 0) {
            return res.status(404).json({ error: 'Programa not found' });
        }
        const programa = programaResult.rows[0];
        // Get asignaturas for this programa
        const asignaturasResult = await query(`SELECT a.*, COUNT(t.id) as temas_count
       FROM public.asignaturas a
       LEFT JOIN public.temas t ON t.asignatura_id = a.id
       WHERE a.programa_id = $1
       GROUP BY a.id
       ORDER BY a.display_order ASC`, [id]);
        res.json({
            ...programa,
            asignaturas: asignaturasResult.rows,
        });
    }
    catch (error) {
        console.error('Get programa error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * POST /api/projects/:projectId/programas
 * Create new programa
 */
export const createPrograma = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { name, code, description, display_order, tipo_programa } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Name is required' });
        }
        const result = await query(`INSERT INTO public.programas (project_id, name, code, description, display_order, tipo_programa)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`, [projectId, name.trim(), code || null, description || null, display_order || 0, tipo_programa || null]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Create programa error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * PATCH /api/programas/:id
 * Update programa
 */
export const updatePrograma = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, description, display_order, tipo_programa } = req.body;
        const updates = [];
        const values = [];
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
        if (tipo_programa !== undefined) {
            updates.push(`tipo_programa = $${paramCount++}`);
            values.push(tipo_programa);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        values.push(id);
        const result = await query(`UPDATE public.programas
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Programa not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Update programa error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * DELETE /api/programas/:id
 * Delete programa (cascades to asignaturas, temas, materiales)
 */
export const deletePrograma = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM public.programas WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Programa not found' });
        }
        res.json({ message: 'Programa deleted successfully' });
    }
    catch (error) {
        console.error('Delete programa error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
