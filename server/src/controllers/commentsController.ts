import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

/**
 * GET /api/tasks/:id/comments
 * Get all comments for a task
 */
export const getTaskComments = async (req: AuthRequest, res: Response) => {
  try {
    const { id: taskId } = req.params;

    const result = await query(
      `SELECT
        tc.id,
        tc.task_id,
        tc.user_id,
        tc.comment,
        tc.created_at,
        tc.updated_at,
        p.id as profile_id,
        p.full_name,
        p.avatar_url,
        p.email
       FROM public.task_comments tc
       LEFT JOIN public.profiles p ON p.id = tc.user_id
       WHERE tc.task_id = $1
       ORDER BY tc.created_at ASC`,
      [taskId]
    );

    const comments = result.rows.map((row) => ({
      id: row.id,
      task_id: row.task_id,
      user_id: row.user_id,
      comment: row.comment,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: row.user_id
        ? {
            id: row.profile_id,
            full_name: row.full_name,
            avatar_url: row.avatar_url,
            email: row.email,
          }
        : null,
    }));

    res.json(comments);
  } catch (error) {
    console.error('Get task comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/tasks/:id/comments
 * Create a new comment
 */
export const createTaskComment = async (req: AuthRequest, res: Response) => {
  try {
    const { id: taskId } = req.params;
    const { comment } = req.body;
    const userId = req.user?.profileId;

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    const result = await query(
      `INSERT INTO public.task_comments (task_id, user_id, comment)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [taskId, userId, comment.trim()]
    );

    const newComment = result.rows[0];

    // Get user info
    const userResult = await query(
      `SELECT id, full_name, avatar_url, email
       FROM public.profiles
       WHERE id = $1`,
      [userId]
    );

    const user = userResult.rows[0];

    // Create notifications based on who commented and who owns/has assigned task
    try {
      const taskResult = await query(
        `SELECT project_id, title, assignee_id, reporter_id
         FROM public.tasks
         WHERE id = $1`,
        [taskId]
      );

      const task = taskResult.rows[0];

      if (task && userId) {
        const { project_id: projectId, title, assignee_id: assigneeId, reporter_id: reporterId } = task;

        // Check if reporter is a project leader for this project
        let isReporterLeader = false;
        if (reporterId) {
          const pmResult = await query(
            `SELECT role
             FROM public.project_members
             WHERE project_id = $1 AND user_id = $2`,
            [projectId, reporterId]
          );
          isReporterLeader = pmResult.rows.some((row: any) => row.role === 'leader');
        }

        // Case 1: alguien (no el líder) comenta -> notificar al project_leader que creó la tarea
        if (reporterId && isReporterLeader && userId !== reporterId) {
          await query(
            `INSERT INTO public.notifications (user_id, project_id, task_id, type, title, message)
             VALUES ($1, $2, $3, 'task_commented', 'Nuevo comentario en tarea', $4)`,
            [
              reporterId,
              projectId,
              taskId,
              `Han comentado en la tarea "${title}"`,
            ]
          );
        }

        // Case 2: el project_leader que creó la tarea comenta -> notificar al responsable de la tarea
        if (isReporterLeader && reporterId && userId === reporterId && assigneeId && assigneeId !== reporterId) {
          await query(
            `INSERT INTO public.notifications (user_id, project_id, task_id, type, title, message)
             VALUES ($1, $2, $3, 'task_commented', 'Nuevo comentario en tu tarea', $4)`,
            [
              assigneeId,
              projectId,
              taskId,
              `El líder del proyecto comentó en la tarea "${title}"`,
            ]
          );
        }
      }
    } catch (notifyError) {
      console.error('Create task comment notification error:', notifyError);
      // No rompemos la creación del comentario si fallan las notificaciones
    }

    res.status(201).json({
      id: newComment.id,
      task_id: newComment.task_id,
      user_id: newComment.user_id,
      comment: newComment.comment,
      created_at: newComment.created_at,
      updated_at: newComment.updated_at,
      user: user
        ? {
            id: user.id,
            full_name: user.full_name,
            avatar_url: user.avatar_url,
            email: user.email,
          }
        : null,
    });
  } catch (error) {
    console.error('Create task comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/tasks/:taskId/comments/:commentId
 * Delete a comment (only creator or admin)
 */
export const deleteTaskComment = async (req: AuthRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.profileId;
    const userRole = req.user?.role;

    // Get comment to check ownership
    const commentResult = await query(
      'SELECT user_id FROM public.task_comments WHERE id = $1',
      [commentId]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const comment = commentResult.rows[0];

    // Only creator or admin can delete
    if (comment.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    await query('DELETE FROM public.task_comments WHERE id = $1', [commentId]);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete task comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
