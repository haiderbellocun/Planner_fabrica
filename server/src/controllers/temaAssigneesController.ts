import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

/**
 * PUT /api/tasks/:taskId/tema-assignees
 * Update tema assignees for a task (bulk update)
 */
export const updateTemaAssignees = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { assignments } = req.body; // Array of { tema_id, assignee_id }
    const profileId = req.user?.profileId;
    const userRole = req.user?.role;

    // Verify task exists and get project_id
    const taskResult = await query(
      'SELECT project_id FROM public.tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const projectId = taskResult.rows[0].project_id;

    // Check permission: only admin and project_leader can assign
    if (userRole !== 'admin') {
      const leaderResult = await query(
        'SELECT public.is_project_leader($1::UUID, $2::UUID) as is_leader',
        [projectId, profileId]
      );

      if (!leaderResult.rows[0]?.is_leader) {
        return res.status(403).json({
          error: 'Solo administradores y líderes de proyecto pueden asignar responsables por tema'
        });
      }
    }

    // Begin transaction
    await query('BEGIN');

    try {
      // Delete existing assignments for this task
      await query('DELETE FROM public.task_tema_assignees WHERE task_id = $1', [taskId]);

      // Insert new assignments
      if (assignments && Array.isArray(assignments) && assignments.length > 0) {
        for (const assignment of assignments) {
          const { tema_id, assignee_id } = assignment;

          // Skip if no assignee selected
          if (!assignee_id) continue;

          await query(
            `INSERT INTO public.task_tema_assignees (task_id, tema_id, assignee_id)
             VALUES ($1, $2, $3)`,
            [taskId, tema_id, assignee_id]
          );
        }
      }

      await query('COMMIT');

      // Fetch and return updated assignments
      const result = await query(
        `SELECT
          tta.id, tta.task_id, tta.tema_id, tta.assignee_id,
          p.id as profile_id, p.full_name, p.avatar_url, p.email,
          t.title as tema_title
         FROM public.task_tema_assignees tta
         JOIN public.profiles p ON p.id = tta.assignee_id
         JOIN public.temas t ON t.id = tta.tema_id
         WHERE tta.task_id = $1`,
        [taskId]
      );

      const temaAssignments = result.rows.map(row => ({
        id: row.id,
        task_id: row.task_id,
        tema_id: row.tema_id,
        assignee_id: row.assignee_id,
        assignee: {
          id: row.profile_id,
          full_name: row.full_name,
          avatar_url: row.avatar_url,
          email: row.email,
        },
        tema_title: row.tema_title,
      }));

      res.json(temaAssignments);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Update tema assignees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/tasks/:taskId/tema-assignees
 * Get tema assignees for a task
 */
export const getTemaAssignees = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;

    const result = await query(
      `SELECT
        tta.id, tta.task_id, tta.tema_id, tta.assignee_id,
        p.id as profile_id, p.full_name, p.avatar_url, p.email,
        t.title as tema_title
       FROM public.task_tema_assignees tta
       JOIN public.profiles p ON p.id = tta.assignee_id
       JOIN public.temas t ON t.id = tta.tema_id
       WHERE tta.task_id = $1`,
      [taskId]
    );

    const temaAssignments = result.rows.map(row => ({
      id: row.id,
      task_id: row.task_id,
      tema_id: row.tema_id,
      assignee_id: row.assignee_id,
      assignee: {
        id: row.profile_id,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        email: row.email,
      },
      tema_title: row.tema_title,
    }));

    res.json(temaAssignments);
  } catch (error) {
    console.error('Get tema assignees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
