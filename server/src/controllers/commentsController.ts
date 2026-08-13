import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { ensureWatcher, notifyWatchers } from '../utils/taskWatchers.js';
import { env } from '../config/env.js';
import { sendTaskAssignedEmail, buildMentionEmailHtml } from '../services/emailService.js';

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
    const { comment, mentioned_ids } = req.body;
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

    // Commenting makes you a watcher; notify every other watcher of the task
    // (reporter and assignee are auto-watchers, so this covers the old
    // leader<->assignee-only cases plus anyone who opted in manually).
    try {
      if (userId) {
        await ensureWatcher(taskId, userId);

        const taskResult = await query('SELECT project_id, title FROM public.tasks WHERE id = $1', [taskId]);
        const task = taskResult.rows[0];

        if (task) {
          // Mentioned people get a dedicated "te mencionaron" notification
          // instead of the generic watcher one, so they're excluded from it
          // below to avoid a double notification for the same comment.
          let mentionedValidIds: string[] = [];
          if (Array.isArray(mentioned_ids) && mentioned_ids.length > 0) {
            const validResult = await query(
              'SELECT id FROM public.profiles WHERE id = ANY($1::uuid[])',
              [mentioned_ids]
            );
            mentionedValidIds = validResult.rows
              .map((r: any) => r.id)
              .filter((id: string) => id !== userId);

            await Promise.all(
              mentionedValidIds.map(async (mentionedId) => {
                await ensureWatcher(taskId, mentionedId);
                await query(
                  `INSERT INTO public.notifications (user_id, project_id, task_id, type, title, message)
                   VALUES ($1, $2, $3, 'task_commented', 'Te mencionaron', $4)`,
                  [mentionedId, task.project_id, taskId, `${user?.full_name || 'Alguien'} te mencionó en un comentario de "${task.title}"`]
                );
              })
            );

            try {
              const [mentionedProfiles, projectResult] = await Promise.all([
                query(
                  `SELECT p.id, p.full_name, u.email
                   FROM public.profiles p
                   JOIN public.users u ON u.id = p.user_id
                   WHERE p.id = ANY($1::uuid[])`,
                  [mentionedValidIds]
                ),
                query('SELECT name FROM public.projects WHERE id = $1', [task.project_id]),
              ]);

              const projectName = projectResult.rows[0]?.name ?? 'un proyecto';
              const frontendUrl = (env.FRONTEND_URL ?? '').replace(/\/$/, '');
              const taskLink = frontendUrl ? `${frontendUrl}#/my-tasks` : '';
              const excerpt = comment.trim().length > 160 ? `${comment.trim().slice(0, 160)}…` : comment.trim();

              await Promise.allSettled(
                mentionedProfiles.rows
                  .filter((p: any) => p.email)
                  .map((p: any) =>
                    sendTaskAssignedEmail({
                      to: p.email,
                      subject: `${user?.full_name || 'Alguien'} te mencionó en ${projectName}`,
                      html: buildMentionEmailHtml({
                        mentionedName: p.full_name ?? '',
                        commenterName: user?.full_name || 'Alguien',
                        projectName,
                        taskTitle: task.title,
                        commentExcerpt: excerpt,
                        taskLink,
                      }),
                    })
                  )
              );
            } catch (mentionEmailError) {
              console.error('Error sending mention emails:', mentionEmailError);
            }
          }

          await notifyWatchers(
            taskId,
            task.project_id,
            'task_commented',
            'Nuevo comentario en tarea',
            `${user?.full_name || 'Alguien'} comentó en la tarea "${task.title}"`,
            [userId, ...mentionedValidIds]
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
