import { query } from '../config/database.js';
import { env } from '../config/env.js';
/**
 * Middleware to check if user is a member of the project
 * Use this for endpoints that require project access (view, create tasks, etc.)
 * Admins have access to all projects
 */
export const projectMemberMiddleware = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Admins have access to all projects
        if (req.user.role === 'admin') {
            return next();
        }
        // Get project ID from params (could be :id or :projectId)
        const projectId = req.params.projectId || req.params.id;
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID required' });
        }
        const profileId = req.user.profileId;
        // Check if user is a project member
        const memberResult = await query('SELECT public.is_project_member($1::UUID, $2::UUID) as is_member', [projectId, profileId]);
        if (memberResult.rows[0]?.is_member) {
            return next();
        }
        // If not a member, check if user has assigned tasks in this project
        // (via direct task assignment, tema assignment, or material assignment)
        const taskResult = await query(`SELECT COUNT(*) as count FROM public.tasks t
       WHERE t.project_id = $1
         AND (
           t.assignee_id = $2
           OR t.id IN (SELECT task_id FROM public.task_material_assignees WHERE assignee_id = $2)
           OR t.id IN (SELECT task_id FROM public.task_tema_assignees WHERE assignee_id = $2)
         )`, [projectId, profileId]);
        if (taskResult.rows[0]?.count > 0) {
            return next(); // Allow access if user has assigned tasks
        }
        return res.status(403).json({ error: 'Not a project member' });
    }
    catch (error) {
        console.error('Project member check error:', error);
        return res.status(500).json({ error: 'Permission check failed' });
    }
};
/**
 * Middleware to check if user is a project leader
 * Use this for endpoints that require leadership (manage project, add members, etc.)
 * Admins have full leadership access to all projects
 */
export const projectLeaderMiddleware = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Admins have leadership access to all projects
        if (req.user.role === 'admin') {
            return next();
        }
        // Get project ID from params
        const projectId = req.params.projectId || req.params.id;
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID required' });
        }
        const profileId = req.user.profileId;
        // Use database helper function to check leadership
        const result = await query('SELECT public.is_project_leader($1::UUID, $2::UUID) as is_leader', [projectId, profileId]);
        if (!result.rows[0]?.is_leader) {
            return res.status(403).json({ error: 'Project leader access required' });
        }
        next();
    }
    catch (error) {
        console.error('Project leader check error:', error);
        return res.status(500).json({ error: 'Permission check failed' });
    }
};
/**
 * Middleware to check if user can create projects
 * Only admins and project_leaders can create projects
 */
export const canCreateProjectMiddleware = (req, res, next) => {
    if (env.NODE_ENV !== 'production') {
        console.log('🔍 canCreateProject check - req.user:', req.user);
    }
    if (!req.user) {
        if (env.NODE_ENV !== 'production') {
            console.log('❌ No user in request');
        }
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const role = req.user.role;
    if (env.NODE_ENV !== 'production') {
        console.log('👤 User role:', role);
    }
    if (role !== 'admin' && role !== 'project_leader') {
        if (env.NODE_ENV !== 'production') {
            console.log('❌ Permission denied - role is not admin or project_leader');
        }
        return res.status(403).json({ error: 'Only admins and project leaders can create projects' });
    }
    if (env.NODE_ENV !== 'production') {
        console.log('✅ Permission granted');
    }
    next();
};
