import { query } from '../config/database.js';
import { env } from '../config/env.js';
import { generateChatAnswer } from './llmService.js';

export interface ChatUserContext {
  id: string;
  profileId?: string;
  email: string;
  role?: string;
}

export interface ChatResult {
  intent: string;
  answer: string;
}

async function getMyTasksSummary(profileId: string) {
  const result = await query(
    `WITH my_task_ids AS (
       SELECT t.id AS task_id
       FROM public.tasks t
       WHERE t.assignee_id = $1
       UNION
       SELECT tta.task_id
       FROM public.task_tema_assignees tta
       WHERE tta.assignee_id = $1
       UNION
       SELECT tma.task_id
       FROM public.task_material_assignees tma
       WHERE tma.assignee_id = $1
     )
     SELECT
       COUNT(*)                                                                              AS total,
       COUNT(*) FILTER (WHERE ts.name = 'Pendiente'   AND NOT ts.is_completed)              AS sin_iniciar,
       COUNT(*) FILTER (WHERE ts.name = 'En proceso'  AND NOT ts.is_completed)              AS en_proceso,
       COUNT(*) FILTER (WHERE ts.name = 'En revisión' AND NOT ts.is_completed)              AS en_revision,
       COUNT(*) FILTER (WHERE ts.name = 'Ajustes'     AND NOT ts.is_completed)              AS ajustes,
       COUNT(*) FILTER (WHERE ts.is_completed)                                               AS completadas,
       COUNT(*) FILTER (WHERE NOT ts.is_completed AND t.due_date < CURRENT_DATE)            AS overdue,
       COUNT(*) FILTER (WHERE NOT ts.is_completed AND t.due_date = CURRENT_DATE)            AS due_today,
       COUNT(*) FILTER (WHERE NOT ts.is_completed AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') AS due_week
     FROM my_task_ids mi
     JOIN public.tasks t ON t.id = mi.task_id
     JOIN public.task_statuses ts ON ts.id = t.status_id`,
    [profileId],
  );

  return result.rows[0];
}

async function getMyTasksDetail(profileId: string) {
  const result = await query(
    `WITH my_task_ids AS (
       SELECT t.id AS task_id
       FROM public.tasks t
       WHERE t.assignee_id = $1
       UNION
       SELECT tta.task_id FROM public.task_tema_assignees tta WHERE tta.assignee_id = $1
       UNION
       SELECT tma.task_id FROM public.task_material_assignees tma WHERE tma.assignee_id = $1
     )
     SELECT
       t.id,
       t.title,
       t.due_date,
       t.priority,
       ts.name AS status,
       ts.is_completed,
       pr.name AS project_name
     FROM my_task_ids mi
     JOIN public.tasks t ON t.id = mi.task_id
     JOIN public.task_statuses ts ON ts.id = t.status_id
     JOIN public.projects pr ON pr.id = t.project_id
     WHERE NOT ts.is_completed
     ORDER BY
       CASE WHEN t.due_date < CURRENT_DATE THEN 0 ELSE 1 END ASC,
       CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC,
       t.due_date ASC NULLS LAST
     LIMIT 10`,
    [profileId],
  );
  return result.rows;
}

async function getUserWorkload(profileId: string) {
  const result = await query(
    `WITH my_task_ids AS (
       SELECT t.id AS task_id
       FROM public.tasks t WHERE t.assignee_id = $1
       UNION
       SELECT tta.task_id FROM public.task_tema_assignees tta WHERE tta.assignee_id = $1
       UNION
       SELECT tma.task_id FROM public.task_material_assignees tma WHERE tma.assignee_id = $1
     )
     SELECT
       p.full_name,
       p.cargo,
       COALESCE(p.weekly_hours_capacity, 40.25) AS weekly_capacity,
       COALESCE(SUM(tma.horas_estimadas) FILTER (WHERE NOT ts.is_completed), 0) AS horas_pendientes,
       COALESCE(SUM(tma.horas_estimadas) FILTER (WHERE ts.is_completed), 0)     AS horas_completadas,
       COUNT(DISTINCT mi.task_id) FILTER (WHERE NOT ts.is_completed)            AS tareas_pendientes,
       COUNT(DISTINCT mi.task_id) FILTER (WHERE ts.is_completed)                AS tareas_completadas
     FROM my_task_ids mi
     JOIN public.tasks t ON t.id = mi.task_id
     JOIN public.task_statuses ts ON ts.id = t.status_id
     LEFT JOIN public.task_material_assignees tma
       ON tma.task_id = t.parent_task_id
       AND tma.assignee_id = $1
       AND tma.material_id = t.material_requerido_id
     JOIN public.profiles p ON p.id = $1
     GROUP BY p.full_name, p.cargo, p.weekly_hours_capacity`,
    [profileId],
  );
  return result.rows[0] ?? null;
}

async function getProjectDetail(profileId: string, role: string, projectName: string) {
  // Búsqueda fuzzy por nombre de proyecto
  let sql: string;
  let params: unknown[];

  const baseSelect = `
    SELECT
      pr.id,
      pr.name,
      pr.key,
      pr.status,
      pr.start_date,
      pr.end_date,
      COUNT(t.id)                                                                AS total_tasks,
      COUNT(t.id) FILTER (WHERE ts.is_completed)                                AS completed_tasks,
      COUNT(t.id) FILTER (WHERE NOT ts.is_completed)                            AS pending_tasks,
      COUNT(t.id) FILTER (WHERE NOT ts.is_completed AND t.due_date < CURRENT_DATE) AS overdue_tasks,
      COUNT(t.id) FILTER (WHERE ts.name = 'Pendiente')                          AS sin_iniciar,
      COUNT(t.id) FILTER (WHERE ts.name = 'En proceso')                         AS en_proceso,
      COUNT(t.id) FILTER (WHERE ts.name = 'En revisión')                        AS en_revision,
      COUNT(t.id) FILTER (WHERE ts.name = 'Ajustes')                            AS ajustes
    FROM public.projects pr
    LEFT JOIN public.tasks t ON t.project_id = pr.id
    LEFT JOIN public.task_statuses ts ON ts.id = t.status_id`;

  if (role === 'admin') {
    sql = `${baseSelect} WHERE pr.name ILIKE $1 GROUP BY pr.id, pr.name, pr.key, pr.status, pr.start_date, pr.end_date LIMIT 1`;
    params = [`%${projectName}%`];
  } else {
    sql = `${baseSelect}
      WHERE pr.name ILIKE $1
        AND (pr.owner_id = $2 OR EXISTS (
          SELECT 1 FROM public.project_members pm WHERE pm.project_id = pr.id AND pm.user_id = $2
        ))
      GROUP BY pr.id, pr.name, pr.key, pr.status, pr.start_date, pr.end_date
      LIMIT 1`;
    params = [`%${projectName}%`, profileId];
  }

  const result = await query(sql, params);
  return result.rows[0] ?? null;
}

async function getTeamSummary(profileId: string, role: string) {
  let projectFilter: string;
  let params: unknown[];

  if (role === 'admin') {
    projectFilter = '';
    params = [];
  } else {
    projectFilter = `
      AND (pr.owner_id = $1 OR EXISTS (
        SELECT 1 FROM public.project_members pm2
        WHERE pm2.project_id = pr.id AND pm2.user_id = $1
      ))`;
    params = [profileId];
  }

  const result = await query(
    `WITH team_tasks AS (
       SELECT
         p.id AS profile_id,
         p.full_name,
         p.cargo,
         COUNT(DISTINCT t.id) FILTER (WHERE NOT ts.is_completed)             AS pending_tasks,
         COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed)                 AS completed_tasks,
         COUNT(DISTINCT t.id) FILTER (WHERE NOT ts.is_completed AND t.due_date < CURRENT_DATE) AS overdue_tasks
       FROM public.profiles p
       JOIN public.project_members pm ON pm.user_id = p.id
       JOIN public.projects pr ON pr.id = pm.project_id ${projectFilter}
       LEFT JOIN public.tasks t ON t.assignee_id = p.id
       LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
       GROUP BY p.id, p.full_name, p.cargo
     )
     SELECT * FROM team_tasks
     ORDER BY overdue_tasks DESC, pending_tasks DESC
     LIMIT 15`,
    params,
  );
  return result.rows;
}
async function getGlobalOverview() {
  const [projectsRes, tasksRes, overdueRes] = await Promise.all([
    query(`
      SELECT
        COUNT(*)                                          AS total_projects,
        COUNT(*) FILTER (WHERE status = 'active')        AS active_projects,
        COUNT(*) FILTER (WHERE status = 'completed')     AS completed_projects,
        COUNT(*) FILTER (WHERE total_tasks = 0)          AS projects_sin_iniciar
      FROM (
        SELECT pr.id, pr.status, COUNT(t.id) AS total_tasks
        FROM public.projects pr
        LEFT JOIN public.tasks t ON t.project_id = pr.id
        GROUP BY pr.id, pr.status
      ) sub
    `),
    query(`
      SELECT
        COUNT(*)                                                AS total_tasks,
        COUNT(*) FILTER (WHERE NOT ts.is_completed)            AS pending_tasks,
        COUNT(*) FILTER (WHERE ts.is_completed)                AS completed_tasks,
        COUNT(*) FILTER (WHERE ts.name = 'Pendiente')          AS sin_iniciar,
        COUNT(*) FILTER (WHERE ts.name = 'En proceso')         AS en_proceso,
        COUNT(*) FILTER (WHERE ts.name = 'En revisión')        AS en_revision,
        COUNT(*) FILTER (WHERE ts.name = 'Ajustes')            AS ajustes
      FROM public.tasks t
      JOIN public.task_statuses ts ON ts.id = t.status_id
    `),
    query(`
      SELECT COUNT(*) AS overdue_tasks
      FROM public.tasks t
      JOIN public.task_statuses ts ON ts.id = t.status_id
      WHERE NOT ts.is_completed AND t.due_date < CURRENT_DATE
    `),
  ]);

  return {
    projects: projectsRes.rows[0],
    tasks: tasksRes.rows[0],
    overdue: overdueRes.rows[0],
  };
}

async function getProjectsAtRisk() {
  const result = await query(`
    SELECT
      pr.id,
      pr.name,
      pr.key,
      pr.status,
      pr.end_date,
      COUNT(t.id) FILTER (WHERE NOT ts.is_completed)                               AS pending_tasks,
      COUNT(t.id) FILTER (WHERE NOT ts.is_completed AND t.due_date < CURRENT_DATE) AS overdue_tasks,
      COUNT(t.id) FILTER (WHERE NOT ts.is_completed AND t.priority IN ('urgent','high')) AS high_priority_tasks,
      CASE
        WHEN COUNT(t.id) FILTER (WHERE NOT ts.is_completed AND t.due_date < CURRENT_DATE) > 5 THEN 'alto'
        WHEN COUNT(t.id) FILTER (WHERE NOT ts.is_completed AND t.due_date < CURRENT_DATE) > 0 THEN 'medio'
        ELSE 'bajo'
      END AS risk_level
    FROM public.projects pr
    LEFT JOIN public.tasks t ON t.project_id = pr.id
    LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
    WHERE pr.status = 'active'
    GROUP BY pr.id, pr.name, pr.key, pr.status, pr.end_date
    HAVING COUNT(t.id) FILTER (WHERE NOT ts.is_completed AND t.due_date < CURRENT_DATE) > 0
    ORDER BY overdue_tasks DESC
    LIMIT 10
  `);
  return result.rows;
}

async function getTopCriticalTasks() {
  const result = await query(`
    SELECT
      t.id,
      t.title,
      t.due_date,
      t.priority,
      ts.name AS status,
      p.full_name AS assignee_name,
      p.cargo AS assignee_cargo,
      pr.name AS project_name
    FROM public.tasks t
    JOIN public.task_statuses ts ON ts.id = t.status_id
    JOIN public.projects pr ON pr.id = t.project_id
    LEFT JOIN public.profiles p ON p.id = t.assignee_id
    WHERE NOT ts.is_completed
      AND (t.due_date < CURRENT_DATE OR t.priority IN ('urgent','high'))
    ORDER BY
      CASE WHEN t.due_date < CURRENT_DATE THEN 0 ELSE 1 END ASC,
      CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END ASC,
      t.due_date ASC NULLS LAST
    LIMIT 15
  `);
  return result.rows;
}

async function getPeopleWithoutTasks() {
  const result = await query(`
    SELECT
      p.id,
      p.full_name,
      p.cargo,
      p.email,
      COALESCE(p.weekly_hours_capacity, 40.25) AS weekly_capacity
    FROM public.profiles p
    WHERE p.role != 'admin'
      AND NOT EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.assignee_id = p.id
          AND EXISTS (
            SELECT 1 FROM public.task_statuses ts
            WHERE ts.id = t.status_id AND NOT ts.is_completed
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.task_tema_assignees tta
        JOIN public.tasks t ON t.id = tta.task_id
        JOIN public.task_statuses ts ON ts.id = t.status_id
        WHERE tta.assignee_id = p.id AND NOT ts.is_completed
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.task_material_assignees tma
        JOIN public.tasks t ON t.id = tma.task_id
        JOIN public.task_statuses ts ON ts.id = t.status_id
        WHERE tma.assignee_id = p.id AND NOT ts.is_completed
      )
    ORDER BY p.full_name
  `);
  return result.rows;
}

async function getPersonWorkloadByName(name: string) {
  const profileResult = await query(
    `SELECT id, full_name, cargo, email,
            COALESCE(weekly_hours_capacity, 40.25) AS weekly_capacity
     FROM public.profiles
     WHERE full_name ILIKE $1
     LIMIT 1`,
    [`%${name}%`],
  );

  if (profileResult.rows.length === 0) return null;

  const profile = profileResult.rows[0];

  const statsResult = await query(
    `WITH my_task_ids AS (
       SELECT t.id AS task_id FROM public.tasks t WHERE t.assignee_id = $1
       UNION
       SELECT tta.task_id FROM public.task_tema_assignees tta WHERE tta.assignee_id = $1
       UNION
       SELECT tma.task_id FROM public.task_material_assignees tma WHERE tma.assignee_id = $1
     )
     SELECT
       COUNT(*)                                                               AS total,
       COUNT(*) FILTER (WHERE NOT ts.is_completed)                           AS pending,
       COUNT(*) FILTER (WHERE ts.is_completed)                               AS completed,
       COUNT(*) FILTER (WHERE NOT ts.is_completed AND t.due_date < CURRENT_DATE) AS overdue,
       COUNT(*) FILTER (WHERE ts.name = 'Pendiente')                         AS sin_iniciar,
       COUNT(*) FILTER (WHERE ts.name = 'En proceso')                        AS en_proceso,
       COALESCE(SUM(tma2.horas_estimadas) FILTER (WHERE NOT ts.is_completed), 0) AS horas_pendientes
     FROM my_task_ids mi
     JOIN public.tasks t ON t.id = mi.task_id
     JOIN public.task_statuses ts ON ts.id = t.status_id
     LEFT JOIN public.task_material_assignees tma2
       ON tma2.task_id = t.parent_task_id AND tma2.assignee_id = $1
       AND tma2.material_id = t.material_requerido_id`,
    [profile.id],
  );

  return { profile, stats: statsResult.rows[0] };
}

async function getUserProjectsOverview(profileId: string, role: string) {
  let sql: string;
  let params: unknown[];

  const selectCols = `
       pr.id,
       pr.name,
       pr.key,
       pr.status,
       COUNT(t.id)                                     AS total_tasks,
       COUNT(t.id) FILTER (WHERE ts.is_completed)      AS completed_tasks,
       COUNT(t.id) FILTER (WHERE NOT ts.is_completed)  AS pending_tasks`;

  const joins = `
     LEFT JOIN public.tasks t ON t.project_id = pr.id
     LEFT JOIN public.task_statuses ts ON ts.id = t.status_id`;

  if (role === 'admin') {
    // Admin ve TODOS los proyectos sin filtro de membresía
    sql = `SELECT ${selectCols}
     FROM public.projects pr
     ${joins}
     GROUP BY pr.id, pr.name, pr.key, pr.status
     ORDER BY pr.created_at DESC
     LIMIT 20`;
    params = [];
  } else if (role === 'project_leader') {
    // Leader ve proyectos donde es owner O donde es miembro
    sql = `SELECT ${selectCols}
     FROM public.projects pr
     ${joins}
     WHERE pr.owner_id = $1
        OR EXISTS (
             SELECT 1 FROM public.project_members pm
             WHERE pm.project_id = pr.id AND pm.user_id = $1
           )
     GROUP BY pr.id, pr.name, pr.key, pr.status
     ORDER BY pr.created_at DESC
     LIMIT 20`;
    params = [profileId];
  } else {
    // Usuario regular: solo proyectos donde es miembro
    sql = `SELECT ${selectCols}
     FROM public.project_members pm
     JOIN public.projects pr ON pr.id = pm.project_id
     ${joins}
     WHERE pm.user_id = $1
     GROUP BY pr.id, pr.name, pr.key, pr.status
     ORDER BY pr.created_at DESC
     LIMIT 10`;
    params = [profileId];
  }

  const result = await query(sql, params);
  return result.rows;
}

/** Personas que tienen tareas asignadas (como assignee principal o en material/tema) por proyecto */
async function getPeopleWithTasks() {
  const result = await query(
    `WITH assignees AS (
       SELECT t.assignee_id AS profile_id, t.project_id, t.id AS task_id
       FROM public.tasks t
       WHERE t.assignee_id IS NOT NULL
       UNION
       SELECT tma.assignee_id, t.project_id, t.id
       FROM public.task_material_assignees tma
       JOIN public.tasks t ON t.id = tma.task_id
       UNION
       SELECT tta.assignee_id, t.project_id, t.id
       FROM public.task_tema_assignees tta
       JOIN public.tasks t ON t.id = tta.task_id
     )
     SELECT
       p.full_name,
       p.cargo,
       pr.name AS project_name,
       COUNT(DISTINCT a.task_id)::int AS task_count
     FROM assignees a
     JOIN public.profiles p ON p.id = a.profile_id
     JOIN public.projects pr ON pr.id = a.project_id
     GROUP BY p.id, p.full_name, p.cargo, pr.id, pr.name
     ORDER BY p.full_name, pr.name`,
  );
  return result.rows;
}

/** Resumen global de materiales requeridos vs materiales con tareas finalizadas */
async function getMaterialsSummary() {
  const result = await query(
    `SELECT
       COUNT(mr.id) AS total_materials,
       COUNT(DISTINCT t.material_requerido_id) FILTER (WHERE ts.is_completed = true) AS completed_materials
     FROM public.materiales_requeridos mr
     LEFT JOIN public.tasks t ON t.material_requerido_id = mr.id
     LEFT JOIN public.task_statuses ts ON ts.id = t.status_id`,
  );

  return result.rows[0];
}

async function getMyUpcomingTasksList(profileId: string) {
  const result = await query(
    `WITH my_task_ids AS (
       SELECT t.id AS task_id FROM public.tasks t WHERE t.assignee_id = $1
       UNION
       SELECT tta.task_id FROM public.task_tema_assignees tta WHERE tta.assignee_id = $1
       UNION
       SELECT tma.task_id FROM public.task_material_assignees tma WHERE tma.assignee_id = $1
     )
     SELECT t.id, t.title, t.due_date, t.priority, ts.name AS status, pr.name AS project_name
     FROM my_task_ids mi
     JOIN public.tasks t ON t.id = mi.task_id
     JOIN public.task_statuses ts ON ts.id = t.status_id
     JOIN public.projects pr ON pr.id = t.project_id
     WHERE NOT ts.is_completed
       AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
     ORDER BY t.due_date ASC, CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END ASC
     LIMIT 15`,
    [profileId],
  );
  return result.rows;
}

async function getMyTasksByProject(profileId: string, projectName: string) {
  const result = await query(
    `WITH my_task_ids AS (
       SELECT t.id AS task_id FROM public.tasks t WHERE t.assignee_id = $1
       UNION
       SELECT tta.task_id FROM public.task_tema_assignees tta WHERE tta.assignee_id = $1
       UNION
       SELECT tma.task_id FROM public.task_material_assignees tma WHERE tma.assignee_id = $1
     )
     SELECT t.id, t.title, t.due_date, t.priority, ts.name AS status, ts.is_completed
     FROM my_task_ids mi
     JOIN public.tasks t ON t.id = mi.task_id
     JOIN public.task_statuses ts ON ts.id = t.status_id
     JOIN public.projects pr ON pr.id = t.project_id
     WHERE pr.name ILIKE $2
     ORDER BY ts.is_completed ASC,
       CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END ASC,
       t.due_date ASC NULLS LAST
     LIMIT 20`,
    [profileId, `%${projectName}%`],
  );
  return result.rows;
}

async function getMyProjectTeam(profileId: string, projectName?: string) {
  const projectFilter = projectName
    ? `AND pr.name ILIKE $2`
    : '';
  const params: unknown[] = projectName ? [profileId, `%${projectName}%`] : [profileId];

  const result = await query(
    `SELECT
       p.id, p.full_name, p.cargo, p.email,
       STRING_AGG(DISTINCT pr.name, ', ' ORDER BY pr.name) AS projects
     FROM public.project_members pm
     JOIN public.projects pr ON pr.id = pm.project_id
     JOIN public.project_members pm2 ON pm2.project_id = pr.id AND pm2.user_id = $1
     JOIN public.profiles p ON p.id = pm.user_id
     WHERE pm.user_id != $1 ${projectFilter}
     GROUP BY p.id, p.full_name, p.cargo, p.email
     ORDER BY p.full_name
     LIMIT 30`,
    params,
  );
  return result.rows;
}

async function getMyRecentlyCompleted(profileId: string) {
  const result = await query(
    `WITH my_task_ids AS (
       SELECT t.id AS task_id FROM public.tasks t WHERE t.assignee_id = $1
       UNION
       SELECT tta.task_id FROM public.task_tema_assignees tta WHERE tta.assignee_id = $1
       UNION
       SELECT tma.task_id FROM public.task_material_assignees tma WHERE tma.assignee_id = $1
     )
     SELECT t.id, t.title, t.due_date, ts.name AS status, pr.name AS project_name
     FROM my_task_ids mi
     JOIN public.tasks t ON t.id = mi.task_id
     JOIN public.task_statuses ts ON ts.id = t.status_id
     JOIN public.projects pr ON pr.id = t.project_id
     WHERE ts.is_completed
     ORDER BY t.updated_at DESC NULLS LAST
     LIMIT 10`,
    [profileId],
  );
  return result.rows;
}

async function getMyTodayPriorities(profileId: string) {
  const result = await query(
    `WITH my_task_ids AS (
       SELECT t.id AS task_id FROM public.tasks t WHERE t.assignee_id = $1
       UNION
       SELECT tta.task_id FROM public.task_tema_assignees tta WHERE tta.assignee_id = $1
       UNION
       SELECT tma.task_id FROM public.task_material_assignees tma WHERE tma.assignee_id = $1
     )
     SELECT t.id, t.title, t.due_date, t.priority, ts.name AS status, pr.name AS project_name,
       CASE
         WHEN t.due_date < CURRENT_DATE THEN 'vencida'
         WHEN t.due_date = CURRENT_DATE THEN 'vence_hoy'
         ELSE 'prioritaria'
       END AS urgency_reason
     FROM my_task_ids mi
     JOIN public.tasks t ON t.id = mi.task_id
     JOIN public.task_statuses ts ON ts.id = t.status_id
     JOIN public.projects pr ON pr.id = t.project_id
     WHERE NOT ts.is_completed
       AND (
         t.due_date <= CURRENT_DATE
         OR t.priority IN ('urgent', 'high')
       )
     ORDER BY
       CASE WHEN t.due_date < CURRENT_DATE THEN 0 ELSE 1 END,
       CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
       t.due_date ASC NULLS LAST
     LIMIT 10`,
    [profileId],
  );
  return result.rows;
}

async function getLeaderCriticalTasks(profileId: string) {
  const result = await query(
    `SELECT
       t.id, t.title, t.due_date, t.priority,
       ts.name AS status,
       p.full_name AS assignee_name,
       p.cargo AS assignee_cargo,
       pr.name AS project_name
     FROM public.tasks t
     JOIN public.task_statuses ts ON ts.id = t.status_id
     JOIN public.projects pr ON pr.id = t.project_id
     LEFT JOIN public.profiles p ON p.id = t.assignee_id
     WHERE NOT ts.is_completed
       AND (t.due_date < CURRENT_DATE OR t.priority IN ('urgent','high'))
       AND (
         pr.owner_id = $1
         OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = pr.id AND pm.user_id = $1)
       )
     ORDER BY
       CASE WHEN t.due_date < CURRENT_DATE THEN 0 ELSE 1 END ASC,
       CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END ASC,
       t.due_date ASC NULLS LAST
     LIMIT 20`,
    [profileId],
  );
  return result.rows;
}

async function getLeaderTeamHours(profileId: string) {
  const result = await query(
    `SELECT
       p.id, p.full_name, p.cargo,
       COALESCE(p.weekly_hours_capacity, 40.25) AS weekly_capacity,
       COUNT(DISTINCT t.id) FILTER (WHERE NOT ts.is_completed) AS tareas_pendientes,
       COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed) AS tareas_completadas,
       COALESCE(SUM(tma.horas_estimadas) FILTER (WHERE NOT ts.is_completed), 0) AS horas_pendientes,
       COUNT(DISTINCT t.id) FILTER (WHERE NOT ts.is_completed AND t.due_date < CURRENT_DATE) AS overdue
     FROM (
       SELECT DISTINCT pr.id AS project_id
       FROM public.projects pr
       WHERE pr.owner_id = $1
          OR EXISTS (
            SELECT 1 FROM public.project_members pm_check
            WHERE pm_check.project_id = pr.id AND pm_check.user_id = $1
          )
     ) leader_projects
     JOIN public.project_members pm_team ON pm_team.project_id = leader_projects.project_id
       AND pm_team.user_id != $1
     JOIN public.profiles p ON p.id = pm_team.user_id
     LEFT JOIN public.tasks t ON t.assignee_id = p.id
     LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
     LEFT JOIN public.task_material_assignees tma
       ON tma.task_id = t.parent_task_id AND tma.assignee_id = p.id
     GROUP BY p.id, p.full_name, p.cargo, p.weekly_hours_capacity
     ORDER BY horas_pendientes DESC
     LIMIT 15`,
    [profileId],
  );
  return result.rows;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function detectIntent(message: string): string {
  const text = normalizeText(message);

  // Ayuda / qué puedes hacer
  if (
    text.includes('ayuda') ||
    text.includes('que puedes') ||
    text.includes('que sabes') ||
    text.includes('como te uso') ||
    text.includes('para que sirves') ||
    text.includes('que preguntas') ||
    text.includes('que me puedes decir') ||
    text.includes('que me puedes') ||
    text.includes('comandos') ||
    text.includes('instrucciones')
  ) {
    return 'HELP';
  }

  // Resumen global (admin/leader)
  if (
    (text.includes('fabrica') && !text.includes('tarea') && !text.includes('tarea')) ||
    text.includes('resumen general') ||
    text.includes('panorama') ||
    text.includes('como va todo') ||
    text.includes('vision general') ||
    (text.includes('resumen') && !text.includes('tarea') && !text.includes('proyecto'))
  ) {
    return 'GLOBAL_OVERVIEW';
  }

  // Personas / quién tiene tareas
  if (
    text.includes('persona') ||
    text.includes('gente') ||
    text.includes('quien tiene') ||
    text.includes('quienes tienen') ||
    text.includes('tareas asignadas') ||
    text.includes('mas tareas') ||
    text.includes('tienen tareas') ||
    (text.includes('tareas') && (text.includes('en los proyectos') || text.includes('por proyecto')))
  ) {
    return 'PEOPLE_WITH_TASKS';
  }

  // Materiales
  if (text.includes('material') || text.includes('materiales')) {
    return 'MATERIALS_SUMMARY';
  }

  // Reporte de persona específica por nombre
  if (
    (text.includes('reporte de') || text.includes('carga de') || text.includes('tareas de') || text.includes('como esta') ||
     (text.includes('como va') && !text.includes('proyecto') && !text.includes('el ') && !text.includes('este '))) &&
    !text.includes('proyecto') &&
    !text.includes('equipo') &&
    !text.includes('fabrica')
  ) {
    return 'PERSON_WORKLOAD';
  }

  // Horas del equipo (leader)
  if (
    (text.includes('hora') || text.includes('carga')) &&
    (text.includes('equipo') || text.includes('equip') || text.includes('team'))
  ) {
    return 'LEADER_TEAM_HOURS';
  }

  // Resumen del equipo (específico: "mi equipo", "el equipo", miembros)
  if (
    text.includes('mi equipo') ||
    text.includes('el equipo') ||
    text.includes('miembros') ||
    text.includes('integrantes') ||
    text.includes('colaborador') ||
    text.includes('colaboradores') ||
    (text.includes('como') && text.includes('equipo'))
  ) {
    return 'TEAM_SUMMARY';
  }

  // Equipo / reporte general (solo si no matcheó TEAM_SUMMARY antes)
  if (
    (text.includes('equipo') &&
      !text.includes('horas del equipo') &&
      !text.includes('carga del equipo')) ||
    text.includes('capacidad del equipo')
  ) {
    return 'TEAM_REPORTS';
  }

  // Tareas próximas a vencer (lista)
  if (
    (text.includes('vence') || text.includes('vencen') || text.includes('vencer')) &&
    (text.includes('esta semana') || text.includes('proxim') || text.includes('pronto') || text.includes('siguiente'))
  ) {
    return 'MY_UPCOMING_TASKS';
  }

  // Tareas completadas recientemente
  if (
    (text.includes('complet') && !text.includes('proyecto')) ||
    (text.includes('termin') && (text.includes('tarea') || text.includes('hice') || text.includes('complete') || text.includes('ya'))) ||
    (text.includes('finaliz') && text.includes('tarea')) ||
    (text.includes('ya') && text.includes('hice')) ||
    text.includes('entregu')
  ) {
    return 'MY_COMPLETED';
  }

  // Prioridades del día / qué hacer hoy
  if (
    text.includes('hoy') ||
    text.includes('que hago') ||
    text.includes('que debo hacer') ||
    text.includes('por donde empiezo') ||
    text.includes('me recomiendas') ||
    text.includes('mas urgente') ||
    text.includes('primero debo') ||
    text.includes('prioridad')
  ) {
    return 'TODAY_PRIORITIES';
  }

  // Tareas de un proyecto específico del usuario
  if (
    (text.includes('mis tareas') || text.includes('mis actividades')) &&
    text.includes('proyecto')
  ) {
    return 'MY_TASKS_BY_PROJECT';
  }

  // Compañeros / equipo del usuario
  if (
    text.includes('companer') ||
    text.includes('companero') ||
    text.includes('quien mas') ||
    text.includes('quienes estan') ||
    text.includes('con quien trabajo') ||
    text.includes('mi proyecto tiene') ||
    (text.includes('quien') && text.includes('proyecto'))
  ) {
    return 'MY_TEAM';
  }

  // Tareas críticas del leader en sus proyectos
  // No capturar preguntas de conteo ("cuantas") — deben ir a MY_TASKS_SUMMARY
  if (
    text.includes('criticas') || text.includes('urgentes') || text.includes('vencidas')
  ) {
    if (
      !text.includes('mis') &&
      !text.includes('yo') &&
      !text.includes('cuantas') &&
      !text.includes('cuanto') &&
      !text.includes('cuantos')
    ) {
      return 'LEADER_CRITICAL';
    }
  }

  // Proyectos en riesgo
  if (
    text.includes('riesgo') ||
    text.includes('en riesgo') ||
    text.includes('proyectos criticos') ||
    text.includes('proyectos atrasados') ||
    text.includes('proyectos con problemas') ||
    text.includes('que proyectos van mal')
  ) {
    return 'PROJECTS_AT_RISK';
  }

  // Tareas críticas globales (admin)
  if (
    text.includes('tareas criticas') ||
    text.includes('mas urgentes') ||
    text.includes('mas criticas') ||
    text.includes('tareas globales') ||
    (text.includes('todas') && (text.includes('urgentes') || text.includes('vencidas'))) ||
    (text.includes('fabrica') && text.includes('tarea'))
  ) {
    return 'TOP_CRITICAL_TASKS';
  }

  // Personas sin tareas / disponibles
  if (
    text.includes('sin tareas') ||
    text.includes('sin asignacion') ||
    text.includes('disponible') ||
    text.includes('disponibles') ||
    text.includes('sin trabajo') ||
    text.includes('no tienen tareas') ||
    text.includes('libre') ||
    text.includes('libres')
  ) {
    return 'PEOPLE_WITHOUT_TASKS';
  }

  // Carga de trabajo / horas
  if (
    text.includes('hora') ||
    text.includes('horas') ||
    text.includes('carga de trabajo') ||
    text.includes('cuanto trabajo') ||
    text.includes('capacidad') ||
    (text.includes('cuanto') && text.includes('asignad'))
  ) {
    return 'WORKLOAD';
  }

  // Detalle de un proyecto específico
  if (
    (text.includes('proyecto') || text.includes('como va')) &&
    (text.includes('como va') || text.includes('avance de') || text.includes('estado de') || text.includes('progreso de') || text.includes('el proyecto'))
  ) {
    return 'PROJECT_DETAIL';
  }

  // Detalle de tareas (listado con nombres)
  if (
    text.includes('cuales') ||
    text.includes('lista') ||
    text.includes('listame') ||
    text.includes('dime mis tareas') ||
    text.includes('mostrame') ||
    (text.includes('tareas') && (
      text.includes('vencida') || text.includes('vencido') ||
      text.includes('atrasada') || text.includes('atrasado') ||
      text.includes('retrasada') || text.includes('retrasado') ||
      text.includes('urgente') || text.includes('prioritario') || text.includes('critica')
    ))
  ) {
    return 'TASK_DETAIL';
  }

  // Resumen de tareas (conteos)
  if (text.includes('tarea') || text.includes('tareas') || text.includes('trabajo') || text.includes('asignacion')) {
    if (
      text.includes('hoy') ||
      text.includes('vencen') ||
      text.includes('vencida') ||
      text.includes('vencido') ||
      text.includes('semana') ||
      text.includes('atrasada') ||
      text.includes('retrasado') ||
      text.includes('retrasada') ||
      text.includes('sin iniciar') ||
      text.includes('en proceso') ||
      text.includes('cuantas') ||
      text.includes('estado')
    ) {
      return 'MY_TASKS_SUMMARY';
    }
    return 'MY_TASKS_GENERIC';
  }

  // Proyectos
  if (
    text.includes('proyecto') ||
    text.includes('proyectos') ||
    text.includes('avance') ||
    text.includes('progreso')
  ) {
    return 'PROJECTS_OVERVIEW';
  }

  return 'GENERIC';
}

export async function handleChatMessage(message: string, user: ChatUserContext): Promise<ChatResult> {
  const intent = detectIntent(message);
  const safeMessage = message.slice(0, 800);

  let contextJson: unknown = {};
  const isPrivileged = user.role === 'admin' || user.role === 'project_leader';

  try {
    if (intent === 'HELP') {
      const isAdminOrLeader = user.role === 'admin' || user.role === 'project_leader';
      contextJson = {
        type: 'help',
        role: user.role,
        capabilities_user: [
          'Resumen y conteo de mis tareas por estado',
          'Lista de tareas pendientes, urgentes o vencidas',
          'Tareas que vencen esta semana o en los próximos 14 días',
          '¿Qué hago hoy? / mis prioridades del día',
          'Mis tareas del proyecto [nombre]',
          'Tareas que completé recientemente',
          'Mis compañeros de proyecto',
          'Mi carga de trabajo y horas estimadas',
          'Mis proyectos y su avance',
          'Detalle del proyecto [nombre]',
        ],
        capabilities_privileged: isAdminOrLeader
          ? [
              'Resumen global de la Fábrica de Contenidos',
              'Proyectos en riesgo',
              'Tareas críticas y urgentes (todos los proyectos)',
              'Personas sin tareas asignadas / disponibles',
              'Reporte de una persona por nombre',
              'Resumen del equipo y su carga',
              'Horas pendientes por miembro del equipo',
              'Resumen de materiales requeridos',
            ]
          : [],
      };
    } else if ((intent === 'MY_TASKS_SUMMARY' || intent === 'MY_TASKS_GENERIC') && user.profileId) {
      if (user.role === 'admin') {
        // Admin pregunta sobre conteos → dar datos globales de la fábrica
        const overview = await getGlobalOverview();
        contextJson = { type: 'global_task_counts', overview };
      } else {
        const summary = await getMyTasksSummary(user.profileId);
        contextJson = { type: 'my_tasks_summary', summary };
      }
    } else if (intent === 'TASK_DETAIL' && user.profileId) {
      const tasks = await getMyTasksDetail(user.profileId);
      contextJson = { type: 'task_detail', tasks };
    } else if (intent === 'MY_UPCOMING_TASKS' && user.profileId) {
      const tasks = await getMyUpcomingTasksList(user.profileId);
      contextJson = { type: 'my_upcoming_tasks', tasks };

    } else if (intent === 'MY_COMPLETED' && user.profileId) {
      const tasks = await getMyRecentlyCompleted(user.profileId);
      contextJson = { type: 'my_completed_tasks', tasks };

    } else if (intent === 'TODAY_PRIORITIES' && user.profileId) {
      const tasks = await getMyTodayPriorities(user.profileId);
      contextJson = { type: 'today_priorities', tasks };

    } else if (intent === 'MY_TASKS_BY_PROJECT' && user.profileId) {
      const normalized = normalizeText(safeMessage);
      const match =
        normalized.match(/proyecto\s+(.+)/) ||
        normalized.match(/en\s+(.+)/) ||
        normalized.match(/del\s+(.+)/);
      const projectName = match ? match[1].trim() : '';
      if (projectName) {
        const tasks = await getMyTasksByProject(user.profileId, projectName);
        contextJson = { type: 'my_tasks_by_project', project_search: projectName, tasks };
      } else {
        contextJson = { type: 'none', note: 'No se detectó el nombre del proyecto. Intenta "mis tareas del proyecto [nombre]".' };
      }

    } else if (intent === 'MY_TEAM' && user.profileId) {
      const normalized = normalizeText(safeMessage);
      const match = normalized.match(/proyecto\s+(.+)/);
      const projectName = match ? match[1].trim() : undefined;
      const team = await getMyProjectTeam(user.profileId, projectName);
      contextJson = { type: 'my_team', team };

    } else if (intent === 'LEADER_CRITICAL' && user.profileId) {
      if (user.role === 'project_leader') {
        const tasks = await getLeaderCriticalTasks(user.profileId);
        contextJson = { type: 'leader_critical_tasks', tasks };
      } else if (user.role === 'admin') {
        const tasks = await getTopCriticalTasks();
        contextJson = { type: 'top_critical_tasks', tasks };
      } else {
        const tasks = await getMyTodayPriorities(user.profileId);
        contextJson = { type: 'today_priorities', tasks };
      }

    } else if (intent === 'LEADER_TEAM_HOURS' && user.profileId) {
      if (user.role === 'project_leader') {
        const team = await getLeaderTeamHours(user.profileId);
        contextJson = { type: 'leader_team_hours', team };
      } else if (user.role === 'admin') {
        const people = await getPeopleWithTasks();
        contextJson = { type: 'team_reports', people };
      } else {
        const workload = await getUserWorkload(user.profileId);
        contextJson = { type: 'workload', workload };
      }
    } else if (intent === 'WORKLOAD' && user.profileId) {
      const workload = await getUserWorkload(user.profileId);
      contextJson = { type: 'workload', workload };
    } else if (intent === 'PROJECTS_AT_RISK') {
      if (isPrivileged) {
        const projects = await getProjectsAtRisk();
        contextJson = { type: 'projects_at_risk', projects };
      } else {
        contextJson = { type: 'forbidden', reason: 'Solo administradores y líderes pueden ver proyectos en riesgo.' };
      }
    } else if (intent === 'TOP_CRITICAL_TASKS') {
      if (isPrivileged) {
        const tasks = await getTopCriticalTasks();
        contextJson = { type: 'top_critical_tasks', tasks };
      } else {
        contextJson = { type: 'forbidden', reason: 'Solo administradores y líderes pueden ver las tareas críticas globales.' };
      }
    } else if (intent === 'PEOPLE_WITHOUT_TASKS') {
      if (isPrivileged) {
        const people = await getPeopleWithoutTasks();
        contextJson = { type: 'people_without_tasks', people };
      } else {
        contextJson = { type: 'forbidden', reason: 'Solo administradores y líderes pueden ver esta información.' };
      }
    } else if (intent === 'PERSON_WORKLOAD' && user.profileId) {
      const normalized = normalizeText(safeMessage);
      const match =
        normalized.match(/reporte de\s+(.+)/) ||
        normalized.match(/carga de\s+(.+)/) ||
        normalized.match(/tareas de\s+(.+)/) ||
        normalized.match(/como esta\s+(.+)/) ||
        normalized.match(/como va\s+(.+)/);
      const personName = match ? match[1].trim() : '';
      if (personName && isPrivileged) {
        const data = await getPersonWorkloadByName(personName);
        contextJson = { type: 'person_workload', data };
      } else if (!isPrivileged) {
        contextJson = { type: 'forbidden', reason: 'Solo administradores y líderes pueden ver el reporte de otras personas.' };
      } else {
        contextJson = { type: 'none', note: 'No se detectó el nombre de la persona. Intenta con "reporte de [nombre]".' };
      }
    } else if (intent === 'PROJECT_DETAIL' && user.profileId) {
      // Extraer nombre del proyecto del mensaje (texto después de palabras clave)
      const normalized = normalizeText(safeMessage);
      const match =
        normalized.match(/proyecto\s+(.+)/) ||
        normalized.match(/como va\s+(.+)/) ||
        normalized.match(/avance de\s+(.+)/) ||
        normalized.match(/estado de\s+(.+)/);
      const projectName = match ? match[1].trim() : '';
      if (projectName) {
        const project = await getProjectDetail(user.profileId, user.role ?? 'user', projectName);
        contextJson = { type: 'project_detail', project };
      } else {
        // Sin nombre específico, mostrar lista de proyectos
        const projects = await getUserProjectsOverview(user.profileId, user.role ?? 'user');
        contextJson = { type: 'projects_overview', role: user.role, projects };
      }
    } else if (intent === 'TEAM_SUMMARY') {
      if (isPrivileged && user.profileId) {
        const team = await getTeamSummary(user.profileId, user.role ?? 'user');
        contextJson = { type: 'team_summary', team };
      } else {
        contextJson = {
          type: 'forbidden',
          reason: 'Solo administradores y líderes pueden ver el resumen del equipo.',
        };
      }
    } else if (intent === 'PROJECTS_OVERVIEW' && user.profileId) {
      const projects = await getUserProjectsOverview(user.profileId, user.role ?? 'user');
      contextJson = { type: 'projects_overview', role: user.role, projects };
    } else if (intent === 'GLOBAL_OVERVIEW') {
      if (isPrivileged) {
        const overview = await getGlobalOverview();
        contextJson = { type: 'global_overview', overview };
      } else {
        contextJson = {
          type: 'forbidden',
          reason: 'Solo administradores y líderes pueden ver el resumen global.',
        };
      }
    } else if (intent === 'PEOPLE_WITH_TASKS') {
      if (isPrivileged) {
        const people = await getPeopleWithTasks();
        contextJson = { type: 'people_with_tasks', people };
      } else if (user.profileId) {
        contextJson = {
          type: 'forbidden',
          scope: 'people_with_tasks',
          reason:
            'Solo administradores y líderes de proyecto pueden ver información global de todas las personas y sus tareas. Puedes preguntarme por tus propias tareas y proyectos.',
        };
      }
    } else if (intent === 'TEAM_REPORTS') {
      if (isPrivileged) {
        const people = await getPeopleWithTasks();
        contextJson = { type: 'team_reports', people };
      } else {
        contextJson = {
          type: 'forbidden',
          reason: 'Solo administradores y líderes pueden ver reportes del equipo.',
        };
      }
    } else if (intent === 'MATERIALS_SUMMARY') {
      if (isPrivileged) {
        const materials = await getMaterialsSummary();
        contextJson = { type: 'materials_summary', materials };
      } else {
        contextJson = {
          type: 'forbidden',
          reason: 'Solo administradores y líderes de proyecto pueden ver el resumen global de materiales.',
        };
      }
    } else {
      contextJson = { type: 'none', note: 'No se ejecutó ninguna consulta específica.' };
    }
  } catch (error) {
    console.error('[chatOrchestrator] Error fetching context data:', error);
    contextJson = { type: 'error', note: 'Error al obtener datos desde la base de datos.' };
  }

  const roleLabel =
    user.role === 'admin'
      ? 'Administrador (ve todos los proyectos y personas)'
      : user.role === 'project_leader'
        ? 'Líder de proyecto (ve sus proyectos y su equipo)'
        : 'Usuario (ve solo sus proyectos y tareas asignadas)';

  // Intents que requieren respuestas largas (listas de tareas, reportes de equipo)
  const longResponseIntents = [
    'TASK_DETAIL',
    'MY_UPCOMING_TASKS',
    'MY_COMPLETED',
    'TODAY_PRIORITIES',
    'MY_TASKS_BY_PROJECT',
    'MY_TEAM',
    'LEADER_CRITICAL',
    'LEADER_TEAM_HOURS',
    'TOP_CRITICAL_TASKS',
    'PEOPLE_WITHOUT_TASKS',
    'PEOPLE_WITH_TASKS',
    'TEAM_REPORTS',
    'TEAM_SUMMARY',
    'PROJECTS_OVERVIEW',
    'GLOBAL_OVERVIEW',
    'PROJECTS_AT_RISK',
    'HELP',
  ];
  const maxTokens = longResponseIntents.includes(intent) ? 900 : 500;

  const isPrivilegedUser = user.role === 'admin' || user.role === 'project_leader';
  const maxLines = isPrivilegedUser ? 10 : 6;

  const systemInstructions = `
Eres Lumina, asistente de la Fábrica de Contenidos. Respondes preguntas sobre proyectos y tareas.

REGLAS ESTRICTAS:
- Usa SOLO los datos del bloque JSON de contexto. Jamás inventes números, nombres ni proyectos.
- Si el contexto tiene proyectos o tareas, úsalos. Si el array está vacío, dilo claramente ("No encontré tareas / proyectos").
- Si el contexto es de tipo "none" o "error", responde que no entendiste la pregunta y sugiere reformularla.
- Si el contexto es de tipo "forbidden", explica amablemente que no tienes acceso a esa información.
- Si el contexto es de tipo "help", lista las capacidades según el rol del usuario de forma ordenada.
- Si el contexto es de tipo "global_task_counts", responde SIEMPRE con los conteos globales aunque sean 0. 
-   Usa overview.tasks.total_tasks, overview.tasks.pending_tasks, overview.tasks.completed_tasks 
-   y overview.overdue.overdue_tasks para "tareas vencidas".
- Responde siempre en español, de forma clara y directa. Máximo ${maxLines} líneas.
- Para listas de tareas o personas usa viñetas (•) con una tarea por línea.
- Traduce prioridades: urgent → URGENTE, high → alta, medium → media, low → baja.
- Formatea fechas: convierte ISO (2026-03-15) a formato legible (15 mar 2026). Si la fecha ya pasó, añade "(VENCIDA)".
- Para estados de proyectos: active → activo, completed → completado, archived → archivado.
- "Proyectos sin iniciar" = total_tasks = 0.
- "Proyectos en proceso" = status = 'active' y pending_tasks > 0.
- "Proyectos completados" = status = 'completed' O completed_tasks = total_tasks (y total_tasks > 0).

Usuario: ${user.email}
Rol: ${roleLabel}
Pregunta: "${safeMessage}"

Contexto (JSON):
\`\`\`json
${JSON.stringify(contextJson, null, 2)}
\`\`\`
`;

  const answer = await generateChatAnswer(systemInstructions, maxTokens);

  if (env.NODE_ENV !== 'production') {
    console.log('[chatOrchestrator] intent:', intent);
    console.log('[chatOrchestrator] context:', contextJson);
    console.log('[chatOrchestrator] answer:', answer);
  }

  return { intent, answer };
}

