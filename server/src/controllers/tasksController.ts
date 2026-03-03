import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { env } from '../config/env.js';
import { sendTaskAssignedEmail } from '../services/emailService.js';

/**
 * GET /api/projects/:projectId/tasks
 * List all tasks for a project with full details
 */
export const listTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const profileId = req.user?.profileId;
    const userRole = req.user?.role;

    // Check if user is project leader
    const isLeader = userRole !== 'admin' && (await query(
      'SELECT public.is_project_leader($1::UUID, $2::UUID) as is_leader',
      [projectId, profileId]
    )).rows[0]?.is_leader;

    if (env.NODE_ENV !== 'production') {
      console.log('=== LIST TASKS DEBUG ===');
      console.log('User email:', req.user?.email);
      console.log('Profile ID:', profileId);
      console.log('User role:', userRole);
      console.log('Is leader:', isLeader);
    }

    // Build WHERE clause based on user role
    let whereClause = 't.project_id = $1';
    const params: any[] = [projectId];

    // For project leaders (not admins), apply visibility filter
    if (isLeader) {
      // Leaders see:
      // 1. Original tasks they created (parent_task_id IS NULL AND reporter_id = their id)
      // 2. Copy tasks (level 2 ONLY) from other leaders — the copy's parent must be an original
      // 3. User tasks they themselves assigned (reporter_id = their id AND assignee_id IS NOT NULL)
      whereClause += ` AND (
        (t.parent_task_id IS NULL AND t.reporter_id = $2)
        OR
        (t.parent_task_id IS NOT NULL AND t.reporter_id != $2
         AND EXISTS (SELECT 1 FROM public.tasks pt WHERE pt.id = t.parent_task_id AND pt.parent_task_id IS NULL))
        OR
        (t.parent_task_id IS NOT NULL AND t.reporter_id = $2 AND t.assignee_id IS NOT NULL)
      )`;
      params.push(profileId);
      if (env.NODE_ENV !== 'production') {
        console.log('Visibility filter applied for leader');
        console.log('WHERE clause:', whereClause);
        console.log('Params:', params);
      }
    } else if (userRole !== 'admin') {
      // Normal users see:
      // 1. Original tasks (parent_task_id IS NULL)
      // 2. Any task (including copies) where they are directly assigned, or have tema/material assignments
      whereClause += ` AND (
        t.parent_task_id IS NULL
        OR t.assignee_id = $2
        OR t.id IN (SELECT task_id FROM public.task_material_assignees WHERE assignee_id = $2)
        OR t.id IN (SELECT task_id FROM public.task_tema_assignees WHERE assignee_id = $2)
      )`;
      params.push(profileId);
      if (env.NODE_ENV !== 'production') {
        console.log('Visibility filter applied for normal user');
      }
    } else {
      if (env.NODE_ENV !== 'production') {
        console.log('No visibility filter (admin sees all)');
      }
    }
    // Admins see all tasks in the project (no additional filter)

    const result = await query(
      `SELECT
        t.*,
        ts.id as status_id, ts.name as status_name, ts.color as status_color,
        ts.display_order as status_order, ts.is_completed as status_is_completed,
        assignee.id as assignee_id, assignee.full_name as assignee_name,
        assignee.avatar_url as assignee_avatar, assignee.email as assignee_email, assignee.cargo as assignee_cargo,
        reporter.id as reporter_id, reporter.full_name as reporter_name,
        reporter.avatar_url as reporter_avatar, reporter.email as reporter_email,
        mr.id as material_id, mr.descripcion as material_descripcion,
        mt.id as material_type_id, mt.name as material_type_name, mt.icon as material_type_icon,
        tema.id as tema_id, tema.title as tema_title,
        asig.id as asignatura_id, asig.name as asignatura_name, asig.code as asignatura_code, asig.semestre as asignatura_semestre,
        prog.id as programa_id, prog.name as programa_name, prog.code as programa_code, prog.tipo_programa as programa_tipo
       FROM public.tasks t
       JOIN public.task_statuses ts ON ts.id = t.status_id
       LEFT JOIN public.profiles assignee ON assignee.id = t.assignee_id
       LEFT JOIN public.profiles reporter ON reporter.id = t.reporter_id
       LEFT JOIN public.materiales_requeridos mr ON mr.id = t.material_requerido_id
       LEFT JOIN public.material_types mt ON mt.id = mr.material_type_id
       LEFT JOIN public.temas tema ON tema.id = mr.tema_id
       LEFT JOIN public.asignaturas asig ON asig.id = t.asignatura_id OR asig.id = tema.asignatura_id OR asig.id = mr.asignatura_id
       LEFT JOIN public.programas prog ON prog.id = asig.programa_id
       WHERE ${whereClause}
       ORDER BY t.created_at DESC`,
      params
    );

    if (env.NODE_ENV !== 'production') {
      console.log('Raw query results:', result.rows.length, 'rows');
      if (result.rows.length > 0) {
        console.log('Sample task data:', {
          id: result.rows[0].id,
          title: result.rows[0].title,
          reporter_id: result.rows[0].reporter_id,
          parent_task_id: result.rows[0].parent_task_id,
        });
      }
    }

    // Transform to match Supabase structure
    const tasks = result.rows.map((row) => ({
      id: row.id,
      project_id: row.project_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status_id: row.status_id,
      assignee_id: row.assignee_id,
      reporter_id: row.reporter_id,
      start_date: row.start_date,
      due_date: row.due_date,
      tags: row.tags,
      task_number: row.task_number,
      created_at: row.created_at,
      updated_at: row.updated_at,
      material_requerido_id: row.material_requerido_id,
      asignatura_id: row.asignatura_id,
      parent_task_id: row.parent_task_id,
      status: {
        id: row.status_id,
        name: row.status_name,
        color: row.status_color,
        display_order: row.status_order,
        is_completed: row.status_is_completed,
      },
      assignee: row.assignee_id
        ? {
            id: row.assignee_id,
            full_name: row.assignee_name,
            avatar_url: row.assignee_avatar,
            email: row.assignee_email,
            cargo: row.assignee_cargo,
          }
        : null,
      reporter: row.reporter_id
        ? {
            id: row.reporter_id,
            full_name: row.reporter_name,
            avatar_url: row.reporter_avatar,
            email: row.reporter_email,
          }
        : null,
      material: row.material_id
        ? {
            id: row.material_id,
            descripcion: row.material_descripcion,
            material_type: {
              id: row.material_type_id,
              name: row.material_type_name,
              icon: row.material_type_icon,
            },
          }
        : null,
      tema: row.tema_id
        ? {
            id: row.tema_id,
            title: row.tema_title,
          }
        : null,
      asignatura: row.asignatura_id
        ? {
            id: row.asignatura_id,
            name: row.asignatura_name,
            code: row.asignatura_code,
            semestre: row.asignatura_semestre,
          }
        : null,
      programa: row.programa_id
        ? {
            id: row.programa_id,
            name: row.programa_name,
            code: row.programa_code,
            tipo_programa: row.programa_tipo,
          }
        : null,
    }));

    if (process.env.NODE_ENV !== 'production') {
    if (env.NODE_ENV !== 'production') {
      console.log('Returning', tasks.length, 'tasks');
      console.log('=== END DEBUG ===\n');
    }
    }

    res.json(tasks);
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/tasks/:id
 * Get single task with full details
 */
export const getTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        t.*,
        ts.id as status_id, ts.name as status_name, ts.color as status_color,
        ts.display_order as status_order, ts.is_completed as status_is_completed,
        assignee.id as assignee_id, assignee.full_name as assignee_name,
        assignee.avatar_url as assignee_avatar, assignee.email as assignee_email, assignee.cargo as assignee_cargo,
        reporter.id as reporter_id, reporter.full_name as reporter_name,
        reporter.avatar_url as reporter_avatar, reporter.email as reporter_email,
        mr.id as material_id, mr.descripcion as material_descripcion,
        mt.id as material_type_id, mt.name as material_type_name, mt.icon as material_type_icon,
        tema.id as tema_id, tema.title as tema_title,
        asig.id as asignatura_id, asig.name as asignatura_name, asig.code as asignatura_code, asig.semestre as asignatura_semestre,
        prog.id as programa_id, prog.name as programa_name, prog.code as programa_code, prog.tipo_programa as programa_tipo
       FROM public.tasks t
       JOIN public.task_statuses ts ON ts.id = t.status_id
       LEFT JOIN public.profiles assignee ON assignee.id = t.assignee_id
       LEFT JOIN public.profiles reporter ON reporter.id = t.reporter_id
       LEFT JOIN public.materiales_requeridos mr ON mr.id = t.material_requerido_id
       LEFT JOIN public.material_types mt ON mt.id = mr.material_type_id
       LEFT JOIN public.temas tema ON tema.id = mr.tema_id
       LEFT JOIN public.asignaturas asig ON asig.id = t.asignatura_id OR asig.id = tema.asignatura_id OR asig.id = mr.asignatura_id
       LEFT JOIN public.programas prog ON prog.id = asig.programa_id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const row = result.rows[0];
    const task: any = {
      id: row.id,
      project_id: row.project_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status_id: row.status_id,
      assignee_id: row.assignee_id,
      reporter_id: row.reporter_id,
      start_date: row.start_date,
      due_date: row.due_date,
      tags: row.tags,
      task_number: row.task_number,
      created_at: row.created_at,
      updated_at: row.updated_at,
      material_requerido_id: row.material_requerido_id,
      asignatura_id: row.asignatura_id,
      parent_task_id: row.parent_task_id,
      status: {
        id: row.status_id,
        name: row.status_name,
        color: row.status_color,
        display_order: row.status_order,
        is_completed: row.status_is_completed,
      },
      assignee: row.assignee_id
        ? {
            id: row.assignee_id,
            full_name: row.assignee_name,
            avatar_url: row.assignee_avatar,
            email: row.assignee_email,
            cargo: row.assignee_cargo,
          }
        : null,
      reporter: row.reporter_id
        ? {
            id: row.reporter_id,
            full_name: row.reporter_name,
            avatar_url: row.reporter_avatar,
            email: row.reporter_email,
          }
        : null,
      material: row.material_id
        ? {
            id: row.material_id,
            descripcion: row.material_descripcion,
            material_type: {
              id: row.material_type_id,
              name: row.material_type_name,
              icon: row.material_type_icon,
            },
          }
        : null,
      tema: row.tema_id
        ? {
            id: row.tema_id,
            title: row.tema_title,
          }
        : null,
      asignatura: row.asignatura_id
        ? {
            id: row.asignatura_id,
            name: row.asignatura_name,
            code: row.asignatura_code,
            semestre: row.asignatura_semestre,
          }
        : null,
      programa: row.programa_id
        ? {
            id: row.programa_id,
            name: row.programa_name,
            code: row.programa_code,
            tipo_programa: row.programa_tipo,
          }
        : null,
    };

    // If task has asignatura_id, fetch all temas with their materiales
    if (row.asignatura_id) {
      const temasResult = await query(
        `SELECT t.*
         FROM public.temas t
         WHERE t.asignatura_id = $1
         ORDER BY t.display_order ASC, t.created_at ASC`,
        [row.asignatura_id]
      );

      // Fetch tema assignees for this task
      const temaAssigneesResult = await query(
        `SELECT tta.tema_id, tta.assignee_id,
                p.id as profile_id, p.full_name, p.avatar_url, p.email
         FROM public.task_tema_assignees tta
         JOIN public.profiles p ON p.id = tta.assignee_id
         WHERE tta.task_id = $1`,
        [row.id]
      );

      // Create a map of tema_id -> assignee
      const temaAssigneesMap = new Map();
      temaAssigneesResult.rows.forEach((assigneeRow: any) => {
        temaAssigneesMap.set(assigneeRow.tema_id, {
          id: assigneeRow.profile_id,
          full_name: assigneeRow.full_name,
          avatar_url: assigneeRow.avatar_url,
          email: assigneeRow.email,
        });
      });

      // Fetch material assignees for this task
      const materialAssigneesResult = await query(
        `SELECT tma.material_id, tma.assignee_id, tma.horas_estimadas,
                p.id as profile_id, p.full_name, p.avatar_url, p.email
         FROM public.task_material_assignees tma
         JOIN public.profiles p ON p.id = tma.assignee_id
         WHERE tma.task_id = $1`,
        [row.id]
      );

      // Create a map of material_id -> { assignee, horas_estimadas }
      const materialAssigneesMap = new Map();
      materialAssigneesResult.rows.forEach((assigneeRow: any) => {
        materialAssigneesMap.set(assigneeRow.material_id, {
          assignee: {
            id: assigneeRow.profile_id,
            full_name: assigneeRow.full_name,
            avatar_url: assigneeRow.avatar_url,
            email: assigneeRow.email,
          },
          horas_estimadas: assigneeRow.horas_estimadas ? parseFloat(assigneeRow.horas_estimadas) : null,
        });
      });

      const temasWithMateriales = await Promise.all(
        temasResult.rows.map(async (tema: any) => {
          const materialesResult = await query(
            `SELECT mr.id, mr.descripcion,
                    mt.id as material_type_id, mt.name as material_type_name, mt.icon as material_type_icon
             FROM public.materiales_requeridos mr
             JOIN public.material_types mt ON mt.id = mr.material_type_id
             WHERE mr.tema_id = $1
             ORDER BY mt.display_order ASC`,
            [tema.id]
          );

          return {
            id: tema.id,
            title: tema.title,
            assignee: temaAssigneesMap.get(tema.id) || null,
            materiales: materialesResult.rows.map((m: any) => {
              const materialData = materialAssigneesMap.get(m.id);
              return {
                id: m.id,
                descripcion: m.descripcion,
                assignee: materialData?.assignee || null,
                horas_estimadas: materialData?.horas_estimadas || null,
                material_type: {
                  id: m.material_type_id,
                  name: m.material_type_name,
                  icon: m.material_type_icon,
                },
              };
            }),
          };
        })
      );

      task.temas_materiales = temasWithMateriales;
    }

    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/projects/:projectId/tasks
 * Create new task
 */
export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { title, description, priority, assignee_id, due_date, tags, material_requerido_id, asignatura_id } = req.body;
    const reporterId = req.user?.profileId;
    const userRole = req.user?.role;

    // Check permission: only admin and project_leader of THIS project can assign tasks
    if (assignee_id) {
      // Admins can always assign tasks
      if (userRole !== 'admin') {
        // Check if user is project leader for this specific project
        const leaderResult = await query(
          'SELECT public.is_project_leader($1::UUID, $2::UUID) as is_leader',
          [projectId, reporterId]
        );

        if (!leaderResult.rows[0]?.is_leader) {
          return res.status(403).json({
            error: 'Solo administradores y líderes de proyecto pueden asignar tareas'
          });
        }
      }
    }

    // Get default status
    const statusResult = await query(
      'SELECT id FROM public.task_statuses WHERE is_default = true LIMIT 1'
    );

    if (statusResult.rows.length === 0) {
      return res.status(500).json({ error: 'No default status found' });
    }

    const statusId = statusResult.rows[0].id;

    // Insert task
    const result = await query(
      `INSERT INTO public.tasks (project_id, title, description, priority, status_id, assignee_id, reporter_id, due_date, tags, material_requerido_id, asignatura_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        projectId,
        title,
        description || null,
        priority || 'medium',
        statusId,
        assignee_id || null,
        reporterId,
        due_date || null,
        tags || [],
        material_requerido_id || null,
        asignatura_id || null,
      ]
    );

    const task = result.rows[0];

    // Create notification + email if assigned to someone else
    if (assignee_id && assignee_id !== reporterId) {
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
        const projectResult = await query(
          'SELECT name FROM public.projects WHERE id = $1',
          [projectId]
        );

        const assignee = assigneeResult.rows[0];
        const project = projectResult.rows[0];

        if (assignee?.email) {
          const frontendUrl = env.FRONTEND_URL ?? '';
          const taskLink = frontendUrl ? `${frontendUrl}/#/my-tasks` : '';

          const subject = `Nueva tarea asignada en ${project?.name ?? 'un proyecto'}`;
          const htmlParts = [
            `<p>Hola ${assignee.full_name ?? ''},</p>`,
            `<p>Se te ha asignado una nueva tarea en <strong>${project?.name ?? 'un proyecto'}</strong>:</p>`,
            `<p><strong>${title}</strong></p>`,
          ];

          if (due_date) {
            htmlParts.push(`<p>Fecha de vencimiento: <strong>${due_date}</strong></p>`);
          }

          if (taskLink) {
            htmlParts.push(
              `<p>Puedes verla en la aplicación aquí: <a href="${taskLink}">${taskLink}</a></p>`
            );
          }

          htmlParts.push('<p>Fábrica de Contenidos</p>');

          await sendTaskAssignedEmail({
            to: assignee.email,
            subject,
            html: htmlParts.join(''),
          });
        }
      } catch (emailError) {
        console.error('Error sending task assignment email:', emailError);
      }
    }

    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/tasks/:id
 * Update task
 */
export const updateTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, priority, assignee_id, due_date, tags } = req.body;
    const userRole = req.user?.role;
    const profileId = req.user?.profileId;

    // Check permission: only admin and project_leader of THIS project can change assignee
    if (assignee_id !== undefined) {
      // Admins can always change assignee
      if (userRole !== 'admin') {
        // Get task's project_id
        const taskResult = await query(
          'SELECT project_id FROM public.tasks WHERE id = $1',
          [id]
        );

        if (taskResult.rows.length === 0) {
          return res.status(404).json({ error: 'Task not found' });
        }

        const projectId = taskResult.rows[0].project_id;

        // Check if user is project leader for this specific project
        const leaderResult = await query(
          'SELECT public.is_project_leader($1::UUID, $2::UUID) as is_leader',
          [projectId, profileId]
        );

        if (!leaderResult.rows[0]?.is_leader) {
          return res.status(403).json({
            error: 'Solo administradores y líderes de proyecto pueden cambiar el responsable de tareas'
          });
        }
      }
    }

    // Build dynamic update
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
    }
    if (assignee_id !== undefined) {
      updates.push(`assignee_id = $${paramCount++}`);
      values.push(assignee_id);
    }
    if (due_date !== undefined) {
      updates.push(`due_date = $${paramCount++}`);
      values.push(due_date);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramCount++}`);
      values.push(tags);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await query(
      `UPDATE public.tasks
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = result.rows[0];

    // Create notification if assignee changed
    if (assignee_id && assignee_id !== req.user?.profileId) {
      await query(
        `INSERT INTO public.notifications (user_id, project_id, task_id, type, title, message)
         VALUES ($1, $2, $3, 'task_assigned', 'Tarea asignada', $4)`,
        [assignee_id, task.project_id, task.id, `Se te ha asignado la tarea: ${task.title}`]
      );
    }

    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/tasks/:id/status
 * Update task status (triggers history tracking via database trigger)
 */
export const updateTaskStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status_id } = req.body;
    const userRole = req.user?.role;
    const profileId = req.user?.profileId;

    if (!status_id) {
      return res.status(400).json({ error: 'status_id is required' });
    }

    // Get current task with its status
    const taskResult = await query(
      `SELECT t.*, ts.name as current_status_name
       FROM public.tasks t
       JOIN public.task_statuses ts ON ts.id = t.status_id
       WHERE t.id = $1`,
      [id]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const currentTask = taskResult.rows[0];
    const currentStatusName = currentTask.current_status_name;

    // Get new status name
    const newStatusResult = await query('SELECT name FROM public.task_statuses WHERE id = $1', [status_id]);
    if (newStatusResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid status_id' });
    }
    const newStatusName = newStatusResult.rows[0].name;

    // Check if user is admin or project leader
    const isAdminOrLeader = userRole === 'admin' ||
      (await query(
        'SELECT public.is_project_leader($1::UUID, $2::UUID) as is_leader',
        [currentTask.project_id, profileId]
      )).rows[0]?.is_leader;

    // CRITICAL: If task is "Finalizado", ONLY admin can change it
    if (currentStatusName === 'Finalizado' && userRole !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permiso para mover tareas finalizadas',
        detail: 'Solo los administradores pueden cambiar el estado de tareas finalizadas'
      });
    }

    // If user is not admin/leader, validate allowed transitions
    if (!isAdminOrLeader) {
      // Define allowed transitions for normal users
      const allowedTransitions: Record<string, string[]> = {
        'Sin iniciar': ['En proceso'],
        'En proceso': ['En revisión'],
        'Ajustes': ['En revisión'],
      };

      const allowedNext = allowedTransitions[currentStatusName] || [];

      if (!allowedNext.includes(newStatusName)) {
        return res.status(403).json({
          error: 'No tienes permiso para cambiar a este estado',
          detail: `Solo puedes cambiar de "${currentStatusName}" a: ${allowedNext.join(', ') || 'ningún estado'}`
        });
      }
    }

    // Safeguard: Copy tasks (parent_task_id IS NOT NULL) cannot be finalized without an assignee
    if (currentTask.parent_task_id && newStatusName === 'Finalizado' && !currentTask.assignee_id) {
      return res.status(400).json({
        error: 'No se puede finalizar una tarea sin asignar',
        detail: 'Esta tarea debe ser asignada a un responsable antes de poder finalizarla.'
      });
    }

    // Update status
    const result = await query(
      `UPDATE public.tasks
       SET status_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status_id, id]
    );

    const task = result.rows[0];

    // If task is marked as "Finalizado" by a PROJECT LEADER or ADMIN,
    // AND it's an ORIGINAL task (not a copy),
    // create ONE copy for other leaders to assign to next person
    if (newStatusName === 'Finalizado' && isAdminOrLeader && !task.parent_task_id) {
      // Get default status (Sin iniciar)
      const defaultStatusResult = await query(
        'SELECT id FROM public.task_statuses WHERE is_default = true LIMIT 1'
      );

      if (defaultStatusResult.rows.length > 0) {
        const defaultStatusId = defaultStatusResult.rows[0].id;

        // Create new task (exact copy but without assignee)
        const newTaskResult = await query(
          `INSERT INTO public.tasks
           (project_id, title, description, priority, status_id, assignee_id, reporter_id, asignatura_id, material_requerido_id, due_date, tags, parent_task_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            task.project_id,
            task.title, // Mismo título
            task.description, // Misma descripción
            task.priority,
            defaultStatusId,
            null, // Sin asignar - los líderes deben asignar
            profileId, // El líder que finalizó crea la nueva tarea
            task.asignatura_id,
            task.material_requerido_id,
            task.due_date,
            task.tags || [],
            task.id // parent_task_id: referencia a la tarea original
          ]
        );

        const newTask = newTaskResult.rows[0];

        // Notify all project leaders about new task to assign
        const leadersResult = await query(
          `SELECT pm.user_id
           FROM public.project_members pm
           WHERE pm.project_id = $1 AND pm.role = 'leader'`,
          [task.project_id]
        );

        // Send notification to each leader
        for (const leader of leadersResult.rows) {
          await query(
            `INSERT INTO public.notifications (user_id, project_id, task_id, type, title, message)
             VALUES ($1, $2, $3, 'task_assigned', 'Nueva tarea para asignar', $4)`,
            [leader.user_id, task.project_id, newTask.id, `La tarea "${task.title}" fue finalizada. Asigne al siguiente responsable.`]
          );
        }
      }
    }

    // Notify assignee
    if (task.assignee_id && task.assignee_id !== req.user?.profileId) {
      await query(
        `INSERT INTO public.notifications (user_id, project_id, task_id, type, title, message)
         VALUES ($1, $2, $3, 'task_status_changed', 'Estado de tarea actualizado', $4)`,
        [task.assignee_id, task.project_id, task.id, `La tarea "${task.title}" cambió a: ${newStatusName}`]
      );
    }

    res.json(task);
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/tasks/:id
 * Delete task
 */
export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM public.tasks WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/tasks/:id/history
 * Get task status change history
 */
export const getTaskHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        tsh.*,
        from_status.name as from_status_name, from_status.color as from_status_color,
        to_status.name as to_status_name, to_status.color as to_status_color,
        p.id as changed_by_id, p.full_name as changed_by_name, p.avatar_url as changed_by_avatar
       FROM public.task_status_history tsh
       LEFT JOIN public.task_statuses from_status ON from_status.id = tsh.from_status_id
       JOIN public.task_statuses to_status ON to_status.id = tsh.to_status_id
       LEFT JOIN public.profiles p ON p.id = tsh.changed_by
       WHERE tsh.task_id = $1
       ORDER BY tsh.started_at DESC`,
      [id]
    );

    const history = result.rows.map((row) => ({
      id: row.id,
      task_id: row.task_id,
      from_status_id: row.from_status_id,
      to_status_id: row.to_status_id,
      changed_by: row.changed_by,
      started_at: row.started_at,
      ended_at: row.ended_at,
      duration_seconds: row.duration_seconds,
      created_at: row.created_at,
      from_status: row.from_status_id
        ? {
            name: row.from_status_name,
            color: row.from_status_color,
          }
        : null,
      to_status: {
        name: row.to_status_name,
        color: row.to_status_color,
      },
      changed_by_profile: row.changed_by_id
        ? {
            id: row.changed_by_id,
            full_name: row.changed_by_name,
            avatar_url: row.changed_by_avatar,
          }
        : null,
    }));

    res.json(history);
  } catch (error) {
    console.error('Get task history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/tasks/:id/activity
 * Get task activity log
 */
export const getTaskActivity = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        tal.*,
        p.id as performed_by_id, p.full_name as performed_by_name, p.avatar_url as performed_by_avatar
       FROM public.task_activity_log tal
       LEFT JOIN public.profiles p ON p.id = tal.performed_by
       WHERE tal.task_id = $1
       ORDER BY tal.created_at DESC`,
      [id]
    );

    const activity = result.rows.map((row) => ({
      id: row.id,
      task_id: row.task_id,
      action: row.action,
      field_name: row.field_name,
      old_value: row.old_value,
      new_value: row.new_value,
      performed_by: row.performed_by,
      created_at: row.created_at,
      performed_by_profile: row.performed_by_id
        ? {
            id: row.performed_by_id,
            full_name: row.performed_by_name,
            avatar_url: row.performed_by_avatar,
          }
        : null,
    }));

    res.json(activity);
  } catch (error) {
    console.error('Get task activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
