import express from 'express';
import { listTaskStatuses } from '../controllers/taskStatusesController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// List all task statuses
router.get('/', listTaskStatuses);

export default router;
