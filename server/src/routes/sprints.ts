import express from 'express';
import {
  listSprints,
  createSprint,
  updateSprint,
  startSprint,
  completeSprint,
  deleteSprint,
} from '../controllers/sprintsController.js';
import { authMiddleware } from '../middleware/auth.js';
import { projectMemberMiddleware, projectLeaderMiddleware } from '../middleware/permissions.js';

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

router.get('/', projectMemberMiddleware, listSprints);
router.post('/', projectLeaderMiddleware, createSprint);
router.patch('/:sprintId', projectLeaderMiddleware, updateSprint);
router.delete('/:sprintId', projectLeaderMiddleware, deleteSprint);
router.post('/:sprintId/start', projectLeaderMiddleware, startSprint);
router.post('/:sprintId/complete', projectLeaderMiddleware, completeSprint);

export default router;
