import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { env } from '../config/env.js';
import { sendTaskAssignedEmail, buildTaskAssignedHtml } from '../services/emailService.js';

/**
 * POST /api/tasks/:id/subtasks
 * Create a subtask of the task at :id. Independent of parent_task_id (the
 * internal material-assignment copy mechanism) -- see subtask_of_id column
 * comment in database/add_subtask_of_id.sql.
 */
export const createSubtask = async (req: AuthRequest, res: Response) => {
  try {
    const { id: parentId } = req.params;
    const { title, description, priority, assignee_id, due_date } = req.body;
    const userRole = req.user?.role;
    const profileId = req.user?.profileId;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'El título es requerido' });
    }

    const parentResult = await query(
      'SELECT id, project_id, due_date, subtask_of_id FROM public.tasks WHERE id = $1',
      [parentId]
    );
    if (parentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const parentTask = parentResult.rows[0];

    if (parentTask.subtask_of_id) {
      return res.status(400).json({ error: 'No se pueden crear subtareas de una subtarea' });
    }

    const projectId = parentTask.project_id;

    // General access check -- same pattern as updateTask: admin / global or
    // per-project leader / real project member / has assigned work here.
    let isProjectLeaderForTask = userRole === 'admin' || userRole === 'project_leader';
    if (!isProjectLeaderForTask) {
      const accessResult = await query(
        `SELECT
           public.is_project_member($1::UUID, $2::UUID) as is_member,
           public.is_project_leader($1::UUID, $2::UUID) as is_leader`,
        [projectId, profileId]
      );
      const { is_member, is_leader } = accessResult.rows[0] || {};
      isProjectLeaderForTask = !!is_leader;

      if (!is_member && !is_leader) {
        const taskAccessResult = await query(
          `SELECT COUNT(*) as count FROM public.tasks t
           WHERE t.project_id = $1
             AND (
               t.assignee_id = $2
               OR t.id IN (SELECT task_id FROM public.task_material_assignees WHERE assignee_id = $2)
               OR t.id IN (SELECT task_id FROM public.task_tema_assignees WHERE assignee_id = $2)
             )`,
          [projectId, profileId]
        );
        if (!(taskAccessResult.rows[0]?.count > 0)) {
          return res.status(403).json({ error: 'No tienes acceso a este proyecto' });
        }
      }
    }

    // Only admin/leader (global or of this project) can assign the subtask to someone.
    if (assignee_id && userRole !== 'admin' && userRole !== 'project_leader' && !isProjectLeaderForTask) {
      return res.status(403).json({
        error: 'Solo administradores y líderes de proyecto pueden asignar tareas'
      });
    }

    const statusResult = await query(
      'SELECT id FROM public.task_statuses WHERE is_default = true LIMIT 1'
    );
    if (statusResult.rows.length === 0) {
      return res.status(500).json({ error: 'No default status found' });
    }
    const statusId = statusResult.rows[0].id;

    const effectiveDueDate = due_date || parentTask.due_date || null;

    const result = await query(
      `INSERT INTO public.tasks (
         project_id, title, description, priority, status_id, assignee_id, reporter_id,
         due_date, tags, subtask_of_id, board_rank, backlog_rank
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         COALESCE((SELECT MIN(board_rank) FROM public.tasks WHERE project_id = $1 AND status_id = $5), 1000) - 1000,
         COALESCE((SELECT MIN(backlog_rank) FROM public.tasks WHERE project_id = $1), 1000) - 1000
       )
       RETURNING *`,
      [
        projectId,
        title,
        description || null,
        priority || 'medium',
        statusId,
        assignee_id || null,
        profileId,
        effectiveDueDate,
        [],
        parentId,
      ]
    );

    const task = result.rows[0];

    if (assignee_id && assignee_id !== profileId) {
      await query(
        `INSERT INTO public.notifications (user_id, project_id, task_id, type, title, message)
         VALUES ($1, $2, $3, 'task_assigned', 'Nueva tarea asignada', $4)`,
        [assignee_id, projectId, task.id, `Se te ha asignado la tarea: ${title}`]
      );

      try {
        const assigneeResult = await query(
          'SELECT full_name, email FROM public.profiles WHERE id = $1',
          [assignee_id]
        );
        const projectResult = await query('SELECT name FROM public.projects WHERE id = $1', [projectId]);

        const assignee = assigneeResult.rows[0];
        const project = projectResult.rows[0];

        if (assignee?.email) {
          const frontendUrl = (env.FRONTEND_URL ?? '').replace(/\/$/, '');
          const taskLink = frontendUrl ? `${frontendUrl}#/my-tasks` : '';

          await sendTaskAssignedEmail({
            to: assignee.email,
            subject: `Nueva tarea asignada en ${project?.name ?? 'un proyecto'}`,
            html: buildTaskAssignedHtml({
              assigneeName: assignee.full_name ?? '',
              projectName: project?.name ?? 'un proyecto',
              taskTitle: title,
              dueDate: effectiveDueDate,
              taskLink,
            }),
          });
        }
      } catch (emailError) {
        console.error('Error sending subtask assignment email:', emailError);
      }
    }

    res.status(201).json(task);
  } catch (error) {
    console.error('Create subtask error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
