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
    `SELECT
       COUNT(*) FILTER (WHERE ts.is_completed = false AND t.due_date = CURRENT_DATE)    AS due_today,
       COUNT(*) FILTER (WHERE ts.is_completed = false AND t.due_date < CURRENT_DATE)     AS overdue,
       COUNT(*) FILTER (WHERE ts.is_completed = false)                                   AS in_progress,
       COUNT(*) FILTER (WHERE ts.is_completed = false AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') AS due_week
     FROM public.tasks t
     JOIN public.task_statuses ts ON ts.id = t.status_id
     WHERE t.assignee_id = $1`,
    [profileId],
  );

  return result.rows[0];
}

async function getUserProjectsOverview(profileId: string) {
  const result = await query(
    `SELECT
       pr.id,
       pr.name,
       pr.key,
       COUNT(t.id)                                     AS total_tasks,
       COUNT(t.id) FILTER (WHERE ts.is_completed)      AS completed_tasks,
       COUNT(t.id) FILTER (WHERE NOT ts.is_completed)  AS pending_tasks
     FROM public.project_members pm
     JOIN public.projects pr ON pr.id = pm.project_id
     LEFT JOIN public.tasks t ON t.project_id = pr.id
     LEFT JOIN public.task_statuses ts ON ts.id = t.status_id
     WHERE pm.user_id = $1
     GROUP BY pr.id, pr.name, pr.key
     ORDER BY pr.created_at DESC
     LIMIT 10`,
    [profileId],
  );

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

function detectIntent(message: string): string {
  const text = message.toLowerCase();

  // Personas / quién tiene tareas en los proyectos
  if (
    text.includes('persona') ||
    text.includes('personas') ||
    text.includes('gente') ||
    text.includes('quién tiene') || // con tilde
    text.includes('quiénes tienen') || // con tilde y plural
    text.includes('quienes tienen') ||
    text.includes('quien tiene') ||
    text.includes('tareas asignadas') ||
    text.includes('más tareas') ||
    text.includes('tienen tareas') ||
    (text.includes('tareas') && (text.includes('en los proyectos') || text.includes('por proyecto')))
  ) {
    return 'PEOPLE_WITH_TASKS';
  }

  // Materiales completados / en proceso
  if (text.includes('material') || text.includes('materiales')) {
    return 'MATERIALS_SUMMARY';
  }

  if (text.includes('tarea') || text.includes('tareas')) {
    if (text.includes('hoy') || text.includes('vencen') || text.includes('vencidas') || text.includes('semana')) {
      return 'MY_TASKS_SUMMARY';
    }
    return 'MY_TASKS_GENERIC';
  }

  if (text.includes('proyecto') || text.includes('proyectos')) {
    return 'PROJECTS_OVERVIEW';
  }

  if (text.includes('equipo') || text.includes('carga') || text.includes('reporte')) {
    return 'TEAM_REPORTS';
  }

  return 'GENERIC';
}

export async function handleChatMessage(message: string, user: ChatUserContext): Promise<ChatResult> {
  const intent = detectIntent(message);
  const safeMessage = message.slice(0, 800);

  let contextJson: unknown = {};
  const isPrivileged = user.role === 'admin' || user.role === 'project_leader';

  try {
    if (intent === 'MY_TASKS_SUMMARY' && user.profileId) {
      const summary = await getMyTasksSummary(user.profileId);
      contextJson = { type: 'my_tasks_summary', summary };
    } else if (intent === 'PROJECTS_OVERVIEW' && user.profileId) {
      const projects = await getUserProjectsOverview(user.profileId);
      contextJson = { type: 'projects_overview', projects };
    } else if (intent === 'PEOPLE_WITH_TASKS') {
      if (isPrivileged) {
        const people = await getPeopleWithTasks();
        contextJson = { type: 'people_with_tasks', people };
      } else if (user.profileId) {
        // Usuarios normales no deben ver estadísticas globales de TODA la fábrica.
        // Les devolvemos un mensaje de permiso denegado específico.
        contextJson = {
          type: 'forbidden',
          scope: 'people_with_tasks',
          reason:
            'Solo administradores y líderes de proyecto pueden ver información global de todas las personas y sus tareas. Puedes preguntarme por tus propias tareas y proyectos.',
        };
      }
    } else if (intent === 'MATERIALS_SUMMARY') {
      if (isPrivileged) {
        const materials = await getMaterialsSummary();
        contextJson = { type: 'materials_summary', materials };
      } else {
        contextJson = {
          type: 'forbidden',
          scope: 'materials_summary',
          reason:
            'Solo administradores y líderes de proyecto pueden ver el resumen global de materiales. Puedes preguntarme por el estado de tus tareas y proyectos.',
        };
      }
    } else {
      contextJson = { type: 'none', note: 'No se ejecutó ninguna consulta específica.' };
    }
  } catch (error) {
    console.error('[chatOrchestrator] Error fetching context data:', error);
    contextJson = { type: 'error', note: 'Error al obtener datos desde la base de datos.' };
  }

  const systemInstructions = `
Eres un asistente de la Fábrica de Contenidos que responde preguntas sobre proyectos y tareas.
Solo puedes usar la información que te doy en el bloque JSON de contexto.
No inventes datos que no estén ahí. Responde siempre en español y de forma breve (máximo 6 líneas).

Usuario: ${user.email} (rol: ${user.role ?? 'user'}).
Intención detectada: ${intent}.
Pregunta original: "${safeMessage}".

Contexto (JSON):
\`\`\`json
${JSON.stringify(contextJson, null, 2)}
\`\`\`
`;

  const answer = await generateChatAnswer(systemInstructions);

  if (env.NODE_ENV !== 'production') {
    console.log('[chatOrchestrator] intent:', intent);
    console.log('[chatOrchestrator] context:', contextJson);
    console.log('[chatOrchestrator] answer:', answer);
  }

  return { intent, answer };
}

