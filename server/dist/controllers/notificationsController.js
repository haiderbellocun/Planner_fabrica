import { query } from '../config/database.js';
/**
 * GET /api/notifications
 * List user's notifications
 */
export const listNotifications = async (req, res) => {
    try {
        const profileId = req.user?.profileId;
        const result = await query(`SELECT * FROM public.notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`, [profileId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('List notifications error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const profileId = req.user?.profileId;
        // Ensure user owns the notification
        const result = await query(`UPDATE public.notifications
       SET read = true, read_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`, [id, profileId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * GET /api/notifications/unread/count
 * Get count of unread notifications
 */
export const getUnreadCount = async (req, res) => {
    try {
        const profileId = req.user?.profileId;
        const result = await query('SELECT COUNT(*) as count FROM public.notifications WHERE user_id = $1 AND read = false', [profileId]);
        res.json({ count: parseInt(result.rows[0].count) });
    }
    catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
// DELETE /api/notifications/:id
export const deleteNotification = async (req, res) => {
    try {
        const profileId = req.user?.profileId;
        const { id } = req.params;
        const result = await query('DELETE FROM public.notifications WHERE id = $1 AND user_id = $2 RETURNING id', [id, profileId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
// PATCH /api/notifications/read-all
export const markAllAsRead = async (req, res) => {
    try {
        const profileId = req.user?.profileId;
        await query('UPDATE public.notifications SET read = true, read_at = NOW() WHERE user_id = $1 AND read = false', [profileId]);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
