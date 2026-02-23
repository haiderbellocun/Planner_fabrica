import express from 'express';
import { getLeadersFocus } from '../controllers/leadersFocusController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// GET /api/leaders/focus - Team focus for project leaders (tasks by cargo)
router.get('/focus', getLeadersFocus);

export default router;
