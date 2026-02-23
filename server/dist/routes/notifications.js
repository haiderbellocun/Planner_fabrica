import express from 'express';
import { listNotifications, markAsRead, getUnreadCount } from '../controllers/notificationsController.js';
import { authMiddleware } from '../middleware/auth.js';
const router = express.Router();
// All routes require authentication
router.use(authMiddleware);
// Get unread count (must be before /:id to avoid route conflict)
router.get('/unread/count', getUnreadCount);
// List user's notifications
router.get('/', listNotifications);
// Mark notification as read
router.patch('/:id/read', markAsRead);
export default router;
