import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import {
  ASSIGNED_WORK_CTE,
  TASK_COMPLETION_CTE,
  TASK_ASSIGNEE_COUNT_CTE,
  EFFORT_HOURS_CTE,
  REPORT_TZ,
  WORK_SCHEDULE,
  buildScope,
  addBusinessDays,
  riskBand,
  assertEnum,
  validUuidOrNull,
  validDateOrNull,
  type ScopeFilters,
} from './reportsMetrics.js';

/**
 * GET /api/reports/overview
 * Executive KPIs: project counts, task status distribution, material completion, team size, avg completion time
 */
export const getOverview = async (req: AuthRequest, res: Response) => {
  try {
    // Run all queries in parallel
    const [projectsRes, tasksByStatusRes, materialsRes, teamRes, avgTimeRes, recentCompletedRes] = await Promise.all([
      // Total projects
      query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active
        FROM public.projects
      `),

      // Tasks by status
      query(`
        SELECT ts.name, ts.color, ts.is_completed, ts.display_order,
          COUNT(t.id) as count
        FROM public.task_statuses ts
        LEFT JOIN public.tasks t ON t.status_id = ts.id
        GROUP BY ts.id
        ORDER BY ts.display_order
      `),

      // Materials: total required vs completed. Fixed: COUNT(mr.id) after joining tasks
      // counted a material once per task referencing it, understating the denominator.
      query(`
        SELECT
          COUNT(DISTINCT mr.id) as total_materials,
          COUNT(DISTINCT t.material_requerido_id) FILTER (WHERE ts.is_completed = true) as completed_materials
        FROM public.materiales_requeridos mr
        LEFT JOIN public.tasks t ON t.material_requerido_id = mr.id
        LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
      `),

      // Active team members. Previously counted public.project_members — but that
      // table only gets a row when someone is explicitly "added" to a project
      // (createProject's default leaders + the manual addMember action). Actually
      // doing task/material work never requires a project_members row, so that
      // query undercounted real active people (verified: 12 vs. ~40 actual users).
      // Fixed to count everyone with at least one task/material assignment instead,
      // via the same ASSIGNED_WORK_CTE every other per-person report metric uses.
      query(`
        WITH ${ASSIGNED_WORK_CTE}
        SELECT COUNT(DISTINCT aw.profile_id) as count
        FROM assigned_work aw
        JOIN public.profiles p ON p.id = aw.profile_id
        JOIN public.users u ON u.id = p.user_id AND u.is_active = true
        WHERE aw.profile_id IS NOT NULL
      `),

      // Real lead time (created -> real completion event), replacing the old query
      // which summed duration_seconds for rows whose *to_status* was 'Finalizado' —
      // that measures time spent dwelling in Finalizado after arriving there, not
      // time-to-complete, and is near-meaningless as "avg completion time".
      query(`
        WITH ${TASK_COMPLETION_CTE}
        SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (tc.completed_at - t.created_at))), 0) as avg_seconds
        FROM public.tasks t
        JOIN task_completion tc ON tc.task_id = t.id
      `),

      // Recently completed tasks (last 30 days), using the real completion event
      // instead of tasks.updated_at (a mutable column that doesn't mean "completed").
      query(`
        WITH ${TASK_COMPLETION_CTE}
        SELECT COUNT(DISTINCT t.id) as count
        FROM public.tasks t
        JOIN public.task_statuses ts ON ts.id = t.status_id
        JOIN task_completion tc ON tc.task_id = t.id
        WHERE ts.is_completed = true
          AND tc.completed_at >= NOW() - INTERVAL '30 days'
      `),
    ]);

    const projects = projectsRes.rows[0];
    const tasksByStatus = tasksByStatusRes.rows.map(r => ({
      name: r.name,
      color: r.color,
      is_completed: r.is_completed,
      count: parseInt(r.count),
    }));
    const totalTasks = tasksByStatus.reduce((sum, s) => sum + s.count, 0);
    const materials = materialsRes.rows[0];
    const team = teamRes.rows[0];
    const avgTime = avgTimeRes.rows[0];
    const recentCompleted = recentCompletedRes.rows[0];

    res.json({
      projects: {
        total: parseInt(projects.total),
        active: parseInt(projects.active),
      },
      tasks: {
        total: totalTasks,
        by_status: tasksByStatus,
      },
      materials: {
        total: parseInt(materials.total_materials),
        completed: parseInt(materials.completed_materials),
        completion_rate: parseInt(materials.total_materials) > 0
          ? Math.round((parseInt(materials.completed_materials) / parseInt(materials.total_materials)) * 100)
          : 0,
      },
      team: {
        active_members: parseInt(team.count),
      },
      avg_completion_seconds: parseFloat(avgTime.avg_seconds),
      recent_completed_30d: parseInt(recentCompleted.count),
    });
  } catch (error) {
    console.error('Report overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/projects-progress
 * Per-project completion data with task and material counts
 */
export const getProjectsProgress = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT
        p.id, p.name, p.key, p.tipo_programa, p.status,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = true) as completed_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'En proceso') as in_progress_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'En revisión') as in_review_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'Ajustes') as adjustment_tasks,
        COUNT(DISTINCT t.id) FILTER (
          WHERE t.due_date < NOW() AND ts.is_completed = false
        ) as overdue_tasks,
        COUNT(DISTINCT t.id) FILTER (
          WHERE t.due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
            AND ts.is_completed = false
        ) as due_soon_tasks,
        (
          SELECT COUNT(mr2.id)
          FROM public.materiales_requeridos mr2
          JOIN public.temas tm2 ON tm2.id = mr2.tema_id
          JOIN public.asignaturas a2 ON a2.id = tm2.asignatura_id
          JOIN public.programas pg2 ON pg2.id = a2.programa_id
          WHERE pg2.project_id = p.id
        ) as total_materials,
        COUNT(DISTINCT t.material_requerido_id) FILTER (WHERE ts.is_completed = true) as completed_materials
      FROM public.projects p
      LEFT JOIN public.tasks t ON t.project_id = p.id
      LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
      GROUP BY p.id
      ORDER BY p.name
    `);

    const projects = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      key: r.key,
      tipo_programa: r.tipo_programa,
      status: r.status,
      total_tasks: parseInt(r.total_tasks),
      completed_tasks: parseInt(r.completed_tasks),
      in_progress_tasks: parseInt(r.in_progress_tasks),
      in_review_tasks: parseInt(r.in_review_tasks),
      adjustment_tasks: parseInt(r.adjustment_tasks),
      total_materials: parseInt(r.total_materials),
      completed_materials: parseInt(r.completed_materials),
      overdue_tasks: parseInt(r.overdue_tasks),
      due_soon_tasks: parseInt(r.due_soon_tasks),
      completion_rate: parseInt(r.total_tasks) > 0
        ? Math.round((parseInt(r.completed_tasks) / parseInt(r.total_tasks)) * 100)
        : 0,
    }));

    res.json(projects);
  } catch (error) {
    console.error('Projects progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/projects-timeline
 * Per-project timeline estimation (start, target, estimated end)
 */
export const getProjectsTimeline = async (req: AuthRequest, res: Response) => {
  try {
    // NOTE: previously divided total pending hours by headcount and a hardcoded
    // 8.05h/day for everyone — averaging is systematically optimistic (a project
    // finishes when its MOST loaded person finishes, not the average), and ignored
    // each person's real weekly_hours_capacity. Also used the nonexistent
    // parent_task_id join (see ASSIGNED_WORK_CTE), which matched zero rows. Fixed:
    // per-assignee pending hours ÷ their own daily capacity, then MAX per project.
    const result = await query(`
      WITH ${ASSIGNED_WORK_CTE},
      per_assignee AS (
        SELECT
          aw.project_id,
          aw.profile_id,
          SUM(aw.horas_estimadas) FILTER (WHERE NOT aw.is_completed) as pending_horas,
          COALESCE(prof.weekly_hours_capacity, ${WORK_SCHEDULE.WEEKLY_HOURS}) as weekly_hours_capacity
        FROM assigned_work aw
        JOIN public.profiles prof ON prof.id = aw.profile_id
        JOIN public.users prof_u ON prof_u.id = prof.user_id AND prof_u.is_active = true
        WHERE aw.profile_id IS NOT NULL
        GROUP BY aw.project_id, aw.profile_id, prof.weekly_hours_capacity
      ),
      project_max_days AS (
        SELECT project_id, MAX(pending_horas / NULLIF(weekly_hours_capacity, 0) * 5) as max_work_days
        FROM per_assignee
        WHERE pending_horas > 0
        GROUP BY project_id
      )
      SELECT
        p.id, p.name, p.key,
        MIN(t.created_at)::date as start_date,
        MAX(t.due_date)::date as target_date,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = true) as completed_tasks,
        COUNT(DISTINCT t.id) FILTER (
          WHERE t.due_date < NOW() AND ts.is_completed = false
        ) as overdue_tasks,
        COALESCE(ROUND(pmd.max_work_days::numeric, 1), 0) as estimated_work_days
      FROM public.projects p
      LEFT JOIN public.tasks t ON t.project_id = p.id
      LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
      LEFT JOIN project_max_days pmd ON pmd.project_id = p.id
      WHERE p.status != 'completed'
      GROUP BY p.id, pmd.max_work_days
      HAVING COUNT(DISTINCT t.id) > 0
        AND COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = false) > 0
      ORDER BY p.name
    `);

    const projects = result.rows.map(r => {
      const totalTasks = parseInt(r.total_tasks);
      const completedTasks = parseInt(r.completed_tasks);
      const overdueTasks = parseInt(r.overdue_tasks);
      const estimatedWorkDays = parseFloat(r.estimated_work_days);

      const completionRate =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const startDate = r.start_date ? (r.start_date as Date).toISOString().split('T')[0] : null;
      const targetDate = r.target_date ? (r.target_date as Date).toISOString().split('T')[0] : null;

      // Weekend-skipping, matching getTeamCapacity's forecast — previously this used
      // raw calendar days while getTeamCapacity skipped weekends, so the two disagreed
      // for the same underlying work.
      const estimatedDaysRemaining = Math.round(estimatedWorkDays);
      const estimatedEndDate = estimatedWorkDays > 0
        ? addBusinessDays(new Date(), estimatedWorkDays).toISOString().split('T')[0]
        : null;

      return {
        id: r.id,
        name: r.name,
        key: r.key,
        start_date: startDate,
        target_date: targetDate,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        overdue_tasks: overdueTasks,
        estimated_days_remaining: estimatedDaysRemaining,
        completion_rate: completionRate,
        estimated_end_date: estimatedEndDate,
      };
    });

    res.json(projects);
  } catch (error) {
    console.error('Projects timeline error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/team-monthly-completion
 * Completed tasks per collaborator per month (last 6 months)
 */
export const getTeamMonthlyCompletion = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT
        p.id as profile_id,
        p.full_name,
        DATE_TRUNC('month', tsh.created_at)::date as month,
        COUNT(DISTINCT tsh.task_id) as completed_count
      FROM public.task_status_history tsh
      JOIN public.task_statuses ts ON ts.id = tsh.to_status_id
        AND ts.is_completed = true
      JOIN public.tasks t ON t.id = tsh.task_id
      JOIN public.profiles p ON p.id = t.assignee_id
      WHERE tsh.created_at >= NOW() - INTERVAL '6 months'
      GROUP BY p.id, p.full_name, DATE_TRUNC('month', tsh.created_at)
      ORDER BY month ASC, completed_count DESC
    `);

    const data = result.rows.map(r => ({
      profile_id: r.profile_id,
      full_name: r.full_name,
      month: (r.month as Date).toISOString().split('T')[0],
      completed_count: parseInt(r.completed_count),
    }));

    res.json(data);
  } catch (error) {
    console.error('Team monthly completion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/team-performance
 * Per-collaborator metrics: tasks, materials, estimated/actual hours
 */
export const getTeamPerformance = async (req: AuthRequest, res: Response) => {
  try {
    // NOTE: total_horas_estimadas/total_horas_reales previously came from an
    // uncorrelated join (tma.assignee_id = p.id with no task correlation) that
    // multiplied hours by the person's task count, and from a subquery that summed
    // ALL task_status_history duration regardless of status (including idle/queue
    // time). Both are fixed here via ASSIGNED_WORK_CTE (real task_id-level join) and
    // EFFORT_HOURS_CTE (active-effort statuses only).
    const result = await query(`
      WITH ${ASSIGNED_WORK_CTE},
      ${TASK_ASSIGNEE_COUNT_CTE},
      ${EFFORT_HOURS_CTE},
      person_effort AS (
        -- Restricted to tasks with exactly one assignee: task_status_history tracks
        -- time-in-status per TASK, so a multi-assignee task's active time cannot be
        -- split between its co-assignees without inventing a split that doesn't exist.
        SELECT pe.profile_id, SUM(COALESCE(eh.h_proceso, 0) + COALESCE(eh.h_ajustes, 0)) as h_efectivas
        FROM (SELECT DISTINCT profile_id, task_id FROM assigned_work) pe
        JOIN task_assignee_counts tac ON tac.task_id = pe.task_id AND tac.n_assignees = 1
        JOIN effort_hours eh ON eh.task_id = pe.task_id
        GROUP BY pe.profile_id
      )
      SELECT
        p.id, p.full_name, p.cargo, p.avatar_url, p.email,
        COUNT(DISTINCT aw.task_id) as total_tasks,
        COUNT(DISTINCT aw.task_id) FILTER (WHERE aw.is_completed = true) as completed_tasks,
        COUNT(DISTINCT aw.task_id) FILTER (WHERE aw.status_name = 'En proceso') as in_progress_tasks,
        COUNT(aw.material_id) as materials_assigned,
        COALESCE(SUM(aw.horas_estimadas), 0) as total_horas_estimadas,
        COALESCE(MAX(pe_hours.h_efectivas), 0) as total_horas_reales
      FROM public.profiles p
      LEFT JOIN assigned_work aw ON aw.profile_id = p.id
      LEFT JOIN person_effort pe_hours ON pe_hours.profile_id = p.id
      WHERE p.cargo IS NOT NULL
      GROUP BY p.id, p.full_name, p.cargo, p.avatar_url, p.email
      ORDER BY COUNT(DISTINCT aw.task_id) FILTER (WHERE aw.is_completed = true) DESC
    `);

    const team = result.rows.map(r => ({
      id: r.id,
      full_name: r.full_name,
      cargo: r.cargo,
      avatar_url: r.avatar_url,
      email: r.email,
      total_tasks: parseInt(r.total_tasks),
      completed_tasks: parseInt(r.completed_tasks),
      in_progress_tasks: parseInt(r.in_progress_tasks),
      materials_assigned: parseInt(r.materials_assigned),
      total_horas_estimadas: parseFloat(r.total_horas_estimadas),
      total_horas_reales: parseFloat(r.total_horas_reales),
      completion_rate: parseInt(r.total_tasks) > 0
        ? Math.round((parseInt(r.completed_tasks) / parseInt(r.total_tasks)) * 100)
        : 0,
    }));

    res.json(team);
  } catch (error) {
    console.error('Team performance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/material-production
 * Material production metrics by type
 */
export const getMaterialProduction = async (req: AuthRequest, res: Response) => {
  try {
    // NOTE: previously joined `tasks.material_requerido_id = mr.id` to find each
    // material's task — but tasks.material_requerido_id is NEVER populated in practice
    // (verified: 0 of 3480 tasks), so completed/in-progress counts here have always been
    // 0 for every material type. The real relationship is task_material_assignees
    // (material -> task). Also fixed: COUNT(mr.id) after the join counted a material
    // once per matching row instead of once total.
    const result = await query(`
      WITH material_completion AS (
        SELECT
          mr.id AS material_id,
          mr.material_type_id,
          mr.cantidad,
          MAX(ts.is_completed::int) as is_completed_int
        FROM public.materiales_requeridos mr
        LEFT JOIN public.task_material_assignees tma ON tma.material_id = mr.id
        LEFT JOIN public.tasks t ON t.id = tma.task_id
        LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
        GROUP BY mr.id, mr.material_type_id, mr.cantidad
      )
      SELECT
        mt.id, mt.name, mt.icon, mt.display_order,
        COUNT(mc.material_id) as materiales,
        COALESCE(SUM(mc.cantidad), 0) as total_quantity,
        COUNT(mc.material_id) FILTER (WHERE mc.is_completed_int = 1) as completadas,
        COUNT(mc.material_id) FILTER (WHERE mc.is_completed_int = 0) as en_proceso,
        COUNT(mc.material_id) FILTER (WHERE mc.is_completed_int IS NULL) as sin_asignar
      FROM public.material_types mt
      LEFT JOIN material_completion mc ON mc.material_type_id = mt.id
      GROUP BY mt.id
      ORDER BY COUNT(mc.material_id) DESC
    `);

    const materials = result.rows.map(r => {
      const materiales = parseInt(r.materiales);
      const completadas = parseInt(r.completadas);
      return {
        id: r.id,
        name: r.name,
        icon: r.icon,
        display_order: r.display_order,
        materiales,
        total_quantity: parseInt(r.total_quantity),
        completadas,
        en_proceso: parseInt(r.en_proceso),
        sin_asignar: parseInt(r.sin_asignar),
        completion_rate: materiales > 0 ? Math.round((completadas / materiales) * 100) : 0,
      };
    });

    res.json(materials);
  } catch (error) {
    console.error('Material production error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/time-distribution
 * Duration data per status for violin/distribution charts
 */
export const getTimeDistribution = async (req: AuthRequest, res: Response) => {
  try {
    // All stats computed in SQL — no large array sent over the wire
    const result = await query(`
      SELECT
        ts.name                                                                AS status_name,
        ts.color,
        ts.display_order,
        COUNT(*)::int                                                          AS count,
        ROUND(MIN(tsh.duration_seconds)  / 3600.0, 2)                         AS min_h,
        ROUND(MAX(tsh.duration_seconds)  / 3600.0, 2)                         AS max_h,
        ROUND(AVG(tsh.duration_seconds)  / 3600.0, 2)                         AS mean_h,
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY tsh.duration_seconds) / 3600.0, 2) AS q1_h,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY tsh.duration_seconds) / 3600.0, 2) AS median_h,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY tsh.duration_seconds) / 3600.0, 2) AS q3_h
      FROM public.task_status_history tsh
      JOIN public.task_statuses ts ON ts.id = tsh.from_status_id
      WHERE tsh.duration_seconds IS NOT NULL AND tsh.duration_seconds > 0
      GROUP BY ts.id, ts.name, ts.color, ts.display_order
      ORDER BY ts.display_order
    `);

    const distribution = result.rows.map(r => ({
      status_name:    r.status_name,
      color:          r.color,
      display_order:  r.display_order,
      count:          r.count,
      durations_hours: [] as number[], // kept for type compatibility; empty — stats are in .stats
      stats: {
        min:    parseFloat(r.min_h)    || 0,
        q1:     parseFloat(r.q1_h)    || 0,
        median: parseFloat(r.median_h) || 0,
        q3:     parseFloat(r.q3_h)    || 0,
        max:    parseFloat(r.max_h)    || 0,
        mean:   parseFloat(r.mean_h)  || 0,
      },
    }));

    res.json(distribution);
  } catch (error) {
    console.error('Time distribution error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/workflow-transitions
 * Transition counts between statuses for Sankey/flow visualization
 */
export const getWorkflowTransitions = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT
        fs.name as from_status, fs.color as from_color, fs.display_order as from_order,
        tos.name as to_status, tos.color as to_color, tos.display_order as to_order,
        COUNT(*) as transition_count
      FROM public.task_status_history tsh
      JOIN public.task_statuses fs ON fs.id = tsh.from_status_id
      JOIN public.task_statuses tos ON tos.id = tsh.to_status_id
      GROUP BY fs.id, fs.name, fs.color, fs.display_order, tos.id, tos.name, tos.color, tos.display_order
      ORDER BY fs.display_order, tos.display_order
    `);

    const transitions = result.rows.map(r => ({
      from_status: r.from_status,
      from_color: r.from_color,
      to_status: r.to_status,
      to_color: r.to_color,
      count: parseInt(r.transition_count),
    }));

    res.json(transitions);
  } catch (error) {
    console.error('Workflow transitions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/workload-by-cargo
 * Workload grouped by cargo (role/position)
 */
/**
 * GET /api/reports/team-capacity
 * Per-person capacity analysis: pending hours vs daily capacity, estimated work days
 * Schedule: Mon-Thu 8:00-18:00 (1h lunch + 45min break = 8.25h), Fri 8:00-17:00 (7.25h)
 */
export const getTeamCapacity = async (req: AuthRequest, res: Response) => {
  try {
    // NOTE: previously joined task_material_assignees via a fictitious parent_task_id
    // hierarchy that essentially doesn't exist in production data (verified: only 1 of
    // 3480 tasks has parent_task_id set) — that join matched ZERO rows, so this endpoint
    // has been silently returning 0 pending/completed hours for every person. Fixed via
    // ASSIGNED_WORK_CTE (the real, direct tma.task_id = t.id relationship).
    const result = await query(`
      WITH ${ASSIGNED_WORK_CTE}
      SELECT
        p.id, p.full_name, p.cargo, p.avatar_url,
        COALESCE(p.weekly_hours_capacity, ${WORK_SCHEDULE.WEEKLY_HOURS}) AS weekly_hours_capacity,
        COUNT(DISTINCT aw.task_id) FILTER (WHERE NOT aw.is_completed) as pending_tasks,
        COUNT(DISTINCT aw.task_id) FILTER (WHERE aw.is_completed) as completed_tasks,
        COUNT(DISTINCT aw.task_id) FILTER (WHERE NOT aw.is_completed AND aw.horas_estimadas IS NULL) as tasks_sin_estimacion,
        COALESCE(SUM(aw.horas_estimadas) FILTER (WHERE NOT aw.is_completed), 0) as pending_horas,
        COALESCE(SUM(aw.horas_estimadas) FILTER (WHERE aw.is_completed), 0) as completed_horas,
        COALESCE(SUM(aw.horas_estimadas) FILTER (WHERE NOT aw.is_completed AND aw.due_date IS NULL), 0) as horas_sin_fecha,
        COALESCE(SUM(aw.horas_estimadas) FILTER (
          WHERE NOT aw.is_completed AND aw.due_date < date_trunc('week', CURRENT_DATE)
        ), 0) as horas_vencidas,
        COALESCE(SUM(aw.horas_estimadas) FILTER (
          WHERE NOT aw.is_completed
            AND aw.due_date >= date_trunc('week', CURRENT_DATE)
            AND aw.due_date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
        ), 0) as horas_semana_actual
      FROM public.profiles p
      JOIN public.users u ON u.id = p.user_id AND u.is_active = true
      LEFT JOIN assigned_work aw ON aw.profile_id = p.id
      WHERE p.cargo IS NOT NULL
      GROUP BY p.id, p.full_name, p.cargo, p.avatar_url, p.weekly_hours_capacity
      ORDER BY COALESCE(SUM(aw.horas_estimadas) FILTER (WHERE NOT aw.is_completed), 0) DESC
    `);

    const members = result.rows.map(r => {
      const pendingHoras = parseFloat(r.pending_horas);
      const horasVencidas = parseFloat(r.horas_vencidas);
      const horasSemanaActual = parseFloat(r.horas_semana_actual);
      const cargaSemanaActual = horasVencidas + horasSemanaActual;
      const memberWeekly =
        r.weekly_hours_capacity != null && !Number.isNaN(Number(r.weekly_hours_capacity))
          ? parseFloat(String(r.weekly_hours_capacity))
          : WORK_SCHEDULE.WEEKLY_HOURS;
      const memberDaily = memberWeekly > 0 ? memberWeekly / 5 : WORK_SCHEDULE.AVG_DAILY_HOURS;

      // "Days to clear the backlog" legitimately uses the FULL unbounded backlog
      // (including no-due-date work) — it answers "how long until nothing is pending",
      // not "how loaded is this week".
      const estimatedWorkDays =
        pendingHoras > 0 && memberDaily > 0 ? Math.round((pendingHoras / memberDaily) * 10) / 10 : 0;

      let estimatedCompletionDate: string | null = null;
      if (estimatedWorkDays > 0) {
        estimatedCompletionDate = addBusinessDays(new Date(), estimatedWorkDays).toISOString().split('T')[0];
      }

      // Real, time-bounded utilization: this week's committed load (overdue + due this
      // week) vs. this week's capacity — NOT the entire backlog divided by one week,
      // which is why the old numbers could read "300% ocupación".
      const utilizationPct = memberWeekly > 0 ? Math.round((cargaSemanaActual / memberWeekly) * 100) : 0;
      const holguraHoras = Math.round((memberWeekly - cargaSemanaActual) * 100) / 100;
      const band = riskBand(utilizationPct);

      return {
        id: r.id,
        full_name: r.full_name,
        cargo: r.cargo,
        avatar_url: r.avatar_url,
        weekly_hours_capacity: Math.round(memberWeekly * 100) / 100,
        pending_tasks: parseInt(r.pending_tasks),
        completed_tasks: parseInt(r.completed_tasks),
        tasks_sin_estimacion: parseInt(r.tasks_sin_estimacion),
        pending_horas: Math.round(pendingHoras * 100) / 100,
        completed_horas: Math.round(parseFloat(r.completed_horas) * 100) / 100,
        horas_sin_fecha: Math.round(parseFloat(r.horas_sin_fecha) * 100) / 100,
        horas_vencidas: Math.round(horasVencidas * 100) / 100,
        horas_semana_actual: Math.round(horasSemanaActual * 100) / 100,
        carga_semana_actual: Math.round(cargaSemanaActual * 100) / 100,
        estimated_work_days: estimatedWorkDays,
        estimated_completion_date: estimatedCompletionDate,
        utilization_pct: utilizationPct,
        holgura_horas: holguraHoras,
        risk_level: band.level,
        risk_label: band.label,
        risk_color: band.color,
      };
    });

    res.json({
      schedule: {
        mon_thu_hours: WORK_SCHEDULE.MON_THU_HOURS,
        friday_hours: WORK_SCHEDULE.FRIDAY_HOURS,
        weekly_hours: WORK_SCHEDULE.WEEKLY_HOURS,
        weekly_hours_default: WORK_SCHEDULE.WEEKLY_HOURS,
        avg_daily_hours: Math.round(WORK_SCHEDULE.AVG_DAILY_HOURS * 100) / 100,
      },
      members,
    });
  } catch (error) {
    console.error('Team capacity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/user-mini-report/:userId
 * Per-user diagnostic summary for the Equipo tab drawer:
 * - Task counts by status and critical buckets (vencidas, hoy, sin estimación, alta prioridad)
 * - Pending vs completed hours and weekly capacity
 * - Top 5 tasks that require attention
 */
export const getUserMiniReport = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.params.userId || (req.query.userId as string | undefined) || '').trim();

    if (!userId) {
      return res.status(400).json({ error: 'userId inválido' });
    }

    // Basic profile + capacity
    const profileRes = await query(
      `
        SELECT
          id,
          full_name,
          cargo,
          avatar_url,
          email,
          COALESCE(weekly_hours_capacity, 40.25) AS weekly_hours_capacity
        FROM public.profiles
        WHERE id = $1
      `,
      [userId],
    );

    if (profileRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const profile = profileRes.rows[0];

    // Aggregate metrics and status distribution for this user. Previously scoped by
    // `t.assignee_id = $1` and joined tma via the (empirically nonexistent)
    // parent_task_id hierarchy — missed material-level assignments to this person and
    // could include tasks nominally assigned to them but whose materials belong to
    // someone else. Fixed via ASSIGNED_WORK_CTE (real per-material attribution).
    const summaryRes = await query(
      `
        WITH ${ASSIGNED_WORK_CTE}
        SELECT
          COUNT(DISTINCT aw.task_id) AS total_tasks,
          COUNT(DISTINCT aw.task_id) FILTER (WHERE NOT aw.is_completed) AS pending_tasks,
          COUNT(DISTINCT aw.task_id) FILTER (WHERE aw.status_name = 'En proceso') AS in_progress_tasks,
          COUNT(DISTINCT aw.task_id) FILTER (WHERE aw.status_name = 'En revisión') AS in_review_tasks,
          COUNT(DISTINCT aw.task_id) FILTER (WHERE aw.status_name = 'Ajustes') AS adjustment_tasks,
          COUNT(DISTINCT aw.task_id) FILTER (WHERE aw.is_completed) AS completed_tasks,
          COUNT(DISTINCT aw.task_id) FILTER (WHERE aw.due_date < CURRENT_DATE AND NOT aw.is_completed) AS overdue_tasks,
          COUNT(DISTINCT aw.task_id) FILTER (WHERE aw.due_date = CURRENT_DATE AND NOT aw.is_completed) AS today_tasks,
          COUNT(DISTINCT aw.task_id) FILTER (WHERE NOT aw.is_completed AND aw.horas_estimadas IS NULL) AS tasks_sin_estimacion,
          COUNT(DISTINCT aw.task_id) FILTER (WHERE NOT aw.is_completed AND t.priority IN ('high', 'urgent')) AS high_priority_tasks,
          COALESCE(SUM(aw.horas_estimadas) FILTER (WHERE NOT aw.is_completed), 0) AS pending_horas,
          COALESCE(SUM(aw.horas_estimadas) FILTER (WHERE aw.is_completed), 0) AS completed_horas,
          COALESCE(SUM(aw.horas_estimadas) FILTER (
            WHERE NOT aw.is_completed AND aw.due_date < date_trunc('week', CURRENT_DATE)
          ), 0) AS horas_vencidas,
          COALESCE(SUM(aw.horas_estimadas) FILTER (
            WHERE NOT aw.is_completed
              AND aw.due_date >= date_trunc('week', CURRENT_DATE)
              AND aw.due_date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
          ), 0) AS horas_semana_actual
        FROM assigned_work aw
        JOIN public.tasks t ON t.id = aw.task_id
        WHERE aw.profile_id = $1
      `,
      [userId],
    );

    const statusRes = await query(
      `
        WITH ${ASSIGNED_WORK_CTE}
        SELECT aw.status_name, aw.is_completed, COUNT(DISTINCT aw.task_id) AS count
        FROM assigned_work aw
        WHERE aw.profile_id = $1
        GROUP BY aw.status_name, aw.is_completed
        ORDER BY aw.status_name
      `,
      [userId],
    );

    const topTasksRes = await query(
      `
        WITH ${ASSIGNED_WORK_CTE}
        SELECT
          t.id, t.title, t.priority, aw.due_date, t.created_at,
          aw.status_name, aw.is_completed,
          SUM(aw.horas_estimadas) AS horas_estimadas,
          p.id AS project_id, p.name AS project_name, p.key AS project_key
        FROM assigned_work aw
        JOIN public.tasks t ON t.id = aw.task_id
        JOIN public.projects p ON p.id = aw.project_id
        WHERE aw.profile_id = $1
          AND NOT aw.is_completed
          AND aw.status_name IN ('En proceso', 'En pausa', 'En revisión')
        GROUP BY t.id, t.title, t.priority, aw.due_date, t.created_at, aw.status_name, aw.is_completed, p.id, p.name, p.key
        ORDER BY
          CASE aw.status_name
            WHEN 'En proceso' THEN 1
            WHEN 'En revisión' THEN 2
            WHEN 'En pausa' THEN 3
            ELSE 4
          END,
          COALESCE(aw.due_date, CURRENT_DATE + INTERVAL '365 days'),
          t.created_at DESC
        LIMIT 10
      `,
      [userId],
    );

    const summary = summaryRes.rows[0] || {
      total_tasks: 0,
      pending_tasks: 0,
      in_progress_tasks: 0,
      in_review_tasks: 0,
      adjustment_tasks: 0,
      completed_tasks: 0,
      overdue_tasks: 0,
      today_tasks: 0,
      tasks_sin_estimacion: 0,
      high_priority_tasks: 0,
      pending_horas: 0,
      completed_horas: 0,
      horas_vencidas: 0,
      horas_semana_actual: 0,
    };

    const totalTasks = Number(summary.total_tasks) || 0;
    const pendingHoras = Number(summary.pending_horas) || 0;
    const horasVencidas = Number(summary.horas_vencidas) || 0;
    const horasSemanaActual = Number(summary.horas_semana_actual) || 0;
    const cargaSemanaActual = horasVencidas + horasSemanaActual;
    const weeklyCapacity = Number(profile.weekly_hours_capacity) || WORK_SCHEDULE.WEEKLY_HOURS;

    // Real, time-bounded utilization (overdue + due this week vs. this week's capacity) —
    // not the entire unbounded backlog divided by one week (that's what "pending_horas"
    // is for, kept below only to drive the backlog-drain estimate the drawer already shows).
    const utilizationPct = weeklyCapacity > 0
      ? Math.round((cargaSemanaActual / weeklyCapacity) * 100)
      : 0;
    const holguraHoras = Math.round((weeklyCapacity - cargaSemanaActual) * 100) / 100;

    // Health badge rules
    const overdue = Number(summary.overdue_tasks) || 0;
    const sinEstimacion = Number(summary.tasks_sin_estimacion) || 0;

    let healthStatus: 'ok' | 'attention' | 'risk' | 'no_load' = 'ok';
    const reasons: string[] = [];

    if (totalTasks === 0 || (pendingHoras === 0 && weeklyCapacity > 0)) {
      healthStatus = 'no_load';
    } else if (
      utilizationPct > 100
      || overdue >= 2
      || (overdue > 0 && summary.high_priority_tasks > 0)
    ) {
      healthStatus = 'risk';
    } else if (
      overdue > 0
      || sinEstimacion >= 3
      || (utilizationPct >= 85 && utilizationPct <= 100)
    ) {
      healthStatus = 'attention';
    }

    if (overdue > 0) reasons.push(`${overdue} tareas vencidas`);
    if (summary.today_tasks > 0) reasons.push(`${summary.today_tasks} vencen hoy`);
    if (summary.high_priority_tasks > 0) reasons.push(`${summary.high_priority_tasks} de alta prioridad`);
    if (sinEstimacion > 0) reasons.push(`${sinEstimacion} sin estimación`);

    let healthLabel = 'OK';
    if (healthStatus === 'attention') healthLabel = 'Atención';
    else if (healthStatus === 'risk') healthLabel = 'Riesgo';
    else if (healthStatus === 'no_load') healthLabel = 'Sin carga';

    let healthColor: 'emerald' | 'amber' | 'red' | 'slate' = 'emerald';
    if (healthStatus === 'attention') healthColor = 'amber';
    else if (healthStatus === 'risk') healthColor = 'red';
    else if (healthStatus === 'no_load') healthColor = 'slate';

    const tasksByStatus = statusRes.rows.map(r => ({
      status_name: r.status_name as string,
      is_completed: Boolean(r.is_completed),
      count: parseInt(r.count, 10),
    }));

    const topTasks = topTasksRes.rows.map(r => ({
      id: r.id,
      title: r.title,
      priority: r.priority,
      due_date: r.due_date,
      created_at: r.created_at,
      status_name: r.status_name,
      is_completed: r.is_completed,
      horas_estimadas: r.horas_estimadas != null ? Number(r.horas_estimadas) : null,
      project: {
        id: r.project_id,
        name: r.project_name,
        key: r.project_key,
      },
    }));

    res.json({
      user: {
        id: profile.id,
        full_name: profile.full_name,
        cargo: profile.cargo,
        avatar_url: profile.avatar_url,
        email: profile.email,
      },
      summary: {
        total_tasks: totalTasks,
        pending_tasks: Number(summary.pending_tasks) || 0,
        in_progress_tasks: Number(summary.in_progress_tasks) || 0,
        in_review_tasks: Number(summary.in_review_tasks) || 0,
        adjustment_tasks: Number(summary.adjustment_tasks) || 0,
        completed_tasks: Number(summary.completed_tasks) || 0,
        overdue_tasks: overdue,
        today_tasks: Number(summary.today_tasks) || 0,
        tasks_sin_estimacion: sinEstimacion,
        high_priority_tasks: Number(summary.high_priority_tasks) || 0,
        pending_horas: pendingHoras,
        completed_horas: Number(summary.completed_horas) || 0,
        horas_vencidas: horasVencidas,
        horas_semana_actual: horasSemanaActual,
        carga_semana_actual: cargaSemanaActual,
        weekly_hours_capacity: weeklyCapacity,
        utilization_pct: utilizationPct,
        holgura_horas: holguraHoras,
      },
      health: {
        status: healthStatus,
        label: healthLabel,
        color: healthColor,
        reasons,
      },
      tasks_by_status: tasksByStatus,
      top_tasks: topTasks,
    });
  } catch (error) {
    console.error('User mini report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getWorkloadByCargo = async (req: AuthRequest, res: Response) => {
  try {
    // NOTE: previously joined task_material_assignees on assignee_id only, with no
    // task correlation — a cartesian product that inflated total_horas_estimadas.
    // Fixed via ASSIGNED_WORK_CTE (real per-task join).
    const result = await query(`
      WITH ${ASSIGNED_WORK_CTE}
      SELECT
        COALESCE(p.cargo, 'Sin cargo') as cargo,
        COUNT(DISTINCT p.id) as team_count,
        COUNT(DISTINCT aw.task_id) as total_tasks,
        COUNT(DISTINCT aw.task_id) FILTER (WHERE aw.is_completed = true) as completed_tasks,
        COUNT(DISTINCT aw.task_id) FILTER (WHERE NOT aw.is_completed) as pending_tasks,
        COALESCE(SUM(aw.horas_estimadas), 0) as total_horas_estimadas
      FROM public.profiles p
      JOIN public.users u ON u.id = p.user_id AND u.is_active = true
      LEFT JOIN assigned_work aw ON aw.profile_id = p.id
      GROUP BY COALESCE(p.cargo, 'Sin cargo')
      HAVING COUNT(DISTINCT aw.task_id) > 0
      ORDER BY COUNT(DISTINCT aw.task_id) DESC
    `);

    const workload = result.rows.map(r => ({
      cargo: r.cargo,
      team_count: parseInt(r.team_count),
      total_tasks: parseInt(r.total_tasks),
      completed_tasks: parseInt(r.completed_tasks),
      pending_tasks: parseInt(r.pending_tasks),
      total_horas_estimadas: parseFloat(r.total_horas_estimadas),
      completion_rate: parseInt(r.total_tasks) > 0
        ? Math.round((parseInt(r.completed_tasks) / parseInt(r.total_tasks)) * 100)
        : 0,
    }));

    res.json(workload);
  } catch (error) {
    console.error('Workload by cargo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/project-categories
 * Summary by project category (académico / marketing / otros)
 */
export const getProjectCategoriesSummary = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT
        COALESCE(
          NULLIF(p.category, ''),
          CASE WHEN p.tipo_programa = 'desarrollo' THEN 'desarrollo' ELSE NULL END,
          'sin_categoria'
        ) AS category,
        COUNT(*) AS total_projects,
        COUNT(t.id) AS total_tasks
      FROM public.projects p
      LEFT JOIN public.tasks t ON t.project_id = p.id
      GROUP BY COALESCE(
        NULLIF(p.category, ''),
        CASE WHEN p.tipo_programa = 'desarrollo' THEN 'desarrollo' ELSE NULL END,
        'sin_categoria'
      )
      ORDER BY 1
    `);

    const data = result.rows.map(r => ({
      category: r.category,
      total_projects: parseInt(r.total_projects),
      total_tasks: parseInt(r.total_tasks),
    }));

    res.json(data);
  } catch (error) {
    console.error('Project categories summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/tasks-weekly-trend
 * Weekly trend of tasks created vs completed (last 12 weeks)
 */
export const getTasksWeeklyTrend = async (req: AuthRequest, res: Response) => {
  try {
    // Created per day (last 12 days)
    const createdRes = await query(`
      SELECT
        DATE_TRUNC('day', created_at)::date AS week_start,
        COUNT(*) AS created
      FROM public.tasks
      WHERE created_at >= NOW() - INTERVAL '12 days'
      GROUP BY DATE_TRUNC('day', created_at)::date
      ORDER BY week_start
    `);

    // Completed per day (last 12 days) — uses the real completion event
    // (task_status_history) instead of tasks.updated_at, which is mutable and
    // doesn't represent "when the task was completed".
    const completedRes = await query(`
      WITH ${TASK_COMPLETION_CTE}
      SELECT
        DATE_TRUNC('day', tc.completed_at AT TIME ZONE '${REPORT_TZ}')::date AS week_start,
        COUNT(*) AS completed
      FROM public.tasks t
      JOIN public.task_statuses ts ON ts.id = t.status_id AND ts.is_completed = true
      JOIN task_completion tc ON tc.task_id = t.id
      WHERE tc.completed_at >= NOW() - INTERVAL '12 days'
      GROUP BY DATE_TRUNC('day', tc.completed_at AT TIME ZONE '${REPORT_TZ}')::date
      ORDER BY week_start
    `);

    const map = new Map<string, { week: string; created: number; completed: number }>();

    createdRes.rows.forEach(r => {
      const week = (r.week_start as Date).toISOString().split('T')[0];
      map.set(week, {
        week,
        created: parseInt(r.created),
        completed: 0,
      });
    });

    completedRes.rows.forEach(r => {
      const week = (r.week_start as Date).toISOString().split('T')[0];
      const existing = map.get(week) || { week, created: 0, completed: 0 };
      existing.completed = parseInt(r.completed);
      map.set(week, existing);
    });

    // Sort by week ascending
    const data = Array.from(map.values()).sort((a, b) => a.week.localeCompare(b.week));

    res.json(data);
  } catch (error) {
    console.error('Tasks weekly trend error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/team-by-cargo
 * Team members grouped by cargo with task counts and on-time rate
 */
export const getTeamByCargo = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT
        p.id, p.full_name, p.cargo, p.avatar_url,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = true) as completed_tasks,
        COUNT(DISTINCT t.id) FILTER (
          WHERE ts.is_completed = false AND t.id IS NOT NULL
        ) as active_tasks,
        COUNT(DISTINCT t.id) FILTER (
          WHERE t.due_date < NOW() AND ts.is_completed = false
        ) as overdue_tasks,
        COUNT(tsh_adj.id) as ajustes_count,
        COUNT(DISTINCT t.id) FILTER (
          WHERE t.due_date IS NOT NULL AND ts.is_completed = true
            AND t.updated_at <= t.due_date
        ) as on_time_tasks,
        COUNT(DISTINCT t.id) FILTER (
          WHERE t.due_date IS NOT NULL AND ts.is_completed = true
        ) as completadas_con_fecha
      FROM public.profiles p
      JOIN public.users u ON u.id = p.user_id AND u.is_active = true
      LEFT JOIN public.tasks t ON t.assignee_id = p.id
      LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
      LEFT JOIN public.task_status_history tsh_adj
        ON tsh_adj.task_id = t.id
        AND tsh_adj.to_status_id = (
          SELECT id FROM public.task_statuses WHERE name = 'Ajustes' LIMIT 1
        )
      WHERE p.cargo IS NOT NULL
      GROUP BY p.id
      ORDER BY p.cargo ASC, completed_tasks DESC, total_tasks DESC
    `);

    const rows = result.rows as Array<{
      id: string;
      full_name: string;
      cargo: string;
      avatar_url: string | null;
      total_tasks: string;
      completed_tasks: string;
      active_tasks: string;
      overdue_tasks: string;
      ajustes_count: string;
      on_time_tasks: string;
      completadas_con_fecha: string;
    }>;

    res.json(
      rows.map((r) => {
        const completadas = parseInt(r.completadas_con_fecha, 10);
        const onTime = parseInt(r.on_time_tasks, 10);
        return {
          id: r.id,
          full_name: r.full_name,
          cargo: r.cargo,
          avatar_url: r.avatar_url,
          total_tasks: parseInt(r.total_tasks, 10),
          completed_tasks: parseInt(r.completed_tasks, 10),
          active_tasks: parseInt(r.active_tasks, 10),
          overdue_tasks: parseInt(r.overdue_tasks, 10),
          ajustes_count: parseInt(r.ajustes_count, 10),
          on_time_tasks: onTime,
          completadas_con_fecha: completadas,
          is_active: parseInt(r.total_tasks, 10) > 0,
          on_time_rate:
            completadas > 0 ? Math.round((onTime / completadas) * 100) : null,
        };
      })
    );
  } catch (error) {
    console.error('Team by cargo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/weekly-by-cargo
 * Weekly completed task count per cargo (last 8 weeks)
 */
export const getWeeklyByCargo = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT
        DATE_TRUNC('day', tsh.created_at)::date as week,
        p.cargo,
        COUNT(DISTINCT tsh.task_id) as completed_count
      FROM public.task_status_history tsh
      JOIN public.task_statuses ts ON ts.id = tsh.to_status_id
        AND ts.is_completed = true
      JOIN public.tasks t ON t.id = tsh.task_id
      JOIN public.profiles p ON p.id = t.assignee_id
      JOIN public.users u ON u.id = p.user_id AND u.is_active = true
      WHERE tsh.created_at >= NOW() - INTERVAL '12 days'
        AND p.cargo IS NOT NULL
      GROUP BY week, p.cargo
      ORDER BY week ASC
    `);

    const rows = result.rows as Array<{
      week: Date;
      cargo: string;
      completed_count: string;
    }>;

    res.json(
      rows.map((r) => ({
        week: (r.week as Date).toISOString().split('T')[0],
        cargo: r.cargo,
        completed_count: parseInt(r.completed_count, 10),
      }))
    );
  } catch (error) {
    console.error('Weekly by cargo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/unassigned-materials
 * Materiales requeridos that have no task_material_assignees
 */
export const getUnassignedMaterials = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT
        mr.id, mr.cantidad, mt.name as material_type, mt.icon,
        COALESCE(tm.title, a.name) as tema,
        a.name as asignatura,
        proj.name as project_name,
        proj.key as project_key,
        proj.id as project_id
      FROM public.materiales_requeridos mr
      JOIN public.material_types mt ON mt.id = mr.material_type_id
      JOIN public.asignaturas a ON a.id = mr.asignatura_id
      LEFT JOIN public.temas tm ON tm.id = mr.tema_id
      LEFT JOIN public.projects proj ON proj.id = a.project_id
      WHERE proj.id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.task_material_assignees tma
          WHERE tma.material_id = mr.id
        )
      ORDER BY proj.name, mt.display_order, a.name
      LIMIT 50
    `);

    const rows = result.rows as Array<{
      id: string;
      cantidad: string;
      material_type: string;
      icon: string | null;
      tema: string;
      asignatura: string;
      project_name: string;
      project_key: string;
      project_id: string;
    }>;

    res.json(
      rows.map((r) => ({
        id: r.id,
        cantidad: parseInt(r.cantidad, 10),
        material_type: r.material_type,
        icon: r.icon ?? '',
        tema: r.tema,
        asignatura: r.asignatura,
        project_name: r.project_name,
        project_key: r.project_key,
        project_id: r.project_id,
      }))
    );
  } catch (error) {
    console.error('Unassigned materials error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/individual-performance
 * Query params: project_id? (UUID), date_from? (ISO date), date_to? (ISO date)
 * Returns per-collaborator: tasks completed, materials assignments rollup, asignaturas covered,
 * estimated hours, real hours (from task_status_history), efficiency %, on-time rate
 */
export const getIndividualPerformance = async (req: AuthRequest, res: Response) => {
  try {
    const project_id = req.query.project_id as string | undefined;
    const date_from = req.query.date_from as string | undefined;
    const date_to = req.query.date_to as string | undefined;

    const params: unknown[] = [];
    let i = 1;

    let projectFilter = '';
    if (project_id) {
      projectFilter = `AND t.project_id = $${i}::uuid`;
      params.push(project_id);
      i += 1;
    }

    let dateFilter = '';
    if (date_from && date_to) {
      dateFilter = `AND t.updated_at::date BETWEEN $${i}::date AND $${i + 1}::date`;
      params.push(date_from, date_to);
      i += 2;
    } else if (date_from) {
      dateFilter = `AND t.updated_at >= $${i}::date`;
      params.push(date_from);
      i += 1;
    } else if (date_to) {
      dateFilter = `AND t.updated_at::date <= $${i}::date`;
      params.push(date_to);
      i += 1;
    }

    const result = await query(
      `WITH assignee_tasks_raw AS (
        SELECT
          tma.assignee_id AS profile_id,
          t.id AS task_id,
          ts_status.is_completed,
          tma.horas_estimadas,
          t.due_date,
          t.updated_at AS completed_at,
          mr.asignatura_id
        FROM public.task_material_assignees tma
        JOIN public.tasks t ON t.id = tma.task_id
        JOIN public.task_statuses ts_status ON ts_status.id = t.status_id
        LEFT JOIN public.materiales_requeridos mr ON mr.id = tma.material_id
        WHERE 1=1 ${projectFilter} ${dateFilter}
      ),
      assignee_tasks AS (
        SELECT
          profile_id,
          task_id,
          BOOL_OR(is_completed) AS is_completed,
          SUM(horas_estimadas) AS horas_estimadas,
          MAX(due_date) AS due_date,
          MAX(completed_at) AS completed_at
        FROM assignee_tasks_raw
        GROUP BY profile_id, task_id
      ),
      asignaturas_profile AS (
        SELECT profile_id, COUNT(DISTINCT asignatura_id)::bigint AS asignaturas_cubiertas
        FROM assignee_tasks_raw
        WHERE asignatura_id IS NOT NULL
        GROUP BY profile_id
      ),
      real_hours AS (
        SELECT task_id, SUM(duration_seconds) / 3600.0 AS horas_reales
        FROM public.task_status_history
        WHERE duration_seconds IS NOT NULL
        GROUP BY task_id
      ),
      ontime AS (
        SELECT profile_id,
          COUNT(*) FILTER (
            WHERE is_completed AND due_date IS NOT NULL AND completed_at::date <= due_date
          ) AS on_time,
          COUNT(*) FILTER (WHERE is_completed AND due_date IS NOT NULL) AS with_due_date
        FROM assignee_tasks
        GROUP BY profile_id
      )
      SELECT
        p.id,
        p.full_name,
        p.cargo,
        p.avatar_url,
        p.email,
        COALESCE(agg.total_tareas, 0)::int AS total_tareas,
        COALESCE(agg.tareas_completadas, 0)::int AS tareas_completadas,
        COALESCE(agg.tareas_pendientes, 0)::int AS tareas_pendientes,
        COALESCE(agg.asignaturas_cubiertas, 0)::int AS asignaturas_cubiertas,
        COALESCE(agg.horas_estimadas_total, 0)::numeric AS horas_estimadas_total,
        COALESCE(agg.horas_reales_total, 0)::numeric AS horas_reales_total,
        agg.eficiencia_pct,
        agg.puntualidad_pct
      FROM public.profiles p
      JOIN public.users u ON u.id = p.user_id AND u.is_active = true
      INNER JOIN (
        SELECT DISTINCT assignee_id AS profile_id
        FROM public.task_material_assignees
        WHERE assignee_id IS NOT NULL
        UNION
        SELECT DISTINCT assignee_id AS profile_id
        FROM public.tasks
        WHERE assignee_id IS NOT NULL
      ) ever_active ON ever_active.profile_id = p.id
      LEFT JOIN (
        SELECT
          at1.profile_id,
          COUNT(DISTINCT at1.task_id) AS total_tareas,
          COUNT(DISTINCT at1.task_id) FILTER (WHERE at1.is_completed) AS tareas_completadas,
          COUNT(DISTINCT at1.task_id) FILTER (WHERE NOT at1.is_completed) AS tareas_pendientes,
          COALESCE(MAX(ap.asignaturas_cubiertas), 0)::bigint AS asignaturas_cubiertas,
          ROUND(COALESCE(SUM(at1.horas_estimadas), 0)::numeric, 1) AS horas_estimadas_total,
          ROUND(COALESCE(SUM(rh.horas_reales), 0)::numeric, 1) AS horas_reales_total,
          CASE
            WHEN COALESCE(SUM(rh.horas_reales), 0) > 0
            THEN ROUND((COALESCE(SUM(at1.horas_estimadas), 0) / NULLIF(SUM(rh.horas_reales), 0) * 100)::numeric, 0)
            ELSE NULL
          END AS eficiencia_pct,
          CASE
            WHEN COALESCE(MAX(ot.with_due_date), 0) > 0  
            THEN ROUND((MAX(ot.on_time)::numeric / NULLIF(MAX(ot.with_due_date), 0) * 100), 0)
            ELSE NULL
          END AS puntualidad_pct
        FROM assignee_tasks at1
        LEFT JOIN real_hours rh ON rh.task_id = at1.task_id
        LEFT JOIN asignaturas_profile ap ON ap.profile_id = at1.profile_id
        LEFT JOIN ontime ot ON ot.profile_id = at1.profile_id
        GROUP BY at1.profile_id, ot.on_time, ot.with_due_date
      ) agg ON agg.profile_id = p.id
      ORDER BY tareas_completadas DESC, p.full_name ASC`,
      params
    );

    const rows = result.rows as Array<Record<string, unknown>>;

    res.json(
      rows.map((r) => ({
        id: r.id as string,
        full_name: r.full_name as string,
        cargo: (r.cargo as string) ?? null,
        avatar_url: (r.avatar_url as string) ?? null,
        email: r.email as string,
        total_tareas: parseInt(String(r.total_tareas), 10),
        tareas_completadas: parseInt(String(r.tareas_completadas), 10),
        tareas_pendientes: parseInt(String(r.tareas_pendientes), 10),
        asignaturas_cubiertas: parseInt(String(r.asignaturas_cubiertas), 10),
        horas_estimadas_total: parseFloat(String(r.horas_estimadas_total)),
        horas_reales_total: parseFloat(String(r.horas_reales_total)),
        eficiencia_pct: r.eficiencia_pct != null ? parseInt(String(r.eficiencia_pct), 10) : null,
        puntualidad_pct: r.puntualidad_pct != null ? parseInt(String(r.puntualidad_pct), 10) : null,
      }))
    );
  } catch (error) {
    console.error('Individual performance report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/time-by-phase
 * Average time per workflow status per collaborator, pivoted as phases array.
 * Uses task_status_history + tasks.assignee_id.
 */
export const getTimeByPhase = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT
        p.id                                                     AS profile_id,
        p.full_name,
        p.avatar_url,
        ts.name                                                  AS status_name,
        ts.color                                                 AS status_color,
        ts.display_order,
        COUNT(*)::int                                            AS sample_count,
        ROUND(AVG(tsh.duration_seconds) / 3600.0, 2)            AS avg_hours,
        ROUND(
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY tsh.duration_seconds)
          / 3600.0, 2
        )                                                        AS median_hours
      FROM public.task_status_history tsh
      JOIN public.tasks t  ON t.id  = tsh.task_id
      JOIN public.profiles p ON p.id = t.assignee_id
      JOIN public.users u ON u.id = p.user_id AND u.is_active = true
      JOIN public.task_statuses ts ON ts.id = tsh.from_status_id
      WHERE tsh.duration_seconds IS NOT NULL
        AND tsh.duration_seconds > 0
        AND t.assignee_id IS NOT NULL
      GROUP BY p.id, p.full_name, p.avatar_url,
               ts.name, ts.color, ts.display_order
      ORDER BY p.full_name, ts.display_order
    `);

    // Pivot flat rows → { profile_id, full_name, avatar_url, phases[] }
    const map = new Map<string, {
      profile_id: string;
      full_name: string;
      avatar_url: string | null;
      phases: { status_name: string; status_color: string; avg_hours: number; median_hours: number; sample_count: number }[];
    }>();

    for (const r of result.rows) {
      if (!map.has(r.profile_id)) {
        map.set(r.profile_id, {
          profile_id: r.profile_id,
          full_name: r.full_name,
          avatar_url: r.avatar_url ?? null,
          phases: [],
        });
      }
      map.get(r.profile_id)!.phases.push({
        status_name: r.status_name,
        status_color: r.status_color,
        avg_hours: parseFloat(r.avg_hours),
        median_hours: parseFloat(r.median_hours),
        sample_count: parseInt(r.sample_count, 10),
      });
    }

    res.json([...map.values()]);
  } catch (error) {
    console.error('Time by phase report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/tasks-detail
 * Full task list with per-phase time breakdown (up to 300 rows)
 */
export const getTasksDetail = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      WITH phase_times AS (
        SELECT
          tsh.task_id,
          SUM(CASE WHEN ts.name = 'Sin iniciar' THEN tsh.duration_seconds ELSE 0 END)::numeric AS sec_espera,
          SUM(CASE WHEN ts.name = 'En proceso'  THEN tsh.duration_seconds ELSE 0 END)::numeric AS sec_proceso,
          SUM(CASE WHEN ts.name = 'En revisión' THEN tsh.duration_seconds ELSE 0 END)::numeric AS sec_revision,
          SUM(CASE WHEN ts.name = 'Ajustes'     THEN tsh.duration_seconds ELSE 0 END)::numeric AS sec_ajustes
        FROM public.task_status_history tsh
        JOIN public.task_statuses ts ON ts.id = tsh.from_status_id
        WHERE tsh.duration_seconds IS NOT NULL AND tsh.duration_seconds > 0
        GROUP BY tsh.task_id
      ),
      ajuste_counts AS (
        SELECT tsh.task_id, COUNT(*)::int AS cnt
        FROM public.task_status_history tsh
        JOIN public.task_statuses ts ON ts.id = tsh.to_status_id
        WHERE ts.name = 'Ajustes'
        GROUP BY tsh.task_id
      )
      SELECT
        t.id,
        t.title,
        p.full_name                                                           AS assignee_name,
        p.avatar_url,
        ts_cur.name                                                           AS status_name,
        ts_cur.color                                                          AS status_color,
        ts_cur.is_completed,
        proj.name                                                             AS project_name,
        proj.key                                                              AS project_key,
        t.created_at,
        t.due_date,
        CASE WHEN ts_cur.is_completed THEN t.updated_at ELSE NULL END        AS closed_at,
        ROUND(COALESCE(pt.sec_espera,   0) / 3600.0, 2)                     AS h_espera,
        ROUND(COALESCE(pt.sec_proceso,  0) / 3600.0, 2)                     AS h_proceso,
        ROUND(COALESCE(pt.sec_revision, 0) / 3600.0, 2)                     AS h_revision,
        ROUND(COALESCE(pt.sec_ajustes,  0) / 3600.0, 2)                     AS h_ajustes,
        ROUND(COALESCE(pt.sec_espera + pt.sec_proceso + pt.sec_revision + pt.sec_ajustes, 0) / 3600.0, 2) AS h_total,
        COALESCE(ac.cnt, 0)                                                  AS devoluciones
      FROM public.tasks t
      JOIN public.task_statuses ts_cur ON ts_cur.id = t.status_id
      JOIN public.projects proj         ON proj.id   = t.project_id
      LEFT JOIN public.profiles p       ON p.id      = t.assignee_id
      LEFT JOIN phase_times pt          ON pt.task_id = t.id
      LEFT JOIN ajuste_counts ac        ON ac.task_id = t.id
      ORDER BY t.created_at DESC
      LIMIT 300
    `);

    res.json(result.rows.map(r => ({
      id:            r.id,
      title:         r.title,
      assignee_name: r.assignee_name ?? 'Sin asignar',
      avatar_url:    r.avatar_url ?? null,
      status_name:   r.status_name,
      status_color:  r.status_color,
      is_completed:  r.is_completed,
      project_name:  r.project_name,
      project_key:   r.project_key,
      created_at:    r.created_at,
      due_date:      r.due_date ?? null,
      closed_at:     r.closed_at ?? null,
      h_espera:      parseFloat(r.h_espera)   || 0,
      h_proceso:     parseFloat(r.h_proceso)  || 0,
      h_revision:    parseFloat(r.h_revision) || 0,
      h_ajustes:     parseFloat(r.h_ajustes)  || 0,
      h_total:       parseFloat(r.h_total)    || 0,
      devoluciones:  parseInt(r.devoluciones) || 0,
    })));
  } catch (error) {
    console.error('Tasks detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/ontime-by-equipo
 * On-time completion rate grouped by cargo (equipo), top 10.
 * "On time" = the task was marked completed on or before its due_date.
 */
export const getOntimeByEquipo = async (req: AuthRequest, res: Response) => {
  try {
    // Refactored onto the shared TASK_COMPLETION_CTE (same logic this function
    // already had — it was the one query on the page using a real completion event
    // instead of updated_at). Added: explicit timezone on the date comparison — the
    // server runs in UTC, so a task closed at 8pm Bogotá on its due date was
    // previously readable as late.
    const result = await query(`
      WITH ${TASK_COMPLETION_CTE}
      SELECT
        p.cargo,
        COUNT(*)::int AS total_completed,
        COUNT(*) FILTER (
          WHERE (tc.completed_at AT TIME ZONE '${REPORT_TZ}')::date <= t.due_date
        )::int AS ontime,
        ROUND(COUNT(*) FILTER (
          WHERE (tc.completed_at AT TIME ZONE '${REPORT_TZ}')::date <= t.due_date
        ) * 100.0 / NULLIF(COUNT(*), 0))::int AS pct
      FROM public.tasks t
      JOIN public.task_statuses ts ON ts.id = t.status_id AND ts.is_completed = true
      JOIN task_completion tc ON tc.task_id = t.id
      JOIN public.profiles p ON p.id = t.assignee_id
      JOIN public.users u ON u.id = p.user_id AND u.is_active = true
      WHERE t.due_date IS NOT NULL
        AND t.assignee_id IS NOT NULL
        AND p.cargo IS NOT NULL AND p.cargo <> ''
      GROUP BY p.cargo
      ORDER BY total_completed DESC
      LIMIT 10
    `);

    res.json(result.rows.map(r => ({
      cargo:           r.cargo,
      total_completed: r.total_completed,
      ontime:          r.ontime,
      pct:             r.pct ?? 0,
    })));
  } catch (error) {
    console.error('Ontime by equipo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/person-metrics
 * Per-person scorecard: on-time completion rate (the primary, reliable efficiency
 * signal), hours-weighted assigned/completed work, and a secondary, coverage-gated
 * effort-hours ratio. Query params: project_id?, date_from?, date_to?, cargo?
 * (date range scopes completion metrics only — pending/backlog state is always "now").
 */
export const getPersonMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = validUuidOrNull(req.query.project_id);
    const dateFrom = validDateOrNull(req.query.date_from);
    const dateTo = validDateOrNull(req.query.date_to);
    const cargo = typeof req.query.cargo === 'string' && req.query.cargo ? req.query.cargo : null;

    const result = await query(`
      WITH ${ASSIGNED_WORK_CTE},
      ${TASK_COMPLETION_CTE},
      ${TASK_ASSIGNEE_COUNT_CTE},
      ${EFFORT_HOURS_CTE},
      scoped_work AS (
        SELECT aw.* FROM assigned_work aw
        WHERE ($1::uuid IS NULL OR aw.project_id = $1::uuid)
      ),
      person_base AS (
        SELECT
          profile_id,
          COUNT(DISTINCT task_id) as unidades_asignadas,
          COUNT(DISTINCT task_id) FILTER (WHERE is_completed) as unidades_completadas,
          COUNT(DISTINCT task_id) FILTER (WHERE NOT is_completed) as unidades_pendientes,
          COUNT(DISTINCT task_id) FILTER (WHERE NOT is_completed AND due_date < CURRENT_DATE) as unidades_vencidas,
          COUNT(DISTINCT task_id) FILTER (WHERE horas_estimadas IS NULL) as unidades_sin_estimacion,
          COALESCE(SUM(horas_estimadas) FILTER (WHERE NOT is_completed), 0) as horas_pendientes,
          COUNT(DISTINCT project_id) as proyectos_cubiertos
        FROM scoped_work
        GROUP BY profile_id
      ),
      -- One row per (profile, task): the completion counts below must NOT join back to
      -- scoped_work directly (a task can have several material rows for the same
      -- person), or COUNT(*) fans out past the true number of distinct work units.
      dedup_work AS (
        SELECT DISTINCT profile_id, task_id, is_completed, due_date FROM scoped_work
      ),
      completed_hours AS (
        SELECT
          sw.profile_id,
          COALESCE(SUM(sw.horas_estimadas), 0) as horas_completadas
        FROM scoped_work sw
        JOIN task_completion tc ON tc.task_id = sw.task_id
        WHERE sw.is_completed
          AND ($2::date IS NULL OR tc.completed_at >= $2::date)
          AND ($3::date IS NULL OR tc.completed_at < ($3::date + INTERVAL '1 day'))
        GROUP BY sw.profile_id
      ),
      completion_scope AS (
        SELECT
          dw.profile_id,
          COUNT(*) FILTER (
            WHERE dw.is_completed AND dw.due_date IS NOT NULL AND tc.completed_at IS NOT NULL
              AND ($2::date IS NULL OR tc.completed_at >= $2::date)
              AND ($3::date IS NULL OR tc.completed_at < ($3::date + INTERVAL '1 day'))
          ) as entregas_evaluables,
          COUNT(*) FILTER (
            WHERE dw.is_completed AND dw.due_date IS NOT NULL AND tc.completed_at IS NOT NULL
              AND (tc.completed_at AT TIME ZONE '${REPORT_TZ}')::date <= dw.due_date
              AND ($2::date IS NULL OR tc.completed_at >= $2::date)
              AND ($3::date IS NULL OR tc.completed_at < ($3::date + INTERVAL '1 day'))
          ) as entregas_a_tiempo,
          COUNT(*) FILTER (
            WHERE dw.is_completed AND dw.due_date IS NOT NULL AND tc.completed_at IS NULL
          ) as sin_evento_cierre
        FROM dedup_work dw
        LEFT JOIN task_completion tc ON tc.task_id = dw.task_id
        GROUP BY dw.profile_id
      ),
      effort_scope AS (
        -- Restricted to single-assignee tasks: see TASK_ASSIGNEE_COUNT_CTE comment.
        SELECT
          dw.profile_id,
          SUM(COALESCE(eh.h_proceso, 0) + COALESCE(eh.h_ajustes, 0)) as h_efectivas,
          COUNT(*) as tareas_con_historial
        FROM dedup_work dw
        JOIN task_assignee_counts tac ON tac.task_id = dw.task_id AND tac.n_assignees = 1
        JOIN effort_hours eh ON eh.task_id = dw.task_id
        GROUP BY dw.profile_id
      )
      SELECT
        p.id, p.full_name, p.cargo, p.avatar_url, p.email,
        COALESCE(pb.unidades_asignadas, 0) as unidades_asignadas,
        COALESCE(pb.unidades_completadas, 0) as unidades_completadas,
        COALESCE(pb.unidades_pendientes, 0) as unidades_pendientes,
        COALESCE(pb.unidades_vencidas, 0) as unidades_vencidas,
        COALESCE(pb.unidades_sin_estimacion, 0) as unidades_sin_estimacion,
        COALESCE(pb.horas_pendientes, 0) as horas_pendientes,
        COALESCE(pb.proyectos_cubiertos, 0) as proyectos_cubiertos,
        COALESCE(ch.horas_completadas, 0) as horas_completadas,
        COALESCE(cs.entregas_evaluables, 0) as entregas_evaluables,
        COALESCE(cs.entregas_a_tiempo, 0) as entregas_a_tiempo,
        COALESCE(cs.sin_evento_cierre, 0) as sin_evento_cierre,
        es.h_efectivas,
        COALESCE(es.tareas_con_historial, 0) as tareas_con_historial
      FROM public.profiles p
      JOIN public.users u ON u.id = p.user_id AND u.is_active = true
      LEFT JOIN person_base pb ON pb.profile_id = p.id
      LEFT JOIN completed_hours ch ON ch.profile_id = p.id
      LEFT JOIN completion_scope cs ON cs.profile_id = p.id
      LEFT JOIN effort_scope es ON es.profile_id = p.id
      WHERE p.cargo IS NOT NULL
        AND ($4::text IS NULL OR p.cargo = $4)
      ORDER BY COALESCE(ch.horas_completadas, 0) DESC
    `, [projectId, dateFrom, dateTo, cargo]);

    const people = result.rows.map(r => {
      const entregasEvaluables = parseInt(r.entregas_evaluables);
      const entregasATiempo = parseInt(r.entregas_a_tiempo);
      const unidadesCompletadas = parseInt(r.unidades_completadas);
      const horasCompletadas = parseFloat(r.horas_completadas);
      const hEfectivas = r.h_efectivas != null ? parseFloat(r.h_efectivas) : null;
      const tareasConHistorial = parseInt(r.tareas_con_historial);
      const coberturaEsfuerzoPct = unidadesCompletadas > 0
        ? Math.round((tareasConHistorial / unidadesCompletadas) * 100)
        : 0;
      const eficienciaHorasPct = hEfectivas && hEfectivas > 0 && coberturaEsfuerzoPct >= 60
        ? Math.round((horasCompletadas / hEfectivas) * 100)
        : null;

      return {
        id: r.id,
        full_name: r.full_name,
        cargo: r.cargo,
        avatar_url: r.avatar_url,
        email: r.email,
        unidades_asignadas: parseInt(r.unidades_asignadas),
        unidades_completadas: unidadesCompletadas,
        unidades_pendientes: parseInt(r.unidades_pendientes),
        unidades_vencidas: parseInt(r.unidades_vencidas),
        unidades_sin_estimacion: parseInt(r.unidades_sin_estimacion),
        horas_pendientes: Math.round(parseFloat(r.horas_pendientes) * 100) / 100,
        horas_completadas: Math.round(horasCompletadas * 100) / 100,
        proyectos_cubiertos: parseInt(r.proyectos_cubiertos),
        entregas_evaluables: entregasEvaluables,
        entregas_a_tiempo: entregasATiempo,
        sin_evento_cierre: parseInt(r.sin_evento_cierre),
        puntualidad_pct: entregasEvaluables > 0 ? Math.round((entregasATiempo / entregasEvaluables) * 100) : null,
        cobertura_esfuerzo_pct: coberturaEsfuerzoPct,
        eficiencia_horas_pct: eficienciaHorasPct,
      };
    });

    const overallEvaluables = people.reduce((sum, p) => sum + p.entregas_evaluables, 0);
    const overallATiempo = people.reduce((sum, p) => sum + p.entregas_a_tiempo, 0);

    res.json({
      people,
      overall: {
        entregas_evaluables: overallEvaluables,
        entregas_a_tiempo: overallATiempo,
        puntualidad_pct: overallEvaluables > 0 ? Math.round((overallATiempo / overallEvaluables) * 100) : null,
      },
    });
  } catch (error) {
    console.error('Person metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/capacity-forecast
 * Per-person capacity: real, time-bounded current-week utilization (not the entire
 * backlog divided by one week) plus a forward N-week projection so a leader can see
 * who has room for new work before it's assigned. Query params: weeks? (1-12, default
 * 4), project_id?, cargo?
 */
export const getCapacityForecast = async (req: AuthRequest, res: Response) => {
  try {
    const weeksParam = parseInt(String(req.query.weeks ?? '4'), 10);
    const weeks = Number.isFinite(weeksParam) ? Math.min(12, Math.max(1, weeksParam)) : 4;
    const projectId = validUuidOrNull(req.query.project_id);
    const cargo = typeof req.query.cargo === 'string' && req.query.cargo ? req.query.cargo : null;

    const result = await query(`
      WITH ${ASSIGNED_WORK_CTE},
      scoped_work AS (
        SELECT * FROM assigned_work
        WHERE ($1::uuid IS NULL OR project_id = $1::uuid) AND profile_id IS NOT NULL
      ),
      -- Global stand-in for tasks with no hour estimate: the average of every
      -- task IN THIS SAME SCOPE that already has one. Used only to compute an
      -- approximate utilization % below -- never written back onto a task,
      -- and always shown alongside the real (unassumed) numbers, never in
      -- place of them.
      avg_estimate AS (
        SELECT COALESCE(AVG(horas_estimadas), 0) AS avg_horas
        FROM scoped_work
        WHERE horas_estimadas IS NOT NULL
      ),
      current_week AS (
        SELECT
          profile_id,
          COALESCE(SUM(horas_estimadas) FILTER (
            WHERE NOT is_completed AND due_date < date_trunc('week', CURRENT_DATE)
          ), 0) as horas_vencidas,
          COALESCE(SUM(horas_estimadas) FILTER (
            WHERE NOT is_completed
              AND due_date >= date_trunc('week', CURRENT_DATE)
              AND due_date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
          ), 0) as horas_semana_actual,
          COALESCE(SUM(horas_estimadas) FILTER (WHERE NOT is_completed), 0) as horas_backlog_total,
          COALESCE(SUM(horas_estimadas) FILTER (WHERE NOT is_completed AND due_date IS NULL), 0) as horas_sin_fecha,
          COUNT(DISTINCT task_id) FILTER (WHERE NOT is_completed AND horas_estimadas IS NULL) as unidades_sin_estimacion,
          -- Active tasks already due (overdue or due this week) with NO hour
          -- estimate -- these contribute 0 to carga_semana_actual even though
          -- they're real, active commitments, which is what makes a "0%
          -- utilización" headline misleading when it's really "sin datos".
          COUNT(DISTINCT task_id) FILTER (
            WHERE NOT is_completed AND horas_estimadas IS NULL
              AND due_date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
          ) as unidades_semana_actual_sin_estimacion,
          -- Same "current commitment" window as horas_vencidas + horas_semana_actual
          -- combined, but substituting avg_estimate.avg_horas for any task missing
          -- an hour value, so tasks with no estimate still count for SOMETHING.
          COALESCE(SUM(COALESCE(horas_estimadas, (SELECT avg_horas FROM avg_estimate))) FILTER (
            WHERE NOT is_completed AND due_date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
          ), 0) as carga_semana_actual_aprox
        FROM scoped_work
        GROUP BY profile_id
      ),
      week_series AS (
        SELECT gs AS week_offset FROM generate_series(1, $2::int) AS gs
      ),
      relevant_profiles AS (
        SELECT p.id AS profile_id
        FROM public.profiles p
        JOIN public.users u ON u.id = p.user_id AND u.is_active = true
        WHERE p.cargo IS NOT NULL AND ($3::text IS NULL OR p.cargo = $3)
      ),
      forward AS (
        SELECT
          rp.profile_id,
          wk.week_offset,
          (date_trunc('week', CURRENT_DATE) + (wk.week_offset * 7) * INTERVAL '1 day')::date AS week_start,
          COALESCE(SUM(sw.horas_estimadas) FILTER (
            WHERE NOT sw.is_completed
              AND sw.due_date >= date_trunc('week', CURRENT_DATE) + (wk.week_offset * 7) * INTERVAL '1 day'
              AND sw.due_date <  date_trunc('week', CURRENT_DATE) + ((wk.week_offset + 1) * 7) * INTERVAL '1 day'
          ), 0) AS horas
        FROM relevant_profiles rp
        CROSS JOIN week_series wk
        LEFT JOIN scoped_work sw ON sw.profile_id = rp.profile_id
        GROUP BY rp.profile_id, wk.week_offset
      )
      SELECT
        p.id, p.full_name, p.cargo, p.avatar_url,
        COALESCE(p.weekly_hours_capacity, ${WORK_SCHEDULE.WEEKLY_HOURS}) as weekly_hours_capacity,
        COALESCE(cw.horas_vencidas, 0) as horas_vencidas,
        COALESCE(cw.horas_semana_actual, 0) as horas_semana_actual,
        COALESCE(cw.horas_backlog_total, 0) as horas_backlog_total,
        COALESCE(cw.horas_sin_fecha, 0) as horas_sin_fecha,
        COALESCE(cw.unidades_sin_estimacion, 0) as unidades_sin_estimacion,
        COALESCE(cw.unidades_semana_actual_sin_estimacion, 0) as unidades_semana_actual_sin_estimacion,
        COALESCE(cw.carga_semana_actual_aprox, 0) as carga_semana_actual_aprox,
        COALESCE(
          (SELECT json_agg(json_build_object('week_start', f.week_start, 'horas', f.horas) ORDER BY f.week_offset)
           FROM forward f WHERE f.profile_id = p.id),
          '[]'::json
        ) as weeks
      FROM relevant_profiles rp
      JOIN public.profiles p ON p.id = rp.profile_id
      LEFT JOIN current_week cw ON cw.profile_id = p.id
      ORDER BY (COALESCE(cw.horas_vencidas, 0) + COALESCE(cw.horas_semana_actual, 0)) DESC
    `, [projectId, weeks, cargo]);

    const avgEstimateResult = await query(`
      WITH ${ASSIGNED_WORK_CTE},
      scoped_work AS (
        SELECT * FROM assigned_work
        WHERE ($1::uuid IS NULL OR project_id = $1::uuid) AND profile_id IS NOT NULL
      )
      SELECT COALESCE(AVG(horas_estimadas), 0) AS avg_horas
      FROM scoped_work
      WHERE horas_estimadas IS NOT NULL
    `, [projectId]);
    const avgHorasAsumidas = Math.round(parseFloat(avgEstimateResult.rows[0]?.avg_horas ?? 0) * 100) / 100;

    const members = result.rows.map(r => {
      const weeklyCapacity = parseFloat(r.weekly_hours_capacity);
      const horasVencidas = parseFloat(r.horas_vencidas);
      const horasSemanaActual = parseFloat(r.horas_semana_actual);
      const horasBacklogTotal = parseFloat(r.horas_backlog_total);
      const cargaSemanaActual = horasVencidas + horasSemanaActual;
      const memberDaily = weeklyCapacity > 0 ? weeklyCapacity / 5 : WORK_SCHEDULE.AVG_DAILY_HOURS;

      const estimatedWorkDays = horasBacklogTotal > 0 && memberDaily > 0
        ? Math.round((horasBacklogTotal / memberDaily) * 10) / 10
        : 0;
      const estimatedCompletionDate = estimatedWorkDays > 0
        ? addBusinessDays(new Date(), estimatedWorkDays).toISOString().split('T')[0]
        : null;

      const currentUtilizationPct = weeklyCapacity > 0 ? Math.round((cargaSemanaActual / weeklyCapacity) * 100) : 0;
      const currentBand = riskBand(currentUtilizationPct);

      const cargaSemanaActualAprox = parseFloat(r.carga_semana_actual_aprox);
      const aproxUtilizationPct = weeklyCapacity > 0 ? Math.round((cargaSemanaActualAprox / weeklyCapacity) * 100) : 0;

      const weeksData = (r.weeks as Array<{ week_start: string; horas: string | number }>).map((w) => {
        const horas = typeof w.horas === 'string' ? parseFloat(w.horas) : w.horas;
        const utilizationPct = weeklyCapacity > 0 ? Math.round((horas / weeklyCapacity) * 100) : 0;
        const band = riskBand(utilizationPct, true);
        return {
          week_start: w.week_start,
          horas: Math.round(horas * 100) / 100,
          utilizacion_pct: utilizationPct,
          holgura_horas: Math.round((weeklyCapacity - horas) * 100) / 100,
          risk_level: band.level,
          risk_label: band.label,
          risk_color: band.color,
        };
      });

      return {
        id: r.id,
        full_name: r.full_name,
        cargo: r.cargo,
        avatar_url: r.avatar_url,
        weekly_hours_capacity: Math.round(weeklyCapacity * 100) / 100,
        current: {
          horas_vencidas: Math.round(horasVencidas * 100) / 100,
          horas_semana_actual: Math.round(horasSemanaActual * 100) / 100,
          carga_semana_actual: Math.round(cargaSemanaActual * 100) / 100,
          utilizacion_pct: currentUtilizationPct,
          holgura_horas: Math.round((weeklyCapacity - cargaSemanaActual) * 100) / 100,
          risk_level: currentBand.level,
          risk_label: currentBand.label,
          risk_color: currentBand.color,
          unidades_semana_actual_sin_estimacion: parseInt(r.unidades_semana_actual_sin_estimacion),
          carga_semana_actual_aprox: Math.round(cargaSemanaActualAprox * 100) / 100,
          utilizacion_aprox_pct: aproxUtilizationPct,
          holgura_aprox_horas: Math.round((weeklyCapacity - cargaSemanaActualAprox) * 100) / 100,
        },
        weeks: weeksData,
        backlog: {
          horas_total: Math.round(horasBacklogTotal * 100) / 100,
          horas_sin_fecha: Math.round(parseFloat(r.horas_sin_fecha) * 100) / 100,
          unidades_sin_estimacion: parseInt(r.unidades_sin_estimacion),
          dias_para_vaciar: estimatedWorkDays,
          fecha_backlog_vacio: estimatedCompletionDate,
        },
      };
    });

    const overallCarga = members.reduce((sum, m) => sum + m.current.carga_semana_actual, 0);
    const overallCargaAprox = members.reduce((sum, m) => sum + m.current.carga_semana_actual_aprox, 0);
    const overallCapacidad = members.reduce((sum, m) => sum + m.weekly_hours_capacity, 0);
    const overallUnidadesSinEstimacion = members.reduce((sum, m) => sum + m.current.unidades_semana_actual_sin_estimacion, 0);
    const riskCounts = { available: 0, ok: 0, warning: 0, over: 0 };
    for (const m of members) riskCounts[m.current.risk_level]++;

    res.json({
      schedule: {
        mon_thu_hours: WORK_SCHEDULE.MON_THU_HOURS,
        friday_hours: WORK_SCHEDULE.FRIDAY_HOURS,
        weekly_hours: WORK_SCHEDULE.WEEKLY_HOURS,
        avg_daily_hours: Math.round(WORK_SCHEDULE.AVG_DAILY_HOURS * 100) / 100,
      },
      members,
      overall: {
        carga_semana_actual: Math.round(overallCarga * 100) / 100,
        capacidad_total: Math.round(overallCapacidad * 100) / 100,
        utilizacion_pct: overallCapacidad > 0 ? Math.round((overallCarga / overallCapacidad) * 100) : 0,
        holgura_horas: Math.round((overallCapacidad - overallCarga) * 100) / 100,
        risk_counts: riskCounts,
        unidades_semana_actual_sin_estimacion: overallUnidadesSinEstimacion,
        carga_semana_actual_aprox: Math.round(overallCargaAprox * 100) / 100,
        utilizacion_aprox_pct: overallCapacidad > 0 ? Math.round((overallCargaAprox / overallCapacidad) * 100) : 0,
        holgura_aprox_horas: Math.round((overallCapacidad - overallCargaAprox) * 100) / 100,
        avg_horas_asumidas: avgHorasAsumidas,
      },
    });
  } catch (error) {
    console.error('Capacity forecast error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/throughput
 * Hours-weighted completed work per period, by person or by cargo — replaces the raw
 * task-count "productividad" charts elsewhere on the page (ten trivial materials no
 * longer outrank two complex ones). Query params: bucket? (day|week|month, default
 * week), group_by? (person|cargo, default person), date_from?, date_to?, project_id?
 */
export const getThroughput = async (req: AuthRequest, res: Response) => {
  try {
    const bucket = assertEnum(req.query.bucket, ['day', 'week', 'month'] as const, 'week');
    const groupBy = assertEnum(req.query.group_by, ['person', 'cargo'] as const, 'person');
    const projectId = validUuidOrNull(req.query.project_id);
    const dateFrom = validDateOrNull(req.query.date_from);
    const dateTo = validDateOrNull(req.query.date_to);

    const groupExpr = groupBy === 'cargo' ? `COALESCE(cargo, 'Sin cargo')` : `profile_id::text`;
    const labelExpr = groupBy === 'cargo' ? `COALESCE(cargo, 'Sin cargo')` : `MAX(full_name)`;
    const avatarExpr = groupBy === 'cargo' ? `NULL::text` : `MAX(avatar_url)`;

    const result = await query(`
      WITH ${ASSIGNED_WORK_CTE},
      ${TASK_COMPLETION_CTE},
      scoped_work AS (
        SELECT aw.*, p.full_name, p.avatar_url, p.cargo
        FROM assigned_work aw
        JOIN public.profiles p ON p.id = aw.profile_id
        JOIN public.users u ON u.id = p.user_id AND u.is_active = true
        WHERE ($1::uuid IS NULL OR aw.project_id = $1::uuid) AND aw.profile_id IS NOT NULL
      ),
      completed_rows AS (
        SELECT sw.*, tc.completed_at
        FROM scoped_work sw
        JOIN task_completion tc ON tc.task_id = sw.task_id
        WHERE sw.is_completed
          AND ($2::date IS NULL OR tc.completed_at >= $2::date)
          AND ($3::date IS NULL OR tc.completed_at < ($3::date + INTERVAL '1 day'))
      )
      SELECT
        ${groupExpr} as key,
        ${labelExpr} as label,
        ${avatarExpr} as avatar_url,
        date_trunc('${bucket}', completed_at AT TIME ZONE '${REPORT_TZ}')::date as bucket_start,
        COUNT(*) as unidades,
        COALESCE(SUM(horas_estimadas), 0) as horas,
        COUNT(*) FILTER (WHERE horas_estimadas IS NULL) as unidades_sin_estimacion
      FROM completed_rows
      GROUP BY ${groupExpr}, bucket_start
      ORDER BY bucket_start ASC, horas DESC
    `, [projectId, dateFrom, dateTo]);

    res.json(result.rows.map(r => ({
      key: r.key,
      label: r.label,
      avatar_url: r.avatar_url,
      bucket_start: r.bucket_start,
      unidades: parseInt(r.unidades),
      horas: Math.round(parseFloat(r.horas) * 100) / 100,
      unidades_sin_estimacion: parseInt(r.unidades_sin_estimacion),
    })));
  } catch (error) {
    console.error('Throughput error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/production-by-person
 * Person × material-type cross-tab ("who produced what") — Producción has zero
 * per-person data today. Query params: project_id?, date_from?, date_to?
 */
export const getProductionByPerson = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = validUuidOrNull(req.query.project_id);
    const dateFrom = validDateOrNull(req.query.date_from);
    const dateTo = validDateOrNull(req.query.date_to);

    const result = await query(`
      WITH ${ASSIGNED_WORK_CTE},
      ${TASK_COMPLETION_CTE},
      scoped_work AS (
        SELECT aw.*, p.full_name, p.avatar_url, p.cargo, mr.material_type_id
        FROM assigned_work aw
        JOIN public.profiles p ON p.id = aw.profile_id
        JOIN public.users u ON u.id = p.user_id AND u.is_active = true
        LEFT JOIN public.materiales_requeridos mr ON mr.id = aw.material_id
        WHERE ($1::uuid IS NULL OR aw.project_id = $1::uuid)
          AND aw.profile_id IS NOT NULL
          AND aw.material_id IS NOT NULL
      ),
      scoped_completion AS (
        SELECT sw.*, tc.completed_at
        FROM scoped_work sw
        LEFT JOIN task_completion tc ON tc.task_id = sw.task_id
      )
      SELECT
        sc.profile_id, sc.full_name, sc.cargo, sc.avatar_url, sc.material_type_id,
        mt.name as material_type_name, mt.icon,
        COUNT(*) FILTER (
          WHERE sc.is_completed
            AND ($2::date IS NULL OR sc.completed_at >= $2::date)
            AND ($3::date IS NULL OR sc.completed_at < ($3::date + INTERVAL '1 day'))
        ) as unidades_completadas,
        COALESCE(SUM(sc.horas_estimadas) FILTER (
          WHERE sc.is_completed
            AND ($2::date IS NULL OR sc.completed_at >= $2::date)
            AND ($3::date IS NULL OR sc.completed_at < ($3::date + INTERVAL '1 day'))
        ), 0) as horas_completadas,
        COUNT(*) FILTER (WHERE NOT sc.is_completed) as unidades_en_proceso,
        COALESCE(SUM(sc.horas_estimadas) FILTER (WHERE NOT sc.is_completed), 0) as horas_pendientes
      FROM scoped_completion sc
      JOIN public.material_types mt ON mt.id = sc.material_type_id
      GROUP BY sc.profile_id, sc.full_name, sc.cargo, sc.avatar_url, sc.material_type_id, mt.name, mt.icon
      ORDER BY horas_completadas DESC
    `, [projectId, dateFrom, dateTo]);

    const rows = result.rows.map(r => ({
      profile_id: r.profile_id,
      full_name: r.full_name,
      cargo: r.cargo,
      avatar_url: r.avatar_url,
      material_type_id: r.material_type_id,
      material_type_name: r.material_type_name,
      icon: r.icon,
      unidades_completadas: parseInt(r.unidades_completadas),
      horas_completadas: Math.round(parseFloat(r.horas_completadas) * 100) / 100,
      unidades_en_proceso: parseInt(r.unidades_en_proceso),
      horas_pendientes: Math.round(parseFloat(r.horas_pendientes) * 100) / 100,
    }));

    const totalsByPersonMap = new Map<string, { profile_id: string; full_name: string; cargo: string | null; avatar_url: string | null; horas_completadas: number; unidades_completadas: number }>();
    const totalsByTypeMap = new Map<string, { material_type_id: string; material_type_name: string; icon: string | null; horas_completadas: number; unidades_completadas: number }>();

    for (const row of rows) {
      const person = totalsByPersonMap.get(row.profile_id) ?? {
        profile_id: row.profile_id, full_name: row.full_name, cargo: row.cargo, avatar_url: row.avatar_url,
        horas_completadas: 0, unidades_completadas: 0,
      };
      person.horas_completadas += row.horas_completadas;
      person.unidades_completadas += row.unidades_completadas;
      totalsByPersonMap.set(row.profile_id, person);

      const type = totalsByTypeMap.get(row.material_type_id) ?? {
        material_type_id: row.material_type_id, material_type_name: row.material_type_name, icon: row.icon,
        horas_completadas: 0, unidades_completadas: 0,
      };
      type.horas_completadas += row.horas_completadas;
      type.unidades_completadas += row.unidades_completadas;
      totalsByTypeMap.set(row.material_type_id, type);
    }

    res.json({
      rows,
      totals_by_person: Array.from(totalsByPersonMap.values())
        .map(p => ({ ...p, horas_completadas: Math.round(p.horas_completadas * 100) / 100 }))
        .sort((a, b) => b.horas_completadas - a.horas_completadas),
      totals_by_type: Array.from(totalsByTypeMap.values())
        .map(t => ({ ...t, horas_completadas: Math.round(t.horas_completadas * 100) / 100 }))
        .sort((a, b) => b.horas_completadas - a.horas_completadas),
    });
  } catch (error) {
    console.error('Production by person error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

