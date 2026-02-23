import express from 'express';
import { getMyTasks } from '../controllers/myTasksController.js';
import { authMiddleware } from '../middleware/auth.js';
const router = express.Router();
router.use(authMiddleware);
// GET /api/my-tasks - Get all tasks assigned to current user
router.get('/', getMyTasks);
export default router;
