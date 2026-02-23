import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

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

      // Materials: total required vs completed
      query(`
        SELECT
          COUNT(mr.id) as total_materials,
          COUNT(DISTINCT t.material_requerido_id) FILTER (WHERE ts.is_completed = true) as completed_materials
        FROM public.materiales_requeridos mr
        LEFT JOIN public.tasks t ON t.material_requerido_id = mr.id
        LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
      `),

      // Active team members
      query(`SELECT COUNT(DISTINCT pm.user_id) as count FROM public.project_members pm`),

      // Avg completion time (seconds) for finished tasks
      query(`
        SELECT COALESCE(AVG(total_seconds), 0) as avg_seconds
        FROM (
          SELECT tsh.task_id, SUM(tsh.duration_seconds) as total_seconds
          FROM public.task_status_history tsh
          JOIN public.task_statuses ts ON ts.id = tsh.to_status_id
          WHERE ts.name = 'Finalizado' AND tsh.duration_seconds IS NOT NULL
          GROUP BY tsh.task_id
        ) sub
      `),

      // Recently completed tasks (last 30 days)
      query(`
        SELECT COUNT(DISTINCT t.id) as count
        FROM public.tasks t
        JOIN public.task_statuses ts ON ts.id = t.status_id
        WHERE ts.is_completed = true
          AND t.updated_at >= NOW() - INTERVAL '30 days'
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
 * GET /api/reports/team-performance
 * Per-collaborator metrics: tasks, materials, estimated/actual hours
 */
export const getTeamPerformance = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT
        p.id, p.full_name, p.cargo, p.avatar_url, p.email,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = true) as completed_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'En proceso') as in_progress_tasks,
        COUNT(DISTINCT tma.id) as materials_assigned,
        COALESCE(SUM(DISTINCT tma.horas_estimadas), 0) as total_horas_estimadas,
        COALESCE(actual.total_actual_hours, 0) as total_horas_reales
      FROM public.profiles p
      LEFT JOIN public.tasks t ON t.assignee_id = p.id
      LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
      LEFT JOIN public.task_material_assignees tma ON tma.assignee_id = p.id
      LEFT JOIN (
        SELECT t2.assignee_id,
          ROUND(SUM(tsh.duration_seconds)::numeric / 3600.0, 2) as total_actual_hours
        FROM public.task_status_history tsh
        JOIN public.tasks t2 ON t2.id = tsh.task_id
        WHERE tsh.duration_seconds IS NOT NULL
        GROUP BY t2.assignee_id
      ) actual ON actual.assignee_id = p.id
      GROUP BY p.id, p.full_name, p.cargo, p.avatar_url, p.email, actual.total_actual_hours
      HAVING COUNT(DISTINCT t.id) > 0 OR COUNT(DISTINCT tma.id) > 0
      ORDER BY COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = true) DESC
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
    const result = await query(`
      SELECT
        mt.id, mt.name, mt.icon, mt.display_order,
        COUNT(mr.id) as total_required,
        COALESCE(SUM(mr.cantidad), 0) as total_quantity,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = true) as completed_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE NOT ts.is_completed AND t.id IS NOT NULL) as in_progress_tasks
      FROM public.material_types mt
      LEFT JOIN public.materiales_requeridos mr ON mr.material_type_id = mt.id
      LEFT JOIN public.tasks t ON t.material_requerido_id = mr.id
      LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
      GROUP BY mt.id
      ORDER BY COUNT(mr.id) DESC
    `);

    const materials = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      display_order: r.display_order,
      total_required: parseInt(r.total_required),
      total_quantity: parseInt(r.total_quantity),
      completed_tasks: parseInt(r.completed_tasks),
      in_progress_tasks: parseInt(r.in_progress_tasks),
      completion_rate: parseInt(r.total_required) > 0
        ? Math.round((parseInt(r.completed_tasks) / parseInt(r.total_required)) * 100)
        : 0,
    }));

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
    const result = await query(`
      SELECT
        ts.name as status_name,
        ts.color,
        ts.display_order,
        ARRAY_AGG(tsh.duration_seconds ORDER BY tsh.duration_seconds)
          FILTER (WHERE tsh.duration_seconds IS NOT NULL AND tsh.duration_seconds > 0) as durations
      FROM public.task_status_history tsh
      JOIN public.task_statuses ts ON ts.id = tsh.from_status_id
      WHERE tsh.duration_seconds IS NOT NULL AND tsh.duration_seconds > 0
      GROUP BY ts.id, ts.name, ts.color, ts.display_order
      ORDER BY ts.display_order
    `);

    const distribution = result.rows.map(r => {
      const durations = r.durations || [];
      const hoursArray = durations.map((d: number) => d / 3600);

      // Compute stats
      const sorted = [...hoursArray].sort((a: number, b: number) => a - b);
      const len = sorted.length;
      const median = len > 0 ? sorted[Math.floor(len / 2)] : 0;
      const q1 = len > 0 ? sorted[Math.floor(len * 0.25)] : 0;
      const q3 = len > 0 ? sorted[Math.floor(len * 0.75)] : 0;
      const mean = len > 0 ? sorted.reduce((a: number, b: number) => a + b, 0) / len : 0;
      const min = len > 0 ? sorted[0] : 0;
      const max = len > 0 ? sorted[len - 1] : 0;

      return {
        status_name: r.status_name,
        color: r.color,
        display_order: r.display_order,
        count: len,
        durations_hours: hoursArray,
        stats: {
          min: Math.round(min * 100) / 100,
          q1: Math.round(q1 * 100) / 100,
          median: Math.round(median * 100) / 100,
          q3: Math.round(q3 * 100) / 100,
          max: Math.round(max * 100) / 100,
          mean: Math.round(mean * 100) / 100,
        },
      };
    });

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
    // Work schedule constants
    const MON_THU_HOURS = 8.25; // 10h - 1h lunch - 0.75h break
    const FRIDAY_HOURS = 7.25;  // 9h - 1h lunch - 0.75h break
    const WEEKLY_HOURS = MON_THU_HOURS * 4 + FRIDAY_HOURS; // 40.25
    const AVG_DAILY_HOURS = WEEKLY_HOURS / 5; // 8.05

    const result = await query(`
      WITH user_task_hours AS (
        SELECT
          t.id as task_id,
          t.assignee_id,
          t.title,
          ts.name as status_name,
          ts.is_completed,
          tma.horas_estimadas
        FROM public.tasks t
        JOIN public.task_statuses ts ON ts.id = t.status_id
        LEFT JOIN public.task_material_assignees tma
          ON tma.task_id = t.parent_task_id
          AND tma.assignee_id = t.assignee_id
          AND tma.material_id = t.material_requerido_id
        WHERE t.assignee_id IS NOT NULL
      )
      SELECT
        p.id, p.full_name, p.cargo, p.avatar_url,
        COALESCE(p.weekly_hours_capacity, 40.25) AS weekly_hours_capacity,
        COUNT(DISTINCT uth.task_id) FILTER (WHERE NOT uth.is_completed) as pending_tasks,
        COUNT(DISTINCT uth.task_id) FILTER (WHERE uth.is_completed) as completed_tasks,
        COUNT(DISTINCT uth.task_id) FILTER (WHERE NOT uth.is_completed AND uth.horas_estimadas IS NULL) as tasks_sin_estimacion,
        COALESCE(SUM(uth.horas_estimadas) FILTER (WHERE NOT uth.is_completed), 0) as pending_horas,
        COALESCE(SUM(uth.horas_estimadas) FILTER (WHERE uth.is_completed), 0) as completed_horas
      FROM public.profiles p
      JOIN user_task_hours uth ON uth.assignee_id = p.id
      GROUP BY p.id
      ORDER BY COALESCE(SUM(uth.horas_estimadas) FILTER (WHERE NOT uth.is_completed), 0) DESC
    `);

    const members = result.rows.map(r => {
      const pendingHoras = parseFloat(r.pending_horas);
      const memberWeekly =
        r.weekly_hours_capacity != null && !Number.isNaN(Number(r.weekly_hours_capacity))
          ? parseFloat(String(r.weekly_hours_capacity))
          : WEEKLY_HOURS;
      const memberDaily = memberWeekly > 0 ? memberWeekly / 5 : AVG_DAILY_HOURS;

      const estimatedWorkDays =
        pendingHoras > 0 && memberDaily > 0 ? Math.round((pendingHoras / memberDaily) * 10) / 10 : 0;

      // Calculate calendar completion date skipping weekends
      let estimatedCompletionDate: string | null = null;
      if (estimatedWorkDays > 0) {
        const today = new Date();
        let remaining = Math.ceil(estimatedWorkDays);
        const current = new Date(today);
        while (remaining > 0) {
          current.setDate(current.getDate() + 1);
          const dow = current.getDay();
          if (dow !== 0 && dow !== 6) {
            remaining--;
          }
        }
        estimatedCompletionDate = current.toISOString().split('T')[0];
      }

      const utilizationPct =
        memberWeekly > 0 ? Math.round((pendingHoras / memberWeekly) * 100) : 0;

      let capacityGapHours = 0;
      let riskLevel: 'ok' | 'warning' | 'over' = 'ok';
      let riskLabel = 'OK';
      let riskColor: 'emerald' | 'amber' | 'red' = 'emerald';

      if (memberWeekly > 0) {
        capacityGapHours = Math.round((pendingHoras - memberWeekly) * 100) / 100;

        if (utilizationPct >= 100) {
          riskLevel = 'over';
          riskLabel = 'SOBRECARGADO';
          riskColor = 'red';
        } else if (utilizationPct >= 90) {
          riskLevel = 'warning';
          riskLabel = 'RIESGO';
          riskColor = 'amber';
        }
      }

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
        estimated_work_days: estimatedWorkDays,
        estimated_completion_date: estimatedCompletionDate,
        utilization_pct: utilizationPct,
        capacity_gap_hours: capacityGapHours,
        risk_level: riskLevel,
        risk_label: riskLabel,
        risk_color: riskColor,
      };
    });

    res.json({
      schedule: {
        mon_thu_hours: MON_THU_HOURS,
        friday_hours: FRIDAY_HOURS,
        weekly_hours: WEEKLY_HOURS,
        weekly_hours_default: WEEKLY_HOURS,
        avg_daily_hours: Math.round(AVG_DAILY_HOURS * 100) / 100,
      },
      members,
    });
  } catch (error) {
    console.error('Team capacity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getWorkloadByCargo = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT
        COALESCE(p.cargo, 'Sin cargo') as cargo,
        COUNT(DISTINCT p.id) as team_count,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = true) as completed_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE NOT ts.is_completed AND t.id IS NOT NULL) as pending_tasks,
        COALESCE(SUM(DISTINCT tma.horas_estimadas), 0) as total_horas_estimadas
      FROM public.profiles p
      LEFT JOIN public.tasks t ON t.assignee_id = p.id
      LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
      LEFT JOIN public.task_material_assignees tma ON tma.assignee_id = p.id
      GROUP BY COALESCE(p.cargo, 'Sin cargo')
      HAVING COUNT(DISTINCT t.id) > 0
      ORDER BY COUNT(DISTINCT t.id) DESC
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
