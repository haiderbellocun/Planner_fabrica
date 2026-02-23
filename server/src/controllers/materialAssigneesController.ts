import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

/**
 * PUT /api/tasks/:taskId/material-assignees
 * Update material assignees for a task (bulk update)
 * Also creates individual tasks for each assigned user in "Sin iniciar"
 */
export const updateMaterialAssignees = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { assignments } = req.body; // Array of { material_id, assignee_id, horas_estimadas }
    const profileId = req.user?.profileId;
    const userRole = req.user?.role;

    // Verify task exists and get full task details
    const taskResult = await query(
      `SELECT t.*, ts.name as status_name
       FROM public.tasks t
       JOIN public.task_statuses ts ON ts.id = t.status_id
       WHERE t.id = $1`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const parentTask = taskResult.rows[0];
    const projectId = parentTask.project_id;

    // Check permission: only admin and project_leader can assign
    if (userRole !== 'admin') {
      const leaderResult = await query(
        'SELECT public.is_project_leader($1::UUID, $2::UUID) as is_leader',
        [projectId, profileId]
      );

      if (!leaderResult.rows[0]?.is_leader) {
        return res.status(403).json({
          error: 'Solo administradores y líderes de proyecto pueden asignar responsables por material'
        });
      }
    }

    // Get default status (Sin iniciar) for new user tasks
    const defaultStatusResult = await query(
      'SELECT id FROM public.task_statuses WHERE is_default = true LIMIT 1'
    );
    const defaultStatusId = defaultStatusResult.rows[0]?.id;

    // Begin transaction
    await query('BEGIN');

    try {
      // Delete existing assignments for this task
      await query('DELETE FROM public.task_material_assignees WHERE task_id = $1', [taskId]);

      // Insert new assignments + create user tasks
      const newAssignments: { material_id: string; assignee_id: string; horas_estimadas: number | null }[] = [];

      if (assignments && Array.isArray(assignments) && assignments.length > 0) {
        for (const assignment of assignments) {
          const { material_id, assignee_id, horas_estimadas } = assignment;

          // Skip if no assignee selected
          if (!assignee_id) continue;

          await query(
            `INSERT INTO public.task_material_assignees (task_id, material_id, assignee_id, horas_estimadas)
             VALUES ($1, $2, $3, $4)`,
            [taskId, material_id, assignee_id, horas_estimadas || null]
          );

          newAssignments.push({ material_id, assignee_id, horas_estimadas: horas_estimadas || null });
        }
      }

      // Create individual tasks ONLY from copy-level tasks (level 2).
      // A copy task has parent_task_id pointing to an original (whose parent_task_id IS NULL).
      // User tasks (level 3+) should NOT create more children.
      let shouldCreateUserTasks = false;
      if (parentTask.parent_task_id) {
        const parentOfParent = await query(
          'SELECT parent_task_id FROM public.tasks WHERE id = $1',
          [parentTask.parent_task_id]
        );
        // Only create if this task's parent is the original (parent_task_id IS NULL)
        shouldCreateUserTasks = parentOfParent.rows.length > 0 && parentOfParent.rows[0].parent_task_id === null;
      }

      if (shouldCreateUserTasks && defaultStatusId && newAssignments.length > 0) {
        for (const assignment of newAssignments) {
          // Check if a user task already exists for this exact combination
          // (parent_task = this task, material = this material, assignee = this user)
          const existingTask = await query(
            `SELECT id FROM public.tasks
             WHERE parent_task_id = $1
             AND material_requerido_id = $2
             AND assignee_id = $3`,
            [taskId, assignment.material_id, assignment.assignee_id]
          );

          if (existingTask.rows.length > 0) {
            // Task already exists for this assignment, skip
            continue;
          }

          // Only create tasks for regular members — skip project leaders
          const leaderCheck = await query(
            'SELECT public.is_project_leader($1::UUID, $2::UUID) as is_leader',
            [projectId, assignment.assignee_id]
          );
          if (leaderCheck.rows[0]?.is_leader) {
            continue;
          }

          // Get material type name for the task title
          const materialInfo = await query(
            `SELECT mt.name as type_name, mr.descripcion
             FROM public.materiales_requeridos mr
             JOIN public.material_types mt ON mt.id = mr.material_type_id
             WHERE mr.id = $1`,
            [assignment.material_id]
          );
          const materialName = materialInfo.rows[0]?.type_name || '';
          const materialDesc = materialInfo.rows[0]?.descripcion || '';

          // Create new task for the user in "Sin iniciar"
          const newTaskResult = await query(
            `INSERT INTO public.tasks
             (project_id, title, description, priority, status_id, assignee_id, reporter_id,
              asignatura_id, material_requerido_id, due_date, tags, parent_task_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id`,
            [
              projectId,
              parentTask.title,
              parentTask.description,
              parentTask.priority,
              defaultStatusId,
              assignment.assignee_id,       // Assigned to the user
              profileId,                     // Leader who assigned
              parentTask.asignatura_id,
              assignment.material_id,        // Specific material
              parentTask.due_date,
              parentTask.tags || [],
              taskId                         // Parent = the copy task
            ]
          );

          // Send notification to assigned user
          await query(
            `INSERT INTO public.notifications (user_id, project_id, task_id, type, title, message)
             VALUES ($1, $2, $3, 'task_assigned', 'Nueva tarea asignada', $4)`,
            [
              assignment.assignee_id,
              projectId,
              newTaskResult.rows[0].id,
              `Se te asignó "${parentTask.title}" - ${materialName}${materialDesc ? ': ' + materialDesc : ''}`
            ]
          );
        }
      }

      await query('COMMIT');

      // Fetch and return updated assignments
      const result = await query(
        `SELECT
          tma.id, tma.task_id, tma.material_id, tma.assignee_id, tma.horas_estimadas,
          p.id as profile_id, p.full_name, p.avatar_url, p.email,
          mt.name as material_type_name, mt.icon as material_type_icon
         FROM public.task_material_assignees tma
         JOIN public.profiles p ON p.id = tma.assignee_id
         JOIN public.materiales_requeridos mr ON mr.id = tma.material_id
         JOIN public.material_types mt ON mt.id = mr.material_type_id
         WHERE tma.task_id = $1`,
        [taskId]
      );

      const materialAssignments = result.rows.map(row => ({
        id: row.id,
        task_id: row.task_id,
        material_id: row.material_id,
        assignee_id: row.assignee_id,
        horas_estimadas: row.horas_estimadas ? parseFloat(row.horas_estimadas) : null,
        assignee: {
          id: row.profile_id,
          full_name: row.full_name,
          avatar_url: row.avatar_url,
          email: row.email,
        },
        material_type_name: row.material_type_name,
        material_type_icon: row.material_type_icon,
      }));

      res.json(materialAssignments);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Update material assignees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/tasks/:taskId/material-assignees
 * Get material assignees for a task
 */
export const getMaterialAssignees = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;

    const result = await query(
      `SELECT
        tma.id, tma.task_id, tma.material_id, tma.assignee_id, tma.horas_estimadas,
        p.id as profile_id, p.full_name, p.avatar_url, p.email,
        mt.name as material_type_name, mt.icon as material_type_icon
       FROM public.task_material_assignees tma
       JOIN public.profiles p ON p.id = tma.assignee_id
       JOIN public.materiales_requeridos mr ON mr.id = tma.material_id
       JOIN public.material_types mt ON mt.id = mr.material_type_id
       WHERE tma.task_id = $1`,
      [taskId]
    );

    const materialAssignments = result.rows.map(row => ({
      id: row.id,
      task_id: row.task_id,
      material_id: row.material_id,
      assignee_id: row.assignee_id,
      horas_estimadas: row.horas_estimadas ? parseFloat(row.horas_estimadas) : null,
      assignee: {
        id: row.profile_id,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        email: row.email,
      },
      material_type_name: row.material_type_name,
      material_type_icon: row.material_type_icon,
    }));

    res.json(materialAssignments);
  } catch (error) {
    console.error('Get material assignees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
