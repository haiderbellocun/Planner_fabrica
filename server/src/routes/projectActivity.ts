import express from 'express';
import { getProjectActivity } from '../controllers/projectActivityController.js';
import { authMiddleware } from '../middleware/auth.js';
import { projectMemberMiddleware } from '../middleware/permissions.js';

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

router.get('/', projectMemberMiddleware, getProjectActivity);

export default router;
