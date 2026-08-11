import express from 'express';
import {
  listAsignaturas,
  getAsignatura,
  createAsignatura,
  createAsignaturaInPrograma,
  updateAsignatura,
  deleteAsignatura,
  getTemasWithMateriales,
} from '../controllers/asignaturasController.js';
import { query } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { projectMemberMiddleware, projectLeaderMiddleware, projectLeaderOfResourceMiddleware } from '../middleware/permissions.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

const asignaturaLeaderMiddleware = projectLeaderOfResourceMiddleware(async (req) => {
  const result = await query('SELECT project_id FROM public.asignaturas WHERE id = $1', [req.params.id]);
  return result.rows[0]?.project_id ?? null;
});

const programaLeaderMiddleware = projectLeaderOfResourceMiddleware(async (req) => {
  const result = await query('SELECT project_id FROM public.programas WHERE id = $1', [req.params.programaId]);
  return result.rows[0]?.project_id ?? null;
});

// List asignaturas for a project (requires project membership)
router.get('/projects/:projectId/asignaturas', projectMemberMiddleware, listAsignaturas);

// Create asignatura (project leader only) - DEPRECATED
router.post('/projects/:projectId/asignaturas', projectLeaderMiddleware, createAsignatura);

// Create asignatura in programa
router.post('/programas/:programaId/asignaturas', programaLeaderMiddleware, createAsignaturaInPrograma);

// Get single asignatura
router.get('/asignaturas/:id', getAsignatura);

// Get temas with materiales for an asignatura (for task assignment)
router.get('/asignaturas/:id/temas-with-materiales', getTemasWithMateriales);

// Update asignatura (project leader only)
router.patch('/asignaturas/:id', asignaturaLeaderMiddleware, updateAsignatura);

// Delete asignatura (project leader only)
router.delete('/asignaturas/:id', asignaturaLeaderMiddleware, deleteAsignatura);

export default router;
