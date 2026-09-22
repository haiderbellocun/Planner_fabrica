import express from 'express';
import { listMaterialTypes, listMaterialesForAsignatura, listMaterialesForTema, createMaterialRequerido, createMaterialRequeridoForTema, updateMaterialRequerido, deleteMaterialRequerido, } from '../controllers/materialesController.js';
import { query } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { projectLeaderOfResourceMiddleware } from '../middleware/permissions.js';
const router = express.Router();
// All routes require authentication
router.use(authMiddleware);
const asignaturaLeaderMiddleware = projectLeaderOfResourceMiddleware(async (req) => {
    const result = await query('SELECT project_id FROM public.asignaturas WHERE id = $1', [req.params.asignaturaId]);
    return result.rows[0]?.project_id ?? null;
});
const temaLeaderMiddleware = projectLeaderOfResourceMiddleware(async (req) => {
    const result = await query(`SELECT a.project_id FROM public.temas t JOIN public.asignaturas a ON a.id = t.asignatura_id WHERE t.id = $1`, [req.params.temaId]);
    return result.rows[0]?.project_id ?? null;
});
// materiales_requeridos hangs off EITHER an asignatura directly or a tema
// (which itself hangs off an asignatura) -- resolve whichever path applies.
const materialLeaderMiddleware = projectLeaderOfResourceMiddleware(async (req) => {
    const result = await query(`SELECT COALESCE(a1.project_id, a2.project_id) AS project_id
     FROM public.materiales_requeridos mr
     LEFT JOIN public.asignaturas a1 ON a1.id = mr.asignatura_id
     LEFT JOIN public.temas t ON t.id = mr.tema_id
     LEFT JOIN public.asignaturas a2 ON a2.id = t.asignatura_id
     WHERE mr.id = $1`, [req.params.id]);
    return result.rows[0]?.project_id ?? null;
});
// Get material types catalog (available to all authenticated users)
router.get('/material-types', listMaterialTypes);
// Get materiales for an asignatura
router.get('/asignaturas/:asignaturaId/materiales', listMaterialesForAsignatura);
// Add material to asignatura (project leader only)
router.post('/asignaturas/:asignaturaId/materiales', asignaturaLeaderMiddleware, createMaterialRequerido);
// Get materiales for a tema
router.get('/temas/:temaId/materiales', listMaterialesForTema);
// Add material to tema (project leader only)
router.post('/temas/:temaId/materiales', temaLeaderMiddleware, createMaterialRequeridoForTema);
// Update material requirement (project leader only)
router.patch('/materiales/:id', materialLeaderMiddleware, updateMaterialRequerido);
// Delete material requirement (project leader only)
router.delete('/materiales/:id', materialLeaderMiddleware, deleteMaterialRequerido);
export default router;
