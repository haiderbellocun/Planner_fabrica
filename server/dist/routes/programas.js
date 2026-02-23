import express from 'express';
import { listProgramas, getPrograma, createPrograma, updatePrograma, deletePrograma, } from '../controllers/programasController.js';
import { listAsignaturasByPrograma } from '../controllers/asignaturasController.js';
import { authMiddleware } from '../middleware/auth.js';
import { projectMemberMiddleware, projectLeaderMiddleware } from '../middleware/permissions.js';
const router = express.Router();
// All routes require authentication
router.use(authMiddleware);
// List programas for a project (requires project membership)
router.get('/projects/:projectId/programas', projectMemberMiddleware, listProgramas);
// Create programa (project leader only)
router.post('/projects/:projectId/programas', projectLeaderMiddleware, createPrograma);
// Get single programa
router.get('/programas/:id', getPrograma);
// Get asignaturas for a programa
router.get('/programas/:programaId/asignaturas', listAsignaturasByPrograma);
// Update programa (project leader only)
router.patch('/programas/:id', updatePrograma);
// Delete programa (project leader only)
router.delete('/programas/:id', deletePrograma);
export default router;
