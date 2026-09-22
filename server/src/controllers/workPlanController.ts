import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { TASK_COMPLETION_CTE, validUuidOrNull, validDateOrNull } from './reportsMetrics.js';

/**
 * Shared base join for every "Plan de Trabajo" query: a task, its status, its
 * assignee (only active users), its project/team, and — when it has one — the
 * Programa/Materia(asignatura) it belongs to, resolved through whichever of the
 * three possible paths applies (direct link, via a tema, or via a material),
 * the same fallback chain tasksController already uses.
 */
const BASE_JOIN = `
  FROM public.tasks t
  JOIN public.task_statuses ts ON ts.id = t.status_id
  LEFT JOIN public.profiles p ON p.id = t.assignee_id
  LEFT JOIN public.users u ON u.id = p.user_id AND u.is_active = true
  JOIN public.projects proj ON proj.id = t.project_id
  LEFT JOIN public.teams team ON team.id = t.team_id
  LEFT JOIN public.materiales_requeridos mr ON mr.id = t.material_requerido_id
  LEFT JOIN public.temas tema ON tema.id = mr.tema_id
  LEFT JOIN public.asignaturas asig ON asig.id = t.asignatura_id OR asig.id = tema.asignatura_id OR asig.id = mr.asignatura_id
  LEFT JOIN public.programas prog ON prog.id = asig.programa_id
`;

interface WorkPlanFilters {
  project_id?: string;
  team_id?: string;
  cargo?: string;
  assignee_id?: string;
  status_id?: string;
  priority?: string;
  sprint_id?: string;
  programa_id?: string;
  date_from?: string;
  date_to?: string;
}

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

function readFilters(q: AuthRequest['query']): WorkPlanFilters {
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined;
  return {
    project_id: validUuidOrNull(one(q.project_id)) ?? undefined,
    team_id: validUuidOrNull(one(q.team_id)) ?? undefined,
    cargo: typeof one(q.cargo) === 'string' ? one(q.cargo) : undefined,
    assignee_id: validUuidOrNull(one(q.assignee_id)) ?? undefined,
    status_id: validUuidOrNull(one(q.status_id)) ?? undefined,
    priority: PRIORITIES.includes(String(one(q.priority))) ? String(one(q.priority)) : undefined,
    sprint_id: validUuidOrNull(one(q.sprint_id)) ?? undefined,
    programa_id: validUuidOrNull(one(q.programa_id)) ?? undefined,
    date_from: validDateOrNull(one(q.date_from)) ?? undefined,
    date_to: validDateOrNull(one(q.date_to)) ?? undefined,
  };
}

/** Builds parameterised WHERE conditions against BASE_JOIN's aliases. */
function buildConditions(filters: WorkPlanFilters, startIndex: number, opts: { requireActiveAssignee?: boolean } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = startIndex;

  if (opts.requireActiveAssignee) conditions.push('u.id IS NOT NULL');
  if (filters.project_id) { conditions.push(`proj.id = $${i++}::uuid`); params.push(filters.project_id); }
  if (filters.team_id) { conditions.push(`t.team_id = $${i++}::uuid`); params.push(filters.team_id); }
  if (filters.cargo) { conditions.push(`p.cargo = $${i++}`); params.push(filters.cargo); }
  if (filters.assignee_id) { conditions.push(`t.assignee_id = $${i++}::uuid`); params.push(filters.assignee_id); }
  if (filters.status_id) { conditions.push(`t.status_id = $${i++}::uuid`); params.push(filters.status_id); }
  if (filters.priority) { conditions.push(`t.priority = $${i++}`); params.push(filters.priority); }
  if (filters.sprint_id) { conditions.push(`t.sprint_id = $${i++}::uuid`); params.push(filters.sprint_id); }
  if (filters.programa_id) { conditions.push(`prog.id = $${i++}::uuid`); params.push(filters.programa_id); }
  if (filters.date_from) { conditions.push(`t.due_date >= $${i++}::date`); params.push(filters.date_from); }
  if (filters.date_to) { conditions.push(`t.due_date <= $${i++}::date`); params.push(filters.date_to); }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params, nextIndex: i };
}

const PRIORITY_WEIGHT: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 3 };

/**
 * GET /api/reports/work-plan/summary
 * Top KPI row. "Comparación con periodo anterior" only computed for completadas,
 * the one figure with a real timestamped event (task_status_history) to compare —
 * everything else here is a point-in-time count, not something with a meaningful
 * "previous period" under the current data model.
 */
export const getSummary = async (req: AuthRequest, res: Response) => {
  try {
    const filters = readFilters(req.query);
    const { where, params } = buildConditions(filters, 1);

    const mainRes = await query(`
      SELECT
        COUNT(DISTINCT t.id) AS total_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = false) AS active_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = true) AS completed_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = false AND t.due_date < CURRENT_DATE) AS overdue_tasks,
        COUNT(DISTINCT t.assignee_id) FILTER (WHERE ts.is_completed = false AND u.id IS NOT NULL) AS active_collaborators
      ${BASE_JOIN}
      ${where}
    `, params);

    const row = mainRes.rows[0];
    const total = parseInt(row.total_tasks);
    const completed = parseInt(row.completed_tasks);

    // Comparación de completadas: periodo actual vs. el periodo anterior de igual
    // duración, respetando los demás filtros (proyecto/equipo/cargo/etc.) pero NO
    // el rango de due_date -- la comparación se hace sobre la fecha real de
    // finalización, no sobre cuándo estaba planificada.
    let comparison: { current: number; previous: number } | null = null;
    if (filters.date_from && filters.date_to) {
      const filtersNoDate = { ...filters, date_from: undefined, date_to: undefined };
      const { where: whereNoDate, params: compParams, nextIndex } = buildConditions(filtersNoDate, 1);
      const spanDays = Math.max(1, Math.round(
        (new Date(filters.date_to).getTime() - new Date(filters.date_from).getTime()) / 86400000
      ) + 1);
      const prevTo = new Date(filters.date_from);
      prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo);
      prevFrom.setDate(prevFrom.getDate() - spanDays + 1);

      const compRes = await query(`
        WITH ${TASK_COMPLETION_CTE}
        SELECT
          COUNT(DISTINCT t.id) FILTER (WHERE tc.completed_at::date BETWEEN $${nextIndex}::date AND $${nextIndex + 1}::date) AS current_period,
          COUNT(DISTINCT t.id) FILTER (WHERE tc.completed_at::date BETWEEN $${nextIndex + 2}::date AND $${nextIndex + 3}::date) AS previous_period
        ${BASE_JOIN}
        JOIN task_completion tc ON tc.task_id = t.id
        ${whereNoDate}
      `, [...compParams, filters.date_from, filters.date_to, prevFrom.toISOString().slice(0, 10), prevTo.toISOString().slice(0, 10)]);

      comparison = {
        current: parseInt(compRes.rows[0].current_period),
        previous: parseInt(compRes.rows[0].previous_period),
      };
    }

    res.json({
      active_tasks: parseInt(row.active_tasks),
      completed_tasks: completed,
      overdue_tasks: parseInt(row.overdue_tasks),
      active_collaborators: parseInt(row.active_collaborators),
      progress_pct: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
      pending_load: parseInt(row.active_tasks),
      completed_comparison: comparison,
    });
  } catch (error) {
    console.error('Work plan summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/work-plan/workload
 * Carga activa por colaborador, con desglose por estado y carga ponderada por prioridad.
 */
export const getWorkload = async (req: AuthRequest, res: Response) => {
  try {
    const filters = readFilters(req.query);
    const { where, params } = buildConditions(filters, 1, { requireActiveAssignee: true });

    const result = await query(`
      SELECT
        p.id AS collaborator_id, p.full_name, p.avatar_url, p.cargo,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = false) AS active_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'Sin iniciar') AS sin_iniciar,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'En proceso') AS en_proceso,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'En revisión') AS en_revision,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = false AND t.due_date < CURRENT_DATE) AS vencidas,
        COALESCE(SUM(CASE WHEN ts.is_completed = false THEN
          CASE t.priority WHEN 'low' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
        ELSE 0 END), 0) AS carga_ponderada
      ${BASE_JOIN}
      ${where}
      GROUP BY p.id
      HAVING COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = false) > 0
      ORDER BY active_tasks DESC
    `, params);

    res.json(result.rows.map(r => ({
      collaborator_id: r.collaborator_id,
      full_name: r.full_name,
      avatar_url: r.avatar_url,
      cargo: r.cargo,
      active_tasks: parseInt(r.active_tasks),
      sin_iniciar: parseInt(r.sin_iniciar),
      en_proceso: parseInt(r.en_proceso),
      en_revision: parseInt(r.en_revision),
      vencidas: parseInt(r.vencidas),
      carga_ponderada: parseInt(r.carga_ponderada),
    })));
  } catch (error) {
    console.error('Work plan workload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/work-plan/status-distribution
 */
export const getStatusDistribution = async (req: AuthRequest, res: Response) => {
  try {
    const filters = readFilters(req.query);
    const { where, params } = buildConditions(filters, 1);

    const result = await query(`
      SELECT ts.id, ts.name, ts.color, COUNT(DISTINCT t.id) AS count
      ${BASE_JOIN}
      ${where}
      GROUP BY ts.id
      ORDER BY ts.display_order
    `, params);

    const rows = result.rows.map(r => ({ id: r.id, name: r.name, color: r.color, count: parseInt(r.count) }));
    res.json({ statuses: rows, total: rows.reduce((s, r) => s + r.count, 0) });
  } catch (error) {
    console.error('Work plan status distribution error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const WEEKS_BACK = 52;

const EVOLUTION_WEEKS_BACK = 2;

/**
 * GET /api/reports/work-plan/evolution
 * Planificadas (due_date cae en la semana) vs completadas (evento real de
 * finalización cae en la semana), últimas 2 semanas -- ventana corta a pedido
 * explícito del usuario para que esta gráfica se lea como pulso reciente, no
 * como histórico completo (para eso está la tabla operativa y el resto del
 * módulo, que sí usa la ventana amplia de WEEKS_BACK). "Planificadas" usa
 * due_date porque no existe un campo de fecha de planificación separado.
 *
 * IMPORTANTE: ignora el filtro de periodo (date_from/date_to) del selector
 * rápido -- esta gráfica necesita su propia ventana fija para tener sentido
 * como tendencia, así que aplicar "Esta semana" encima la dejaba vacía. Sí
 * respeta el resto de filtros (proyecto, equipo, cargo, etc.).
 */
export const getEvolution = async (req: AuthRequest, res: Response) => {
  try {
    const filters = { ...readFilters(req.query), date_from: undefined, date_to: undefined };
    const { where: whereBase, params: baseParams } = buildConditions(filters, 1);

    const plannedRes = await query(`
      SELECT date_trunc('week', t.due_date)::date AS week, COUNT(DISTINCT t.id) AS count
      ${BASE_JOIN}
      ${whereBase ? `${whereBase} AND` : 'WHERE'} t.due_date >= CURRENT_DATE - INTERVAL '${EVOLUTION_WEEKS_BACK} weeks'
      GROUP BY 1 ORDER BY 1
    `, baseParams);

    const { where: whereComp, params: compParams } = buildConditions(filters, 1);
    const completedRes = await query(`
      WITH ${TASK_COMPLETION_CTE}
      SELECT date_trunc('week', tc.completed_at)::date AS week, COUNT(DISTINCT t.id) AS count
      ${BASE_JOIN}
      JOIN task_completion tc ON tc.task_id = t.id
      ${whereComp ? `${whereComp} AND` : 'WHERE'} tc.completed_at >= CURRENT_DATE - INTERVAL '${EVOLUTION_WEEKS_BACK} weeks'
      GROUP BY 1 ORDER BY 1
    `, compParams);

    const weeks: string[] = [];
    const start = new Date();
    start.setDate(start.getDate() - EVOLUTION_WEEKS_BACK * 7);
    const cursor = new Date(start);
    // Alinear al lunes de esa semana
    const day = cursor.getDay();
    cursor.setDate(cursor.getDate() - ((day + 6) % 7));
    for (let i = 0; i <= EVOLUTION_WEEKS_BACK; i++) {
      weeks.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 7);
    }

    const plannedMap = new Map(plannedRes.rows.map(r => [r.week.toISOString().slice(0, 10), parseInt(r.count)]));
    const completedMap = new Map(completedRes.rows.map(r => [r.week.toISOString().slice(0, 10), parseInt(r.count)]));

    const fmt = (iso: string) => {
      const d = new Date(iso + 'T00:00:00');
      return `Sem ${d.getDate()}/${d.getMonth() + 1}`;
    };

    res.json([
      { id: 'Planificadas', data: weeks.map(w => ({ x: fmt(w), y: plannedMap.get(w) ?? 0 })) },
      { id: 'Completadas', data: weeks.map(w => ({ x: fmt(w), y: completedMap.get(w) ?? 0 })) },
    ]);
  } catch (error) {
    console.error('Work plan evolution error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/work-plan/planned-vs-completed
 * Por colaborador: planificadas (due_date en el rango) vs completadas (en el rango).
 */
export const getPlannedVsCompleted = async (req: AuthRequest, res: Response) => {
  try {
    const filters = readFilters(req.query);
    const { where, params } = buildConditions(filters, 1, { requireActiveAssignee: true });

    const result = await query(`
      WITH ${TASK_COMPLETION_CTE}
      SELECT
        p.id AS collaborator_id, p.full_name,
        COUNT(DISTINCT t.id) AS planificadas,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = true) AS completadas
      ${BASE_JOIN}
      LEFT JOIN task_completion tc ON tc.task_id = t.id
      ${where}
      GROUP BY p.id
      ORDER BY planificadas DESC
    `, params);

    res.json(result.rows.map(r => ({
      collaborator_id: r.collaborator_id,
      full_name: r.full_name,
      planificadas: parseInt(r.planificadas),
      completadas: parseInt(r.completadas),
      cumplimiento_pct: parseInt(r.planificadas) > 0
        ? Math.round((parseInt(r.completadas) / parseInt(r.planificadas)) * 10000) / 100
        : 0,
    })));
  } catch (error) {
    console.error('Work plan planned-vs-completed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/work-plan/status-by-collaborator
 * Distribución de estados apilada por colaborador.
 */
export const getStatusByCollaborator = async (req: AuthRequest, res: Response) => {
  try {
    const filters = readFilters(req.query);
    const { where, params } = buildConditions(filters, 1, { requireActiveAssignee: true });

    const result = await query(`
      SELECT
        p.id AS collaborator_id, p.full_name,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'Sin iniciar') AS sin_iniciar,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'En proceso') AS en_proceso,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'En pausa') AS en_pausa,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'En revisión') AS en_revision,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'Ajustes') AS ajustes,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = true) AS completado
      ${BASE_JOIN}
      ${where}
      GROUP BY p.id
      HAVING COUNT(DISTINCT t.id) > 0
      ORDER BY (COUNT(DISTINCT t.id)) DESC
    `, params);

    res.json(result.rows.map(r => ({
      collaborator_id: r.collaborator_id,
      full_name: r.full_name,
      sin_iniciar: parseInt(r.sin_iniciar),
      en_proceso: parseInt(r.en_proceso),
      en_pausa: parseInt(r.en_pausa),
      en_revision: parseInt(r.en_revision),
      ajustes: parseInt(r.ajustes),
      completado: parseInt(r.completado),
    })));
  } catch (error) {
    console.error('Work plan status-by-collaborator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/work-plan/collaborator-project-matrix
 * Nivo heatmap format: one row per collaborator, one column value per project.
 */
export const getCollaboratorProjectMatrix = async (req: AuthRequest, res: Response) => {
  try {
    const filters = readFilters(req.query);
    const dimension = req.query.dimension === 'materia' ? 'materia' : 'project';
    const { where, params } = buildConditions(filters, 1, { requireActiveAssignee: true });

    // Por materia: solo cuentan tareas que sí están vinculadas a una asignatura
    // (directo o vía material/tema) -- una tarea sin ese vínculo no tiene cómo
    // aparecer aquí, es la misma limitación ya documentada en todo el módulo.
    const colIdExpr = dimension === 'materia' ? 'asig.id' : 'proj.id';
    const colNameExpr = dimension === 'materia' ? 'asig.name' : 'proj.name';
    const extraCond = dimension === 'materia' ? 'AND asig.id IS NOT NULL' : '';
    // Por proyecto: mide carga activa (workload actual). Por materia: la gran mayoría
    // del trabajo vinculado a materias ya está Finalizado (migraciones históricas de
    // contenido), así que forzar solo activas dejaría la vista vacía para casi todos
    // los cargos -- aquí se muestra toda la participación (activa + finalizada),
    // respetando el filtro de Estado si el usuario elige uno explícitamente.
    const statusCond = dimension === 'materia' ? '' : 'AND ts.is_completed = false';

    const result = await query(`
      SELECT p.id AS collaborator_id, p.full_name,
        ${colIdExpr} AS col_id, ${colNameExpr} AS col_name,
        COUNT(DISTINCT t.id) AS task_count,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'En proceso') AS en_proceso,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = false AND t.due_date < CURRENT_DATE) AS vencidas
      ${BASE_JOIN}
      ${where} ${statusCond} ${extraCond}
      GROUP BY p.id, ${colIdExpr}, ${colNameExpr}
      ORDER BY p.full_name
    `, params);

    // Top N columnas por volumen total, para no saturar la matriz.
    const colTotals = new Map<string, { name: string; total: number }>();
    for (const r of result.rows) {
      const cur = colTotals.get(r.col_id) ?? { name: r.col_name, total: 0 };
      cur.total += parseInt(r.task_count);
      colTotals.set(r.col_id, cur);
    }
    const TOP_N = 15;
    const topColIds = new Set(
      Array.from(colTotals.entries()).sort((a, b) => b[1].total - a[1].total).slice(0, TOP_N).map(([id]) => id)
    );

    interface MatrixCellData { col_name: string; task_count: number; en_proceso: number; vencidas: number }
    const byCollaborator = new Map<string, { id: string; data: Record<string, MatrixCellData> }>();
    for (const r of result.rows) {
      if (!topColIds.has(r.col_id)) continue;
      let entry = byCollaborator.get(r.collaborator_id);
      if (!entry) { entry = { id: r.full_name, data: {} }; byCollaborator.set(r.collaborator_id, entry); }
      entry.data[r.col_id] = {
        col_name: r.col_name,
        task_count: parseInt(r.task_count),
        en_proceso: parseInt(r.en_proceso),
        vencidas: parseInt(r.vencidas),
      };
    }

    const columns = Array.from(topColIds).map(id => ({ id, name: colTotals.get(id)!.name }));
    const rows = Array.from(byCollaborator.values()).map(entry => ({
      id: entry.id,
      data: columns.map(col => ({
        x: col.name,
        y: entry.data[col.id]?.task_count ?? 0,
        en_proceso: entry.data[col.id]?.en_proceso ?? 0,
        vencidas: entry.data[col.id]?.vencidas ?? 0,
      })),
    }));

    res.json({ rows, total_projects: colTotals.size, shown_projects: columns.length, dimension });
  } catch (error) {
    console.error('Work plan matrix error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/work-plan/production-progress
 * Programas / Materias / Gránulos / Materiales — total, completado, pendiente, % avance.
 * Opcionalmente filtrado por project_id/programa_id para drill-down.
 */
export const getProductionProgress = async (req: AuthRequest, res: Response) => {
  try {
    const filters = readFilters(req.query);
    const projectCond = filters.project_id ? 'AND pr.project_id = $1::uuid' : '';
    const programaCond = filters.programa_id ? `AND pr.id = $${filters.project_id ? 2 : 1}::uuid` : '';
    const params = [filters.project_id, filters.programa_id].filter(Boolean);

    const programasRes = await query(`
      SELECT COUNT(*) AS total
      FROM public.programas pr
      WHERE 1=1 ${projectCond} ${programaCond}
    `, params);

    const restRes = await query(`
      SELECT
        COUNT(DISTINCT a.id) AS asignaturas_total,
        COUNT(DISTINCT a.id) FILTER (WHERE a.completado) AS asignaturas_completadas,
        COUNT(DISTINCT tm.id) AS temas_total,
        COUNT(DISTINCT tm.id) FILTER (WHERE tm.completado) AS temas_completados,
        COUNT(DISTINCT mr.id) AS materiales_total,
        COUNT(DISTINCT mr.id) FILTER (WHERE mr.completado) AS materiales_completados
      FROM public.programas pr
      LEFT JOIN public.asignaturas a ON a.programa_id = pr.id
      LEFT JOIN public.temas tm ON tm.asignatura_id = a.id
      LEFT JOIN public.materiales_requeridos mr ON mr.tema_id = tm.id
      WHERE 1=1 ${projectCond} ${programaCond}
    `, params);

    const r = restRes.rows[0];
    const build = (total: number, completed: number) => ({
      total, completed, pending: total - completed,
      progress_pct: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
    });

    res.json({
      programas: build(parseInt(programasRes.rows[0].total), 0),
      materias: build(parseInt(r.asignaturas_total), parseInt(r.asignaturas_completadas)),
      granulos: build(parseInt(r.temas_total), parseInt(r.temas_completados)),
      materiales: build(parseInt(r.materiales_total), parseInt(r.materiales_completados)),
    });
  } catch (error) {
    console.error('Work plan production progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/work-plan/production-velocity?metric=tareas|materias|granulos|materiales
 * Elementos completados por semana, últimas 8 semanas. Para materias/gránulos/
 * materiales se usa `updated_at` (con completado=true) como aproximación porque
 * no existe un campo `completed_at` dedicado — no hay forma de saber con certeza
 * cuándo se completó salvo por la última edición del registro.
 */
export const getProductionVelocity = async (req: AuthRequest, res: Response) => {
  try {
    const metric = String(req.query.metric ?? 'tareas');
    let sql = '';
    if (metric === 'tareas') {
      sql = `
        WITH ${TASK_COMPLETION_CTE}
        SELECT date_trunc('week', tc.completed_at)::date AS week, COUNT(DISTINCT t.id) AS count
        FROM public.tasks t
        JOIN task_completion tc ON tc.task_id = t.id
        WHERE tc.completed_at >= CURRENT_DATE - INTERVAL '${WEEKS_BACK} weeks'
        GROUP BY 1 ORDER BY 1
      `;
    } else if (metric === 'materias') {
      sql = `
        SELECT date_trunc('week', updated_at)::date AS week, COUNT(*) AS count
        FROM public.asignaturas WHERE completado = true AND updated_at >= CURRENT_DATE - INTERVAL '${WEEKS_BACK} weeks'
        GROUP BY 1 ORDER BY 1
      `;
    } else if (metric === 'granulos') {
      sql = `
        SELECT date_trunc('week', updated_at)::date AS week, COUNT(*) AS count
        FROM public.temas WHERE completado = true AND updated_at >= CURRENT_DATE - INTERVAL '${WEEKS_BACK} weeks'
        GROUP BY 1 ORDER BY 1
      `;
    } else if (metric === 'materiales') {
      sql = `
        SELECT date_trunc('week', updated_at)::date AS week, COUNT(*) AS count
        FROM public.materiales_requeridos WHERE completado = true AND updated_at >= CURRENT_DATE - INTERVAL '${WEEKS_BACK} weeks'
        GROUP BY 1 ORDER BY 1
      `;
    } else {
      return res.status(400).json({ error: 'metric inválido' });
    }

    const result = await query(sql);
    const map = new Map(result.rows.map(r => [r.week.toISOString().slice(0, 10), parseInt(r.count)]));

    const weeks: string[] = [];
    const cursor = new Date();
    cursor.setDate(cursor.getDate() - WEEKS_BACK * 7);
    const day = cursor.getDay();
    cursor.setDate(cursor.getDate() - ((day + 6) % 7));
    for (let i = 0; i <= WEEKS_BACK; i++) { weeks.push(cursor.toISOString().slice(0, 10)); cursor.setDate(cursor.getDate() + 7); }

    const fmt = (iso: string) => { const d = new Date(iso + 'T00:00:00'); return `Sem ${d.getDate()}/${d.getMonth() + 1}`; };

    res.json({
      metric,
      is_approximate: metric !== 'tareas',
      data: [{ id: metric, data: weeks.map(w => ({ x: fmt(w), y: map.get(w) ?? 0 })) }],
    });
  } catch (error) {
    console.error('Work plan velocity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/work-plan/activity
 * Feed reciente + serie diaria de cambios de estado, últimos 14 días.
 */
export const getActivity = async (req: AuthRequest, res: Response) => {
  try {
    const [countsRes, dailyRes, feedRes] = await Promise.all([
      query(`
        SELECT
          COUNT(*) FILTER (WHERE started_at >= NOW() - INTERVAL '24 hours') AS last_24h,
          COUNT(*) FILTER (WHERE started_at >= NOW() - INTERVAL '7 days') AS last_7d
        FROM public.task_status_history
      `),
      query(`
        SELECT date_trunc('day', started_at)::date AS day, COUNT(*) AS count
        FROM public.task_status_history
        WHERE started_at >= CURRENT_DATE - INTERVAL '14 days'
        GROUP BY 1 ORDER BY 1
      `),
      query(`
        SELECT tsh.id, tsh.started_at, p.full_name, t.title, t.id AS task_id,
          fs.name AS from_status, ts2.name AS to_status
        FROM public.task_status_history tsh
        JOIN public.tasks t ON t.id = tsh.task_id
        LEFT JOIN public.profiles p ON p.id = tsh.changed_by
        LEFT JOIN public.task_statuses fs ON fs.id = tsh.from_status_id
        JOIN public.task_statuses ts2 ON ts2.id = tsh.to_status_id
        ORDER BY tsh.started_at DESC
        LIMIT 20
      `),
    ]);

    const dayMap = new Map(dailyRes.rows.map(r => [r.day.toISOString().slice(0, 10), parseInt(r.count)]));
    const days: string[] = [];
    const cursor = new Date();
    cursor.setDate(cursor.getDate() - 13);
    for (let i = 0; i < 14; i++) { days.push(cursor.toISOString().slice(0, 10)); cursor.setDate(cursor.getDate() + 1); }
    const fmt = (iso: string) => { const d = new Date(iso + 'T00:00:00'); return `${d.getDate()}/${d.getMonth() + 1}`; };

    res.json({
      last_24h: parseInt(countsRes.rows[0].last_24h),
      last_7d: parseInt(countsRes.rows[0].last_7d),
      daily: [{ id: 'Cambios de estado', data: days.map(d => ({ x: fmt(d), y: dayMap.get(d) ?? 0 })) }],
      feed: feedRes.rows.map(r => ({
        id: r.id,
        started_at: r.started_at,
        full_name: r.full_name ?? 'Usuario',
        task_id: r.task_id,
        title: r.title,
        from_status: r.from_status,
        to_status: r.to_status,
      })),
    });
  } catch (error) {
    console.error('Work plan activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/work-plan/collaborators
 * Filas compactas por colaborador para "Plan de trabajo por persona".
 */
export const getCollaboratorRows = async (req: AuthRequest, res: Response) => {
  try {
    const filters = readFilters(req.query);
    const { where, params } = buildConditions(filters, 1, { requireActiveAssignee: true });

    const result = await query(`
      SELECT
        p.id AS collaborator_id, p.full_name, p.avatar_url, p.cargo,
        COUNT(DISTINCT t.id) AS total_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = true) AS completadas,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'En proceso') AS en_proceso,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'En revisión') AS en_revision,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = false AND t.due_date < CURRENT_DATE) AS vencidas,
        COUNT(DISTINCT prog.id) AS programas_count,
        COUNT(DISTINCT asig.id) AS materias_count,
        MAX(t.updated_at) AS last_activity
      ${BASE_JOIN}
      ${where}
      GROUP BY p.id
      HAVING COUNT(DISTINCT t.id) > 0
      ORDER BY total_tasks DESC
    `, params);

    res.json(result.rows.map(r => {
      const total = parseInt(r.total_tasks);
      const completadas = parseInt(r.completadas);
      return {
        collaborator_id: r.collaborator_id,
        full_name: r.full_name,
        avatar_url: r.avatar_url,
        cargo: r.cargo,
        total_tasks: total,
        completadas,
        en_proceso: parseInt(r.en_proceso),
        en_revision: parseInt(r.en_revision),
        vencidas: parseInt(r.vencidas),
        programas_count: parseInt(r.programas_count),
        materias_count: parseInt(r.materias_count),
        progress_pct: total > 0 ? Math.round((completadas / total) * 10000) / 100 : 0,
        last_activity: r.last_activity,
      };
    }));
  } catch (error) {
    console.error('Work plan collaborators error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/work-plan/collaborator/:id
 * Detalle para el drawer: KPIs, evolución, estado (pie) y tabla completa de tareas.
 */
export const getCollaboratorDetail = async (req: AuthRequest, res: Response) => {
  try {
    const collaboratorId = validUuidOrNull(req.params.id);
    if (!collaboratorId) return res.status(400).json({ error: 'id inválido' });

    const profileRes = await query(`
      SELECT p.id, p.full_name, p.avatar_url, p.cargo, u.email,
        team.id AS team_id, team.name AS team_name
      FROM public.profiles p
      LEFT JOIN public.users u ON u.id = p.user_id
      LEFT JOIN public.tasks t2 ON t2.assignee_id = p.id AND t2.team_id IS NOT NULL
      LEFT JOIN public.teams team ON team.id = t2.team_id
      WHERE p.id = $1
      GROUP BY p.id, u.email, team.id, team.name
      LIMIT 1
    `, [collaboratorId]);
    if (profileRes.rows.length === 0) return res.status(404).json({ error: 'Colaborador no encontrado' });

    const kpiRes = await query(`
      SELECT
        COUNT(DISTINCT t.id) AS asignadas,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'En proceso') AS en_proceso,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = true) AS completadas,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = false AND t.due_date < CURRENT_DATE) AS vencidas
      FROM public.tasks t
      JOIN public.task_statuses ts ON ts.id = t.status_id
      WHERE t.assignee_id = $1
    `, [collaboratorId]);

    const evolutionRes = await query(`
      WITH ${TASK_COMPLETION_CTE}
      SELECT date_trunc('week', tc.completed_at)::date AS week, COUNT(DISTINCT t.id) AS count
      FROM public.tasks t
      JOIN task_completion tc ON tc.task_id = t.id
      WHERE t.assignee_id = $1 AND tc.completed_at >= CURRENT_DATE - INTERVAL '${WEEKS_BACK} weeks'
      GROUP BY 1 ORDER BY 1
    `, [collaboratorId]);

    const statusRes = await query(`
      SELECT ts.name, ts.color, COUNT(*) AS count
      FROM public.tasks t JOIN public.task_statuses ts ON ts.id = t.status_id
      WHERE t.assignee_id = $1
      GROUP BY ts.id ORDER BY ts.display_order
    `, [collaboratorId]);

    const tasksRes = await query(`
      SELECT t.id, t.title, t.priority, ts.name AS status_name, ts.color AS status_color,
        proj.name AS project_name, prog.name AS programa_name, asig.name AS materia_name,
        tema.title AS granulo_name, sp.name AS sprint_name, t.due_date, t.updated_at
      ${BASE_JOIN}
      LEFT JOIN public.sprints sp ON sp.id = t.sprint_id
      WHERE t.assignee_id = $1
      ORDER BY t.due_date NULLS LAST
      LIMIT 200
    `, [collaboratorId]);

    const kpi = kpiRes.rows[0];
    const asignadas = parseInt(kpi.asignadas);
    const completadas = parseInt(kpi.completadas);

    const weeks: string[] = [];
    const cursor = new Date();
    cursor.setDate(cursor.getDate() - WEEKS_BACK * 7);
    const day = cursor.getDay();
    cursor.setDate(cursor.getDate() - ((day + 6) % 7));
    for (let i = 0; i <= WEEKS_BACK; i++) { weeks.push(cursor.toISOString().slice(0, 10)); cursor.setDate(cursor.getDate() + 7); }
    const evoMap = new Map(evolutionRes.rows.map(r => [r.week.toISOString().slice(0, 10), parseInt(r.count)]));
    const fmt = (iso: string) => { const d = new Date(iso + 'T00:00:00'); return `Sem ${d.getDate()}/${d.getMonth() + 1}`; };

    res.json({
      profile: profileRes.rows[0],
      kpis: {
        asignadas,
        en_proceso: parseInt(kpi.en_proceso),
        completadas,
        vencidas: parseInt(kpi.vencidas),
        progress_pct: asignadas > 0 ? Math.round((completadas / asignadas) * 10000) / 100 : 0,
      },
      evolution: [{ id: 'Completadas', data: weeks.map(w => ({ x: fmt(w), y: evoMap.get(w) ?? 0 })) }],
      status_distribution: statusRes.rows.map(r => ({ name: r.name, color: r.color, count: parseInt(r.count) })),
      tasks: tasksRes.rows,
    });
  } catch (error) {
    console.error('Work plan collaborator detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/work-plan/alerts
 * Reglas deterministas — sin IA, sin inventar campos que no existen (no hay
 * estado "Bloqueado" en el sistema real, así que esa regla no se incluye).
 */
export const getAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const filters = readFilters(req.query);
    const { where, params, nextIndex } = buildConditions(filters, 1);

    const [overdueRes, noAssigneeRes, noMovementRes, noActivityProjectsRes, lowProgressRes, concentrationRes, dueSoonRes] = await Promise.all([
      query(`SELECT COUNT(DISTINCT t.id) AS count ${BASE_JOIN} ${where ? `${where} AND` : 'WHERE'} ts.is_completed = false AND t.due_date < CURRENT_DATE`, params),
      query(`SELECT COUNT(DISTINCT t.id) AS count ${BASE_JOIN} ${where ? `${where} AND` : 'WHERE'} ts.is_completed = false AND t.assignee_id IS NULL`, params),
      query(`SELECT COUNT(DISTINCT t.id) AS count ${BASE_JOIN} ${where ? `${where} AND` : 'WHERE'} ts.is_completed = false AND t.updated_at < NOW() - INTERVAL '5 days'`, params),
      query(`
        SELECT COUNT(*) AS count FROM public.projects proj
        WHERE proj.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM public.tasks t2 WHERE t2.project_id = proj.id AND t2.updated_at >= NOW() - INTERVAL '14 days'
          )
      `),
      query(`
        SELECT COUNT(*) AS count FROM public.asignaturas a
        JOIN public.temas tm ON tm.asignatura_id = a.id
        GROUP BY a.id
        HAVING COUNT(*) >= 3 AND (COUNT(*) FILTER (WHERE tm.completado))::float / COUNT(*) < 0.1
      `).then(r => ({ rows: [{ count: r.rowCount }] })),
      query(`
        SELECT p.full_name, COUNT(DISTINCT t.id) AS active_tasks
        ${BASE_JOIN}
        ${where ? `${where} AND` : 'WHERE'} ts.is_completed = false AND u.id IS NOT NULL
        GROUP BY p.id
        HAVING COUNT(DISTINCT t.id) >= 20
        ORDER BY active_tasks DESC
        LIMIT 5
      `, params),
      query(`SELECT COUNT(DISTINCT t.id) AS count ${BASE_JOIN} ${where ? `${where} AND` : 'WHERE'} ts.is_completed = false AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'`, params),
    ]);

    res.json({
      overdue: { count: parseInt(overdueRes.rows[0].count) },
      no_assignee: { count: parseInt(noAssigneeRes.rows[0].count) },
      no_movement_5d: { count: parseInt(noMovementRes.rows[0].count) },
      inactive_projects: { count: parseInt(noActivityProjectsRes.rows[0].count) },
      low_progress_materias: { count: lowProgressRes.rows[0]?.count ?? 0 },
      high_concentration: concentrationRes.rows.map(r => ({ full_name: r.full_name, active_tasks: parseInt(r.active_tasks) })),
      due_soon: { count: parseInt(dueSoonRes.rows[0].count) },
    });
  } catch (error) {
    console.error('Work plan alerts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/work-plan/table
 * Tabla ejecutiva paginable/ordenable/buscable.
 */
export const getExecutiveTable = async (req: AuthRequest, res: Response) => {
  try {
    const filters = readFilters(req.query);
    const { where, params, nextIndex } = buildConditions(filters, 1, { requireActiveAssignee: true });

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const page = Math.max(1, parseInt(String(req.query.page ?? '1')) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.page_size ?? '25')) || 25));

    let searchClause = '';
    const searchParams = [...params];
    let idx = nextIndex;
    if (search) {
      searchClause = `${where ? 'AND' : 'WHERE'} p.full_name ILIKE $${idx}`;
      searchParams.push(`%${search}%`);
      idx++;
    }

    const baseQuery = `
      SELECT
        p.id AS collaborator_id, p.full_name, p.cargo, team.name AS team_name,
        COUNT(DISTINCT t.id) AS planificadas,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'Sin iniciar') AS sin_iniciar,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'En proceso') AS en_proceso,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.name = 'En revisión') AS en_revision,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = true) AS completadas,
        COUNT(DISTINCT t.id) FILTER (WHERE ts.is_completed = false AND t.due_date < CURRENT_DATE) AS vencidas,
        MAX(t.updated_at) AS last_activity
      ${BASE_JOIN}
      ${where} ${searchClause}
      GROUP BY p.id, team.name
    `;

    const countRes = await query(`SELECT COUNT(*) AS count FROM (${baseQuery}) sub`, searchParams);
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await query(`
      ${baseQuery}
      ORDER BY planificadas DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...searchParams, pageSize, (page - 1) * pageSize]);

    res.json({
      rows: dataRes.rows.map(r => {
        const planificadas = parseInt(r.planificadas);
        const completadas = parseInt(r.completadas);
        return {
          collaborator_id: r.collaborator_id,
          full_name: r.full_name,
          cargo: r.cargo,
          team_name: r.team_name,
          planificadas,
          sin_iniciar: parseInt(r.sin_iniciar),
          en_proceso: parseInt(r.en_proceso),
          en_revision: parseInt(r.en_revision),
          completadas,
          vencidas: parseInt(r.vencidas),
          cumplimiento_pct: planificadas > 0 ? Math.round((completadas / planificadas) * 10000) / 100 : 0,
          last_activity: r.last_activity,
        };
      }),
      total,
      page,
      page_size: pageSize,
    });
  } catch (error) {
    console.error('Work plan table error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/reports/work-plan/filters
 * Opciones para los selects de filtro global (proyectos, equipos, cargos, sprints, programas).
 */
export const getFilterOptions = async (req: AuthRequest, res: Response) => {
  try {
    const [projects, teams, cargos, sprints, programas, statuses] = await Promise.all([
      query(`SELECT id, name FROM public.projects WHERE status = 'active' ORDER BY name`),
      query(`SELECT id, name, project_id FROM public.teams ORDER BY name`),
      query(`SELECT DISTINCT cargo FROM public.profiles WHERE cargo IS NOT NULL ORDER BY cargo`),
      query(`SELECT id, name, project_id, status FROM public.sprints WHERE status != 'completed' ORDER BY start_date DESC`),
      query(`SELECT pr.id, pr.name, pr.project_id FROM public.programas pr ORDER BY pr.name LIMIT 500`),
      query(`SELECT id, name, color FROM public.task_statuses ORDER BY display_order`),
    ]);

    res.json({
      projects: projects.rows,
      teams: teams.rows,
      cargos: cargos.rows.map(r => r.cargo),
      sprints: sprints.rows,
      programas: programas.rows,
      statuses: statuses.rows,
      priorities: PRIORITIES,
    });
  } catch (error) {
    console.error('Work plan filter options error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
