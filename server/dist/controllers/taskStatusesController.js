import { query } from '../config/database.js';
/**
 * GET /api/task-statuses
 * List all task statuses
 */
export const listTaskStatuses = async (req, res) => {
    try {
        const result = await query('SELECT * FROM public.task_statuses ORDER BY display_order ASC');
        res.json(result.rows);
    }
    catch (error) {
        console.error('List task statuses error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
