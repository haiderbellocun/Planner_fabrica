import express from 'express';
import { listEpics, createEpic, updateEpic, deleteEpic } from '../controllers/epicsController.js';
import { authMiddleware } from '../middleware/auth.js';
import { projectMemberMiddleware, projectLeaderMiddleware } from '../middleware/permissions.js';

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

router.get('/', projectMemberMiddleware, listEpics);
router.post('/', projectLeaderMiddleware, createEpic);
router.patch('/:epicId', projectLeaderMiddleware, updateEpic);
router.delete('/:epicId', projectLeaderMiddleware, deleteEpic);

export default router;
