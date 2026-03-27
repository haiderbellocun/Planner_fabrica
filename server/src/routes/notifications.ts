import express from 'express';
import {
  listNotifications,
  markAsRead,
  getUnreadCount,
  deleteNotification,
  markAllAsRead,
} from '../controllers/notificationsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get unread count (must be before /:id to avoid route conflict)
router.get('/unread/count', getUnreadCount);

// List user's notifications
router.get('/', listNotifications);

// Bulk mark as read (before /:id routes)
router.patch('/read-all', markAllAsRead);

// Mark notification as read
router.patch('/:id/read', markAsRead);

// Delete notification
router.delete('/:id', deleteNotification);

export default router;
