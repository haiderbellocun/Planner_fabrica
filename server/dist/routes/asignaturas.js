import express from 'express';
import { listAsignaturas, getAsignatura, createAsignatura, createAsignaturaInPrograma, updateAsignatura, deleteAsignatura, getTemasWithMateriales, } from '../controllers/asignaturasController.js';
import { authMiddleware } from '../middleware/auth.js';
import { projectMemberMiddleware, projectLeaderMiddleware } from '../middleware/permissions.js';
const router = express.Router();
// All routes require authentication
router.use(authMiddleware);
// List asignaturas for a project (requires project membership)
router.get('/projects/:projectId/asignaturas', projectMemberMiddleware, listAsignaturas);
// Create asignatura (project leader only) - DEPRECATED
router.post('/projects/:projectId/asignaturas', projectLeaderMiddleware, createAsignatura);
// Create asignatura in programa
router.post('/programas/:programaId/asignaturas', createAsignaturaInPrograma);
// Get single asignatura
router.get('/asignaturas/:id', getAsignatura);
// Get temas with materiales for an asignatura (for task assignment)
router.get('/asignaturas/:id/temas-with-materiales', getTemasWithMateriales);
// Update asignatura (project leader only)
router.patch('/asignaturas/:id', updateAsignatura);
// Delete asignatura (project leader only)
router.delete('/asignaturas/:id', deleteAsignatura);
export default router;
