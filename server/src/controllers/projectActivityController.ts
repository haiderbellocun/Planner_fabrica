import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

/**
 * GET /api/projects/:projectId/activity
 * Consolidated "what happened in this project recently" feed. Aggregates the
 * two event sources that already exist per-task -- task_activity_log
 * (task_created / status_changed, populated by DB triggers) and task_comments
 * -- across every task in the project. No new logging added: field-level
 * edits (title, assignee, due date, etc.) aren't tracked anywhere today, so
 * they're not part of this feed either.
 */
export const getProjectActivity = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);

    const result = await query(
      `(
         SELECT
           tal.id, 'activity' AS source, tal.action, tal.field_name, tal.old_value, tal.new_value,
           NULL::text AS comment_text, tal.performed_by, tal.created_at,
           t.id AS task_id, t.task_number, t.title AS task_title,
           p.full_name AS actor_name, p.avatar_url AS actor_avatar
         FROM public.task_activity_log tal
         JOIN public.tasks t ON t.id = tal.task_id
         LEFT JOIN public.profiles p ON p.id = tal.performed_by
         WHERE t.project_id = $1
       )
       UNION ALL
       (
         SELECT
           tc.id, 'comment' AS source, 'commented' AS action, NULL, NULL,
           tc.comment AS comment_text, tc.user_id AS performed_by, tc.created_at,
           t.id AS task_id, t.task_number, t.title AS task_title,
           p.full_name AS actor_name, p.avatar_url AS actor_avatar
         FROM public.task_comments tc
         JOIN public.tasks t ON t.id = tc.task_id
         LEFT JOIN public.profiles p ON p.id = tc.user_id
         WHERE t.project_id = $1
       )
       ORDER BY created_at DESC
       LIMIT $2`,
      [projectId, limit]
    );

    const events = result.rows.map((row: any) => ({
      id: `${row.source}:${row.id}`,
      type: row.source === 'comment' ? 'comment' : row.action,
      created_at: row.created_at,
      task: { id: row.task_id, task_number: row.task_number, title: row.task_title },
      actor: row.performed_by ? { id: row.performed_by, full_name: row.actor_name, avatar_url: row.actor_avatar } : null,
      detail:
        row.source === 'comment'
          ? { comment: row.comment_text }
          : row.action === 'status_changed'
            ? { from: row.old_value, to: row.new_value }
            : {},
    }));

    res.json(events);
  } catch (error) {
    console.error('Get project activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
