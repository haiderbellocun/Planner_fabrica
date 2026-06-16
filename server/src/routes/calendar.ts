import express from 'express';
import { getCalendarEvents } from '../controllers/calendarController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/events', getCalendarEvents);

export default router;
