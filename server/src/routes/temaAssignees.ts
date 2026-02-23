import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getTemaAssignees, updateTemaAssignees } from '../controllers/temaAssigneesController.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/tasks/:taskId/tema-assignees - Get tema assignees for a task
router.get('/tasks/:taskId/tema-assignees', getTemaAssignees);

// PUT /api/tasks/:taskId/tema-assignees - Update tema assignees (bulk)
router.put('/tasks/:taskId/tema-assignees', updateTemaAssignees);

export default router;
