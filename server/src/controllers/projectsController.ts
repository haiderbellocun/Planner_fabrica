import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { env } from '../config/env.js';
import { sendTaskAssignedEmail } from '../services/emailService.js';

/**
 * GET /api/projects
 * List projects based on role:
 * - Admin: ALL projects
 * - Project_leader: Projects where they are members
 * - User: Projects where they have assigned tasks
 */
export const listProjects = async (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.user?.profileId;
    const userRole = req.user?.role;

    let result;

    if (userRole === 'admin' || userRole === 'project_leader') {
      // Admins and project leaders see ALL projects
      result = await query(
        `SELECT
          p.*,
          COUNT(DISTINCT pm.id) as members_count,
          COUNT(DISTINCT t.id) as tasks_count,
          COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = true) as completed_tasks
         FROM public.projects p
         LEFT JOIN public.project_members pm ON pm.project_id = p.id
         LEFT JOIN public.tasks t ON t.project_id = p.id
         LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
         GROUP BY p.id
         ORDER BY p.created_at DESC`
      );
    } else {
      // Regular users see projects where they have assigned tasks
      // (via direct assignment, material assignment, or tema assignment)
      result = await query(
        `SELECT DISTINCT ON (p.id)
          p.*,
          (SELECT COUNT(DISTINCT pm2.id) FROM public.project_members pm2 WHERE pm2.project_id = p.id) as members_count,
          (SELECT COUNT(DISTINCT t2.id) FROM public.tasks t2 WHERE t2.project_id = p.id) as tasks_count,
          (SELECT COUNT(DISTINCT t2.id) FROM public.tasks t2 JOIN public.task_statuses ts2 ON ts2.id = t2.status_id WHERE t2.project_id = p.id AND ts2.is_completed = true) as completed_tasks
         FROM public.projects p
         JOIN public.tasks t ON t.project_id = p.id
         WHERE (
           t.assignee_id = $1
           OR t.id IN (SELECT task_id FROM public.task_material_assignees WHERE assignee_id = $1)
           OR t.id IN (SELECT task_id FROM public.task_tema_assignees WHERE assignee_id = $1)
         )
         ORDER BY p.id, p.created_at DESC`,
        [profileId]
      );
    }

    // Get members for all projects in a single query (avoid N+1)
    const projectRows = result.rows;

    if (projectRows.length === 0) {
      return res.json([]);
    }

    const projectIds = projectRows.map((p) => p.id);

    const membersResult = await query(
      `SELECT
        pm.id, pm.project_id, pm.user_id, pm.role,
        pm.can_view, pm.can_create, pm.can_edit, pm.can_assign, pm.joined_at,
        p.id as profile_id, p.full_name, p.avatar_url, p.email
       FROM public.project_members pm
       JOIN public.profiles p ON p.id = pm.user_id
       WHERE pm.project_id = ANY($1)
       ORDER BY pm.project_id ASC, pm.joined_at ASC`,
      [projectIds],
    );

    const membersByProject = new Map<string, any[]>();
    membersResult.rows.forEach((m) => {
      const key = String(m.project_id);
      if (!membersByProject.has(key)) {
        membersByProject.set(key, []);
      }
      membersByProject.get(key)!.push({
        id: m.id,
        project_id: m.project_id,
        user_id: m.user_id,
        role: m.role,
        can_view: m.can_view,
        can_create: m.can_create,
        can_edit: m.can_edit,
        can_assign: m.can_assign,
        joined_at: m.joined_at,
        profile: {
          id: m.profile_id,
          full_name: m.full_name,
          avatar_url: m.avatar_url,
          email: m.email,
        },
      });
    });

    const projects = projectRows.map((project) => ({
      ...project,
      members: membersByProject.get(String(project.id)) || [],
    }));

    res.json(projects);
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/projects/:id
 * Get single project details
 */
export const getProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (env.NODE_ENV !== 'production') {
      console.log('🔍 getProject called for ID:', id);
    }

    const result = await query(
      `SELECT
        p.*,
        COUNT(DISTINCT pm.id) as members_count,
        COUNT(DISTINCT t.id) as tasks_count
       FROM public.projects p
       LEFT JOIN public.project_members pm ON pm.project_id = p.id
       LEFT JOIN public.tasks t ON t.project_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id]
    );

    if (env.NODE_ENV !== 'production') {
      console.log('📊 Query result rows:', result.rows.length);
    }

    if (result.rows.length === 0) {
      if (env.NODE_ENV !== 'production') {
        console.log('❌ Project not found in database');
      }
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = result.rows[0];
    if (env.NODE_ENV !== 'production') {
      console.log('✅ Project found:', project.name);
    }

    // Get members
    const membersResult = await query(
      `SELECT
        pm.id, pm.project_id, pm.user_id, pm.role,
        pm.can_view, pm.can_create, pm.can_edit, pm.can_assign, pm.joined_at,
        p.id as profile_id, p.full_name, p.avatar_url, p.email
       FROM public.project_members pm
       JOIN public.profiles p ON p.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY pm.joined_at ASC`,
      [id]
    );

    res.json({
      ...project,
      members: membersResult.rows.map((m) => ({
        id: m.id,
        project_id: m.project_id,
        user_id: m.user_id,
        role: m.role,
        can_view: m.can_view,
        can_create: m.can_create,
        can_edit: m.can_edit,
        can_assign: m.can_assign,
        joined_at: m.joined_at,
        profile: {
          id: m.profile_id,
          full_name: m.full_name,
          avatar_url: m.avatar_url,
          email: m.email,
        },
      })),
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/projects
 * Create new project with transaction safety
 */
export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, key, start_date, end_date, tipo_programa, asignaturas, category, link, link_label } = req.body;
    const profileId = req.user?.profileId;

    if (!end_date) {
      return res.status(400).json({
        error: 'La fecha de finalización del proyecto es obligatoria',
      });
    }

    // Start transaction
    await query('BEGIN');

    try {
      // 1. Insert project
      const projectResult = await query(
        `INSERT INTO public.projects (name, description, key, owner_id, start_date, end_date, status, tipo_programa, category, link, link_label)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10)
         RETURNING *`,
        [name, description || null, key.toUpperCase(), profileId, start_date || null, end_date, tipo_programa || null, category || null, link || null, link_label || null]
      );

      const project = projectResult.rows[0];

      // 2. Add creator as project leader
      await query(
        `INSERT INTO public.project_members (project_id, user_id, role, can_view, can_create, can_edit, can_assign, invited_by)
         VALUES ($1, $2, 'leader', true, true, true, true, $2)`,
        [project.id, profileId]
      );

      // 2.5. Add default project leaders as LEADERS (not members)
      // Look up profile IDs dynamically by email
      const defaultLeaderEmails = [
        'haider_bello@cun.edu.co',
        'deyvis_miranda@cun.edu.co',
        'german_giraldo@cun.edu.co',
        'nathaly_amaya@cun.edu.co',
      ];

      const leadersResult = await query(
        `SELECT p.id FROM public.profiles p
         JOIN public.users u ON u.id = p.user_id
         WHERE u.email = ANY($1)`,
        [defaultLeaderEmails]
      );

      for (const leader of leadersResult.rows) {
        // Skip if the leader is the creator (already added above)
        if (leader.id !== profileId) {
          await query(
            `INSERT INTO public.project_members (project_id, user_id, role, can_view, can_create, can_edit, can_assign, invited_by)
             VALUES ($1, $2, 'leader', true, true, true, true, $3)`,
            [project.id, leader.id, profileId]
          );
        }
      }

      // 3. Create asignaturas and materiales if provided
      if (asignaturas && Array.isArray(asignaturas) && asignaturas.length > 0) {
        for (let i = 0; i < asignaturas.length; i++) {
          const asignatura = asignaturas[i];

          // Insert asignatura
          const asignaturaResult = await query(
            `INSERT INTO public.asignaturas (project_id, name, code, description, display_order)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [project.id, asignatura.name, asignatura.code || null, asignatura.description || null, i]
          );

          const asignaturaId = asignaturaResult.rows[0].id;

          // Insert materiales for this asignatura
          if (asignatura.materiales && Array.isArray(asignatura.materiales)) {
            for (const material of asignatura.materiales) {
              await query(
                `INSERT INTO public.materiales_requeridos (asignatura_id, material_type_id, cantidad, descripcion)
                 VALUES ($1, $2, $3, $4)`,
                [asignaturaId, material.material_type_id, material.cantidad || 1, material.descripcion || null]
              );
            }
          }
        }
      }

      // Commit transaction
      await query('COMMIT');

      // Notify all project_leaders about the new project (fire and forget)
      query(
        `SELECT u.email, p.full_name
         FROM public.user_roles ur
         JOIN public.profiles p ON p.id = ur.user_id
         JOIN public.users u ON u.id = p.user_id
         WHERE ur.role = 'project_leader'
           AND u.is_active = true`,
        []
      ).then(async (leadersResult) => {
        const creatorName = req.user?.email ?? 'Un administrador';
        for (const leader of leadersResult.rows) {
          await sendTaskAssignedEmail({
            to: leader.email,
            subject: `Nuevo proyecto creado: ${project.name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0DD9D0;">Nuevo proyecto creado</h2>
                <p>Hola <strong>${leader.full_name}</strong>,</p>
                <p>Se ha creado un nuevo proyecto en la plataforma Planner Fábrica.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                  <tr>
                    <td style="padding: 8px; font-weight: bold; background: #f5f5f5;">Proyecto</td>
                    <td style="padding: 8px;">${project.name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; font-weight: bold; background: #f5f5f5;">Clave</td>
                    <td style="padding: 8px;">${project.key}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; font-weight: bold; background: #f5f5f5;">Tipo</td>
                    <td style="padding: 8px;">${project.tipo_programa ?? 'No especificado'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; font-weight: bold; background: #f5f5f5;">Fecha fin</td>
                    <td style="padding: 8px;">${project.end_date ? new Date(project.end_date).toLocaleDateString('es-CO') : 'No definida'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; font-weight: bold; background: #f5f5f5;">Creado por</td>
                    <td style="padding: 8px;">${creatorName}</td>
                  </tr>
                </table>
                <p style="color: #666; font-size: 12px;">Este es un mensaje automático de Planner Fábrica - Sealab.</p>
              </div>
            `,
          });
        }
      }).catch((err) => {
        console.error('Error sending project creation emails:', err);
      });

      res.status(201).json(project);
    } catch (error) {
      // Rollback on error
      await query('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    console.error('Create project error:', error);

    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Project key already exists' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/projects/:id/complete
 * Mark project as completed (only if all tasks are completed)
 */
export const completeProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 1) Ensure project exists
    const projectResult = await query('SELECT id, status FROM public.projects WHERE id = $1', [id]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    if (project.status === 'completed') {
      return res.status(400).json({ error: 'El proyecto ya está finalizado' });
    }

    // 2) Check task completion status for this project
    const tasksResult = await query(
      `SELECT
         COUNT(*) AS total_tasks,
         COUNT(*) FILTER (WHERE ts.is_completed = true) AS completed_tasks
       FROM public.tasks t
       JOIN public.task_statuses ts ON ts.id = t.status_id
       WHERE t.project_id = $1`,
      [id]
    );

    const taskStats = tasksResult.rows[0] || { total_tasks: 0, completed_tasks: 0 };
    const totalTasks = parseInt(taskStats.total_tasks, 10) || 0;
    const completedTasks = parseInt(taskStats.completed_tasks, 10) || 0;

    // If there are tasks, require all of them to be completed
    if (totalTasks > 0 && completedTasks < totalTasks) {
      return res.status(400).json({
        error: 'No puedes finalizar el proyecto porque aún hay tareas abiertas',
        details: {
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
        },
      });
    }

    // 3) Mark project as completed
    const updateResult = await query(
      `UPDATE public.projects
       SET status = 'completed',
           updated_at = NOW(),
           completed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Complete project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/projects/:id
 * Update project
 */
export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, status, start_date, end_date, link, link_label } = req.body;

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (start_date !== undefined) {
      updates.push(`start_date = $${paramCount++}`);
      values.push(start_date);
    }
    if (end_date !== undefined) {
      updates.push(`end_date = $${paramCount++}`);
      values.push(end_date);
    }
    if (link !== undefined) {
      updates.push(`link = $${paramCount++}`);
      values.push(link || null);
    }
    if (link_label !== undefined) {
      updates.push(`link_label = $${paramCount++}`);
      values.push(link_label || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await query(
      `UPDATE public.projects
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/projects/:id
 * Delete project (admin only, cascades to members and tasks)
 */
export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM public.projects WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/projects/:id/members
 * Add member to project
 */
export const addMember = async (req: AuthRequest, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const { user_id, role, can_create, can_edit, can_assign } = req.body;
    const invitedBy = req.user?.profileId;

    const result = await query(
      `INSERT INTO public.project_members (project_id, user_id, role, can_view, can_create, can_edit, can_assign, invited_by)
       VALUES ($1, $2, $3, true, $4, $5, $6, $7)
       RETURNING *`,
      [projectId, user_id, role || 'member', can_create || false, can_edit || false, can_assign || false, invitedBy]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Add member error:', error);

    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'User is already a member of this project' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};
