import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

const BOOL_CHECK_FIELDS = new Set([
  'g1_inf','g1_vid','g1_pod','g1_glos','g1_fecha','g1_rev',
  'g2_inf','g2_vid','g2_pod','g2_glos','g2_fecha','g2_rev',
  'g3_inf','g3_vid','g3_pod','g3_glos','g3_fecha','g3_rev',
  'g4_inf','g4_vid','g4_pod','g4_glos','g4_fecha','g4_rev',
  'g5_inf','g5_vid','g5_pod','g5_glos','g5_fecha','g5_rev',
  'carga_completa', 'actividades_moodle',
]);

const STATUS_FIELDS = new Set(['listo_para_revisar', 'qa_status']);

/**
 * GET /api/projects/:projectId/checklist
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
         COALESCE(cl.user_checks, '{}'::jsonb)  AS user_checks,
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
 *
 * Role-aware upsert:
 *  - Admin: boolean check fields → update column directly AND remove from user_checks
 *  - Non-admin: boolean check fields → merge into user_checks JSONB
 *  - Both: status fields (listo_para_revisar, qa_status) → update column directly
 */
export const upsertChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const { asignaturaId } = req.params;
    const profileId = req.user?.profileId;
    const isAdmin = req.user?.role === 'admin';
    const body = req.body as Record<string, unknown>;

    // Separate incoming fields into direct column updates and user_checks updates
    const directColUpdates: Record<string, unknown> = {};
    const userChecksUpdate: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(body)) {
      if (STATUS_FIELDS.has(k)) {
        directColUpdates[k] = v;
      } else if (BOOL_CHECK_FIELDS.has(k)) {
        if (isAdmin) {
          directColUpdates[k] = v;
        } else {
          userChecksUpdate[k] = v;
        }
      }
    }

    if (Object.keys(directColUpdates).length === 0 && Object.keys(userChecksUpdate).length === 0) {
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    // Build dynamic INSERT … ON CONFLICT DO UPDATE
    const params: unknown[] = [asignaturaId];
    const insertCols: string[] = ['asignatura_id'];
    const insertPlaceholders: string[] = ['$1'];
    const updateSets: string[] = [];

    // Direct column updates (status fields for all; bool fields for admin only)
    for (const [k, v] of Object.entries(directColUpdates)) {
      params.push(v);
      const idx = params.length;
      insertCols.push(k);
      insertPlaceholders.push(`$${idx}`);
      updateSets.push(`${k} = $${idx}`);
    }

    // Non-admin boolean checks → merge into user_checks
    if (Object.keys(userChecksUpdate).length > 0) {
      params.push(JSON.stringify(userChecksUpdate));
      const jsonIdx = params.length;
      insertCols.push('user_checks');
      insertPlaceholders.push(`$${jsonIdx}::jsonb`);
      // New row: user_checks = supplied value
      // Existing row: user_checks = existing || supplied (merge)
      updateSets.push(`user_checks = asignatura_checklist.user_checks || $${jsonIdx}::jsonb`);
    }

    // Admin approving bool fields → remove those keys from user_checks
    if (isAdmin) {
      const adminBoolKeys = Object.keys(directColUpdates).filter((k) => BOOL_CHECK_FIELDS.has(k));
      if (adminBoolKeys.length > 0) {
        const removeExpr = adminBoolKeys.reduce(
          (expr, k) => `(${expr} - '${k}')`,
          'asignatura_checklist.user_checks',
        );
        updateSets.push(`user_checks = ${removeExpr}`);
      }
    }

    // updated_by
    params.push(profileId);
    const updByIdx = params.length;
    insertCols.push('updated_by');
    insertPlaceholders.push(`$${updByIdx}`);
    updateSets.push(`updated_by = $${updByIdx}`);
    updateSets.push(`updated_at = NOW()`);

    const sql = `
      INSERT INTO public.asignatura_checklist (${insertCols.join(', ')})
      VALUES (${insertPlaceholders.join(', ')})
      ON CONFLICT (asignatura_id) DO UPDATE SET
        ${updateSets.join(',\n        ')}
      RETURNING *`;

    const result = await query(sql, params);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('upsertChecklist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
