import { query } from '../config/database.js';

// Auto-watch: reporter/assignee/commenter opt in implicitly. Idempotent --
// safe to call on every create/assign/comment without checking first.
export async function ensureWatcher(taskId: string, userId: string | null | undefined) {
  if (!userId) return;
  await query(
    `INSERT INTO public.task_watchers (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [taskId, userId]
  );
}

// Notify every watcher of a task except the person who caused the change and
// anyone already notified through a more specific path (e.g. the new assignee
// gets a dedicated "task_assigned" notification elsewhere).
export async function notifyWatchers(
  taskId: string,
  projectId: string,
  type: 'task_status_changed' | 'task_commented',
  title: string,
  message: string,
  excludeUserIds: (string | null | undefined)[]
) {
  const exclude = excludeUserIds.filter((id): id is string => !!id);
  const result = await query(
    `SELECT user_id FROM public.task_watchers WHERE task_id = $1 AND NOT (user_id = ANY($2::uuid[]))`,
    [taskId, exclude]
  );
  const watcherIds: string[] = result.rows.map((r: any) => r.user_id);
  if (watcherIds.length === 0) return;

  await Promise.all(
    watcherIds.map((userId) =>
      query(
        `INSERT INTO public.notifications (user_id, project_id, task_id, type, title, message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, projectId, taskId, type, title, message]
      )
    )
  );
}
