import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

const CHECKLIST_FIELDS = [
  'listo_para_revisar', 'qa_status',
  'g1_inf','g1_vid','g1_pod','g1_glos','g1_fecha','g1_rev',
  'g2_inf','g2_vid','g2_pod','g2_glos','g2_fecha','g2_rev',
  'g3_inf','g3_vid','g3_pod','g3_glos','g3_fecha','g3_rev',
  'g4_inf','g4_vid','g4_pod','g4_glos','g4_fecha','g4_rev',
  'g5_inf','g5_vid','g5_pod','g5_glos','g5_fecha','g5_rev',
  'carga_completa', 'actividades_moodle',
] as const;

/**
 * GET /api/projects/:projectId/checklist
 * Devuelve el checklist de todas las asignaturas del proyecto.
 * Si una asignatura aún no tiene fila en checklist la incluye con valores por defecto.
 */
export const getProjectChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const result = await query(
      `SELECT
         a.id             AS asignatura_id,
         a.name           AS asignatura_name,
         a.code           AS asignatura_code,
         a.semestre,
         pr.id            AS programa_id,
         pr.name          AS programa_name,
         p.full_name      AS maestro_name,
         -- checklist columns (NULL when no row exists yet)
         cl.id            AS checklist_id,
         COALESCE(cl.listo_para_revisar, 'sin_iniciar') AS listo_para_revisar,
         COALESCE(cl.qa_status,          'sin_iniciar') AS qa_status,
         COALESCE(cl.g1_inf,   FALSE) AS g1_inf,
         COALESCE(cl.g1_vid,   FALSE) AS g1_vid,
         COALESCE(cl.g1_pod,   FALSE) AS g1_pod,
         COALESCE(cl.g1_glos,  FALSE) AS g1_glos,
         COALESCE(cl.g1_fecha, FALSE) AS g1_fecha,
         COALESCE(cl.g1_rev,   FALSE) AS g1_rev,
         COALESCE(cl.g2_inf,   FALSE) AS g2_inf,
         COALESCE(cl.g2_vid,   FALSE) AS g2_vid,
         COALESCE(cl.g2_pod,   FALSE) AS g2_pod,
         COALESCE(cl.g2_glos,  FALSE) AS g2_glos,
         COALESCE(cl.g2_fecha, FALSE) AS g2_fecha,
         COALESCE(cl.g2_rev,   FALSE) AS g2_rev,
         COALESCE(cl.g3_inf,   FALSE) AS g3_inf,
         COALESCE(cl.g3_vid,   FALSE) AS g3_vid,
         COALESCE(cl.g3_pod,   FALSE) AS g3_pod,
         COALESCE(cl.g3_glos,  FALSE) AS g3_glos,
         COALESCE(cl.g3_fecha, FALSE) AS g3_fecha,
         COALESCE(cl.g3_rev,   FALSE) AS g3_rev,
         COALESCE(cl.g4_inf,   FALSE) AS g4_inf,
         COALESCE(cl.g4_vid,   FALSE) AS g4_vid,
         COALESCE(cl.g4_pod,   FALSE) AS g4_pod,
         COALESCE(cl.g4_glos,  FALSE) AS g4_glos,
         COALESCE(cl.g4_fecha, FALSE) AS g4_fecha,
         COALESCE(cl.g4_rev,   FALSE) AS g4_rev,
         COALESCE(cl.g5_inf,   FALSE) AS g5_inf,
         COALESCE(cl.g5_vid,   FALSE) AS g5_vid,
         COALESCE(cl.g5_pod,   FALSE) AS g5_pod,
         COALESCE(cl.g5_glos,  FALSE) AS g5_glos,
         COALESCE(cl.g5_fecha, FALSE) AS g5_fecha,
         COALESCE(cl.g5_rev,   FALSE) AS g5_rev,
         COALESCE(cl.carga_completa,     FALSE) AS carga_completa,
         COALESCE(cl.actividades_moodle, FALSE) AS actividades_moodle,
         cl.updated_at,
         upd.full_name AS updated_by_name
       FROM public.asignaturas a
       LEFT JOIN public.programas pr ON pr.id = a.programa_id
       LEFT JOIN public.profiles p   ON p.id  = a.maestro_id
       LEFT JOIN public.asignatura_checklist cl ON cl.asignatura_id = a.id
       LEFT JOIN public.profiles upd ON upd.id = cl.updated_by
       WHERE (a.project_id = $1 OR pr.project_id = $1)
       ORDER BY pr.name ASC, a.semestre ASC NULLS LAST, a.name ASC`,
      [projectId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('getProjectChecklist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/checklist/:asignaturaId
 * Upsert del checklist de una asignatura.
 * Acepta cualquier subconjunto de los campos del checklist.
 */
export const upsertChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const { asignaturaId } = req.params;
    const profileId = req.user?.profileId;
    const body = req.body as Record<string, unknown>;

    // Sólo acepta campos conocidos del checklist
    const allowed = new Set<string>(CHECKLIST_FIELDS);
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (allowed.has(k)) updates[k] = v;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    // Construir SET dinámico
    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
    const values = [asignaturaId, ...Object.values(updates), profileId];
    const updatedByIdx = values.length;

    const upsertSql = `
      INSERT INTO public.asignatura_checklist (asignatura_id, ${Object.keys(updates).join(', ')}, updated_by)
      VALUES ($1, ${Object.keys(updates).map((_, i) => `$${i + 2}`).join(', ')}, $${updatedByIdx})
      ON CONFLICT (asignatura_id) DO UPDATE
        SET ${setClauses.join(', ')}, updated_by = $${updatedByIdx}, updated_at = NOW()
      RETURNING *`;

    const result = await query(upsertSql, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('upsertChecklist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
