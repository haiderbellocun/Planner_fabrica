import express from 'express';
import { getMaterialAssignees, updateMaterialAssignees } from '../controllers/materialAssigneesController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// GET /api/tasks/:taskId/material-assignees
router.get('/tasks/:taskId/material-assignees', getMaterialAssignees);

// PUT /api/tasks/:taskId/material-assignees
router.put('/tasks/:taskId/material-assignees', updateMaterialAssignees);

export default router;
