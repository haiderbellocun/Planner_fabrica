import { query } from '../config/database.js';
/**
 * GET /api/profiles
 * List all profiles
 */
export const listProfiles = async (req, res) => {
    try {
        const result = await query('SELECT id, full_name, avatar_url, email, cargo, created_at FROM public.profiles ORDER BY full_name ASC');
        res.json(result.rows);
    }
    catch (error) {
        console.error('List profiles error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * GET /api/profiles/:id
 * Get single profile
 */
export const getProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('SELECT id, full_name, avatar_url, email, cargo, created_at, updated_at FROM public.profiles WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
