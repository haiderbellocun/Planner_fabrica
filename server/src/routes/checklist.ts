import express from 'express';
import { getProjectChecklist, upsertChecklist } from '../controllers/checklistController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

// GET  /api/projects/:projectId/checklist
router.get('/', getProjectChecklist);

// PATCH /api/checklist/:asignaturaId
router.patch('/:asignaturaId', upsertChecklist);

export default router;
