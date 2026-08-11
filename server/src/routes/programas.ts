import express from 'express';
import {
  listProgramas,
  getPrograma,
  createPrograma,
  updatePrograma,
  deletePrograma,
} from '../controllers/programasController.js';
import { listAsignaturasByPrograma } from '../controllers/asignaturasController.js';
import { query } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { projectMemberMiddleware, projectLeaderMiddleware, projectLeaderOfResourceMiddleware } from '../middleware/permissions.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

const programaLeaderMiddleware = projectLeaderOfResourceMiddleware(async (req) => {
  const result = await query('SELECT project_id FROM public.programas WHERE id = $1', [req.params.id]);
  return result.rows[0]?.project_id ?? null;
});

// List programas for a project (requires project membership)
router.get('/projects/:projectId/programas', projectMemberMiddleware, listProgramas);

// Create programa (project leader only)
router.post('/projects/:projectId/programas', projectLeaderMiddleware, createPrograma);

// Get single programa
router.get('/programas/:id', getPrograma);

// Get asignaturas for a programa
router.get('/programas/:programaId/asignaturas', listAsignaturasByPrograma);

// Update programa (project leader only)
router.patch('/programas/:id', programaLeaderMiddleware, updatePrograma);

// Delete programa (project leader only)
router.delete('/programas/:id', programaLeaderMiddleware, deletePrograma);

export default router;
