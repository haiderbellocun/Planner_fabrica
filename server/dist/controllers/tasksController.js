import { query } from '../config/database.js';
import { env } from '../config/env.js';
import { sendTaskAssignedEmail, buildTaskAssignedHtml } from '../services/emailService.js';
import { checkStatusTransition } from '../utils/taskStatusTransitions.js';
import { ensureWatcher, notifyWatchers } from '../utils/taskWatchers.js';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
const oneOf = (v) => (Array.isArray(v) ? v[0] : v);
/** true si el profile existe y su usuario sigue activo -- una persona desactivada no puede
 * recibir tareas nuevas, aunque el request venga de una lista de asignados desactualizada
 * o de una llamada directa a la API. */
const isActiveProfile = async (profileId) => {
    const result = await query(`SELECT 1 FROM public.profiles p
     JOIN public.users u ON u.id = p.user_id AND u.is_active = true
     WHERE p.id = $1`, [profileId]);
    return result.rows.length > 0;
};
/**
 * GET /api/projects/:projectId/tasks
 * List all tasks for a project with full details
 */
export const listTasks = async (req, res) => {
    try {
        const { projectId } = req.params;
        const profileId = req.user?.profileId;
        const userRole = req.user?.role;
        // Check if user is project leader
        const isLeader = userRole !== 'admin' && (await query('SELECT public.is_project_leader($1::UUID, $2::UUID) as is_leader', [projectId, profileId])).rows[0]?.is_leader;
        if (env.NODE_ENV !== 'production') {
            console.log('=== LIST TASKS DEBUG ===');
            console.log('User email:', req.user?.email);
            console.log('Profile ID:', profileId);
            console.log('User role:', userRole);
            console.log('Is leader:', isLeader);
            console.log('Filters:', req.query);
        }
        // Build WHERE clause. Visibility is one condition among many so filters
        // can only narrow the result set, never widen it beyond what the role allows.
        const conditions = [];
        const params = [];
        let i = 1;
        conditions.push(`t.project_id = $${i++}`);
        params.push(projectId);
        if (userRole === 'admin' || userRole === 'project_leader' || isLeader) {
            if (env.NODE_ENV !== 'production') {
                console.log('No visibility filter (admin/leader sees all)');
            }
        }
        else {
            // Normal users: ONLY see tasks explicitly assigned to them, regardless of project category
            conditions.push(`(
        t.assignee_id = $${i}
        OR t.id IN (SELECT task_id FROM public.task_material_assignees WHERE assignee_id = $${i})
        OR t.id IN (SELECT task_id FROM public.task_tema_assignees WHERE assignee_id = $${i})
      )`);
            params.push(profileId);
            i++;
            if (env.NODE_ENV !== 'production') {
                console.log('Visibility filter applied for normal user');
            }
        }
        // --- Optional filters (all bound as parameters, never string-concatenated) ---
        const statusIdRaw = oneOf(req.query.status_id);
        if (statusIdRaw) {
            const ids = statusIdRaw.split(',').map((s) => s.trim()).filter(isUuid);
            if (ids.length > 0) {
                conditions.push(`t.status_id = ANY($${i++}::uuid[])`);
                params.push(ids);
            }
        }
        const priorityRaw = oneOf(req.query.priority);
        if (priorityRaw) {
            const values = priorityRaw.split(',').map((s) => s.trim()).filter((v) => PRIORITIES.includes(v));
            if (values.length > 0) {
                conditions.push(`t.priority = ANY($${i++}::task_priority[])`);
                params.push(values);
            }
        }
        const assigneeRaw = oneOf(req.query.assignee_id);
        if (assigneeRaw === 'unassigned') {
            conditions.push('t.assignee_id IS NULL');
        }
        else if (isUuid(assigneeRaw)) {
            conditions.push(`t.assignee_id = $${i++}::uuid`);
            params.push(assigneeRaw);
        }
        const epicRaw = oneOf(req.query.epic_id);
        if (epicRaw === 'none') {
            conditions.push('t.epic_id IS NULL');
        }
        else if (isUuid(epicRaw)) {
            conditions.push(`t.epic_id = $${i++}::uuid`);
            params.push(epicRaw);
        }
        const teamRaw = oneOf(req.query.team_id);
        if (teamRaw === 'none') {
            conditions.push('t.team_id IS NULL');
        }
        else if (isUuid(teamRaw)) {
            conditions.push(`t.team_id = $${i++}::uuid`);
            params.push(teamRaw);
        }
        const sprintRaw = oneOf(req.query.sprint_id);
        if (sprintRaw === 'none') {
            conditions.push('t.sprint_id IS NULL');
        }
        else if (isUuid(sprintRaw)) {
            conditions.push(`t.sprint_id = $${i++}::uuid`);
            params.push(sprintRaw);
        }
        const tagRaw = oneOf(req.query.tag);
        if (tagRaw) {
            conditions.push(`$${i++} = ANY(t.tags)`);
            params.push(tagRaw);
        }
        const searchRaw = oneOf(req.query.search);
        if (searchRaw && searchRaw.trim()) {
            const q = searchRaw.trim();
            if (/^\d+$/.test(q)) {
                conditions.push(`(t.title ILIKE $${i} OR t.description ILIKE $${i} OR t.task_number = $${i + 1}::int)`);
                params.push(`%${q}%`, parseInt(q, 10));
                i += 2;
            }
            else {
                conditions.push(`(t.title ILIKE $${i} OR t.description ILIKE $${i})`);
                params.push(`%${q}%`);
                i++;
            }
        }
        const result = await query(`SELECT
        t.*,
        t.epic_id,
        t.board_rank::float8 AS board_rank,
        t.backlog_rank::float8 AS backlog_rank,
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
        prog.id as programa_id, prog.name as programa_name, prog.code as programa_code, prog.tipo_programa as programa_tipo,
        ep.id as ep_epic_id, ep.title as epic_title, ep.color as epic_color, ep.status as epic_status,
        tm.id as tm_team_id, tm.name as team_name, tm.color as team_color,
        sp.id as sp_sprint_id, sp.name as sprint_name, sp.status as sprint_status,
        (SELECT COUNT(*)::int FROM public.tasks st WHERE st.subtask_of_id = t.id) AS subtask_count,
        (SELECT COUNT(*)::int FROM public.tasks st
           JOIN public.task_statuses sts ON sts.id = st.status_id
           WHERE st.subtask_of_id = t.id AND sts.is_completed = true) AS subtask_completed_count
       FROM public.tasks t
       JOIN public.task_statuses ts ON ts.id = t.status_id
       LEFT JOIN public.profiles assignee ON assignee.id = t.assignee_id
       LEFT JOIN public.profiles reporter ON reporter.id = t.reporter_id
       LEFT JOIN public.materiales_requeridos mr ON mr.id = t.material_requerido_id
       LEFT JOIN public.material_types mt ON mt.id = mr.material_type_id
       LEFT JOIN public.temas tema ON tema.id = mr.tema_id
       LEFT JOIN public.asignaturas asig ON asig.id = t.asignatura_id OR asig.id = tema.asignatura_id OR asig.id = mr.asignatura_id
       LEFT JOIN public.programas prog ON prog.id = asig.programa_id
       LEFT JOIN public.epics ep ON ep.id = t.epic_id
       LEFT JOIN public.teams tm ON tm.id = t.team_id
       LEFT JOIN public.sprints sp ON sp.id = t.sprint_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.board_rank ASC NULLS LAST, t.created_at DESC`, params);
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
            epic_id: row.epic_id,
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
            board_rank: row.board_rank,
            backlog_rank: row.backlog_rank,
            created_at: row.created_at,
            updated_at: row.updated_at,
            material_requerido_id: row.material_requerido_id,
            asignatura_id: row.asignatura_id,
            parent_task_id: row.parent_task_id,
            subtask_of_id: row.subtask_of_id,
            subtask_count: row.subtask_count ?? 0,
            subtask_completed_count: row.subtask_completed_count ?? 0,
            horas_estimadas: row.horas_estimadas != null ? Number(row.horas_estimadas) : null,
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
            epic: row.ep_epic_id
                ? {
                    id: row.ep_epic_id,
                    title: row.epic_title,
                    color: row.epic_color,
                    status: row.epic_status,
                }
                : null,
            team_id: row.team_id,
            team: row.tm_team_id
                ? {
                    id: row.tm_team_id,
                    name: row.team_name,
                    color: row.team_color,
                }
                : null,
            sprint_id: row.sprint_id,
            sprint: row.sp_sprint_id
                ? {
                    id: row.sp_sprint_id,
                    name: row.sprint_name,
                    status: row.sprint_status,
                }
                : null,
        }));
        if (env.NODE_ENV !== 'production') {
            console.log('Returning', tasks.length, 'tasks');
            console.log('=== END DEBUG ===\n');
        }
        res.json(tasks);
    }
    catch (error) {
        console.error('List tasks error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * GET /api/tasks/:id
 * Get single task with full details
 */
export const getTask = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(`SELECT
        t.*,
        t.board_rank::float8 AS board_rank,
        t.backlog_rank::float8 AS backlog_rank,
        ts.id as status_id, ts.name as status_name, ts.color as status_color,
        ts.display_order as status_order, ts.is_completed as status_is_completed,
        ep.id as epic_id_ref, ep.title as epic_title, ep.color as epic_color, ep.status as epic_status,
        assignee.id as assignee_id, assignee.full_name as assignee_name,
        assignee.avatar_url as assignee_avatar, assignee.email as assignee_email, assignee.cargo as assignee_cargo,
        reporter.id as reporter_id, reporter.full_name as reporter_name,
        reporter.avatar_url as reporter_avatar, reporter.email as reporter_email,
        mr.id as material_id, mr.descripcion as material_descripcion,
        mt.id as material_type_id, mt.name as material_type_name, mt.icon as material_type_icon,
        tema.id as tema_id, tema.title as tema_title,
        asig.id as asignatura_id, asig.name as asignatura_name, asig.code as asignatura_code, asig.semestre as asignatura_semestre,
        prog.id as programa_id, prog.name as programa_name, prog.code as programa_code, prog.tipo_programa as programa_tipo,
        tm.id as team_id_ref, tm.name as team_name, tm.color as team_color,
        sp.id as sprint_id_ref, sp.name as sprint_name, sp.status as sprint_status
       FROM public.tasks t
       JOIN public.task_statuses ts ON ts.id = t.status_id
       LEFT JOIN public.epics ep ON ep.id = t.epic_id
       LEFT JOIN public.teams tm ON tm.id = t.team_id
       LEFT JOIN public.sprints sp ON sp.id = t.sprint_id
       LEFT JOIN public.profiles assignee ON assignee.id = t.assignee_id
       LEFT JOIN public.profiles reporter ON reporter.id = t.reporter_id
       LEFT JOIN public.materiales_requeridos mr ON mr.id = t.material_requerido_id
       LEFT JOIN public.material_types mt ON mt.id = mr.material_type_id
       LEFT JOIN public.temas tema ON tema.id = mr.tema_id
       LEFT JOIN public.asignaturas asig ON asig.id = t.asignatura_id OR asig.id = tema.asignatura_id OR asig.id = mr.asignatura_id
       LEFT JOIN public.programas prog ON prog.id = asig.programa_id
       WHERE t.id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const row = result.rows[0];
        const task = {
            id: row.id,
            project_id: row.project_id,
            epic_id: row.epic_id,
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
            board_rank: row.board_rank,
            backlog_rank: row.backlog_rank,
            created_at: row.created_at,
            updated_at: row.updated_at,
            material_requerido_id: row.material_requerido_id,
            asignatura_id: row.asignatura_id,
            parent_task_id: row.parent_task_id,
            subtask_of_id: row.subtask_of_id,
            horas_estimadas: row.horas_estimadas != null ? Number(row.horas_estimadas) : null,
            epic: row.epic_id_ref
                ? {
                    id: row.epic_id_ref,
                    title: row.epic_title,
                    color: row.epic_color,
                    status: row.epic_status,
                }
                : null,
            team_id: row.team_id,
            team: row.team_id_ref
                ? {
                    id: row.team_id_ref,
                    name: row.team_name,
                    color: row.team_color,
                }
                : null,
            sprint_id: row.sprint_id,
            sprint: row.sprint_id_ref
                ? {
                    id: row.sprint_id_ref,
                    name: row.sprint_name,
                    status: row.sprint_status,
                }
                : null,
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
            const temasResult = await query(`SELECT t.*
         FROM public.temas t
         WHERE t.asignatura_id = $1
         ORDER BY t.display_order ASC, t.created_at ASC`, [row.asignatura_id]);
            // Fetch tema assignees for this task
            const temaAssigneesResult = await query(`SELECT tta.tema_id, tta.assignee_id,
                p.id as profile_id, p.full_name, p.avatar_url, p.email
         FROM public.task_tema_assignees tta
         JOIN public.profiles p ON p.id = tta.assignee_id
         WHERE tta.task_id = $1`, [row.id]);
            // Create a map of tema_id -> assignee
            const temaAssigneesMap = new Map();
            temaAssigneesResult.rows.forEach((assigneeRow) => {
                temaAssigneesMap.set(assigneeRow.tema_id, {
                    id: assigneeRow.profile_id,
                    full_name: assigneeRow.full_name,
                    avatar_url: assigneeRow.avatar_url,
                    email: assigneeRow.email,
                });
            });
            // Fetch material assignees for this task
            const materialAssigneesResult = await query(`SELECT tma.material_id, tma.assignee_id, tma.horas_estimadas,
                p.id as profile_id, p.full_name, p.avatar_url, p.email
         FROM public.task_material_assignees tma
         JOIN public.profiles p ON p.id = tma.assignee_id
         WHERE tma.task_id = $1`, [row.id]);
            // Create a map of material_id -> { assignee, horas_estimadas }
            const materialAssigneesMap = new Map();
            materialAssigneesResult.rows.forEach((assigneeRow) => {
                materialAssigneesMap.set(String(assigneeRow.material_id), {
                    assignee: {
                        id: assigneeRow.profile_id,
                        full_name: assigneeRow.full_name,
                        avatar_url: assigneeRow.avatar_url,
                        email: assigneeRow.email,
                    },
                    horas_estimadas: assigneeRow.horas_estimadas ? parseFloat(assigneeRow.horas_estimadas) : null,
                });
            });
            // Fetch all materiales for all temas in una sola consulta (evita N+1)
            const temaIds = temasResult.rows.map((t) => t.id);
            let materialesByTema = new Map();
            if (temaIds.length > 0) {
                const materialesResult = await query(`SELECT
             mr.id,
             mr.descripcion,
             mr.tema_id,
             mt.id  AS material_type_id,
             mt.name AS material_type_name,
             mt.icon AS material_type_icon
           FROM public.materiales_requeridos mr
           JOIN public.material_types mt ON mt.id = mr.material_type_id
           WHERE mr.tema_id = ANY($1)
           ORDER BY mr.tema_id ASC, mt.display_order ASC`, [temaIds]);
                materialesByTema = new Map();
                materialesResult.rows.forEach((m) => {
                    const key = String(m.tema_id);
                    if (!materialesByTema.has(key)) {
                        materialesByTema.set(key, []);
                    }
                    materialesByTema.get(key).push(m);
                });
            }
            const temasWithMateriales = temasResult.rows.map((tema) => {
                const materialesForTema = materialesByTema.get(String(tema.id)) || [];
                return {
                    id: tema.id,
                    title: tema.title,
                    assignee: temaAssigneesMap.get(tema.id) || null,
                    materiales: materialesForTema.map((m) => {
                        const materialData = materialAssigneesMap.get(String(m.id));
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
            });
            task.temas_materiales = temasWithMateriales;
        }
        // Subtasks (user-created, via subtask_of_id -- independent of parent_task_id)
        const subtasksResult = await query(`SELECT st.id, st.title, st.task_number, st.priority, st.due_date,
              st.status_id, sts.name AS status_name, sts.color AS status_color, sts.is_completed,
              st.assignee_id, sap.full_name AS assignee_name, sap.avatar_url AS assignee_avatar_url
       FROM public.tasks st
       JOIN public.task_statuses sts ON sts.id = st.status_id
       LEFT JOIN public.profiles sap ON sap.id = st.assignee_id
       WHERE st.subtask_of_id = $1
       ORDER BY st.created_at ASC`, [row.id]);
        task.subtasks = subtasksResult.rows.map((s) => ({
            id: s.id,
            title: s.title,
            task_number: s.task_number,
            priority: s.priority,
            due_date: s.due_date,
            status_id: s.status_id,
            status_name: s.status_name,
            status_color: s.status_color,
            is_completed: s.is_completed,
            assignee_id: s.assignee_id,
            assignee_name: s.assignee_name,
            assignee_avatar_url: s.assignee_avatar_url,
        }));
        // If this task is itself a subtask, surface a lightweight parent reference
        // for a "Subtarea de #123" breadcrumb.
        if (row.subtask_of_id) {
            const parentResult = await query('SELECT id, title, task_number FROM public.tasks WHERE id = $1', [row.subtask_of_id]);
            task.parent = parentResult.rows[0] || null;
        }
        else {
            task.parent = null;
        }
        const watchersResult = await query(`SELECT p.id, p.full_name, p.avatar_url
       FROM public.task_watchers tw
       JOIN public.profiles p ON p.id = tw.user_id
       WHERE tw.task_id = $1
       ORDER BY tw.created_at ASC`, [row.id]);
        task.watchers = watchersResult.rows;
        task.is_watching = watchersResult.rows.some((w) => w.id === req.user?.profileId);
        res.json(task);
    }
    catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * POST /api/projects/:projectId/tasks
 * Create new task
 */
export const createTask = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { title, description, priority, assignee_id, due_date, tags, material_requerido_id, asignatura_id, epic_id, team_id, sprint_id, horas_estimadas } = req.body;
        const reporterId = req.user?.profileId;
        const userRole = req.user?.role;
        if (!due_date)
            return res.status(400).json({ error: 'La fecha de vencimiento es obligatoria' });
        // Check permission: only admin and project_leader of THIS project can assign tasks
        if (assignee_id) {
            // Admins and project_leaders can always assign tasks
            if (userRole !== 'admin' && userRole !== 'project_leader') {
                // Check if user is project leader for this specific project
                const leaderResult = await query('SELECT public.is_project_leader($1::UUID, $2::UUID) as is_leader', [projectId, reporterId]);
                if (!leaderResult.rows[0]?.is_leader) {
                    return res.status(403).json({
                        error: 'Solo administradores y líderes de proyecto pueden asignar tareas'
                    });
                }
            }
            if (!(await isActiveProfile(assignee_id))) {
                return res.status(400).json({ error: 'No se puede asignar la tarea a un usuario desactivado' });
            }
        }
        // Get default status
        const statusResult = await query('SELECT id FROM public.task_statuses WHERE is_default = true LIMIT 1');
        if (statusResult.rows.length === 0) {
            return res.status(500).json({ error: 'No default status found' });
        }
        const statusId = statusResult.rows[0].id;
        // Insert task. New tasks land at the top of their board column and backlog
        // (MIN(rank) - 1000), matching today's newest-first ordering.
        const result = await query(`INSERT INTO public.tasks (
         project_id, title, description, priority, status_id, assignee_id, reporter_id,
         due_date, tags, material_requerido_id, asignatura_id, epic_id, team_id, sprint_id,
         horas_estimadas, board_rank, backlog_rank
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
         COALESCE((SELECT MIN(board_rank) FROM public.tasks WHERE project_id = $1 AND status_id = $5), 1000) - 1000,
         COALESCE((SELECT MIN(backlog_rank) FROM public.tasks WHERE project_id = $1), 1000) - 1000
       )
       RETURNING *`, [
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
            epic_id || null,
            team_id || null,
            sprint_id || null,
            horas_estimadas ?? null,
        ]);
        const task = result.rows[0];
        // Reporter and (if set) assignee auto-watch their own task.
        await ensureWatcher(task.id, reporterId);
        await ensureWatcher(task.id, assignee_id);
        // Create notification + email if assigned to someone else
        if (assignee_id && assignee_id !== reporterId) {
            await query(`INSERT INTO public.notifications (user_id, project_id, task_id, type, title, message)
         VALUES ($1, $2, $3, 'task_assigned', 'Nueva tarea asignada', $4)`, [assignee_id, projectId, task.id, `Se te ha asignado la tarea: ${title}`]);
            try {
                const assigneeResult = await query('SELECT full_name, email FROM public.profiles WHERE id = $1', [assignee_id]);
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
                            dueDate: due_date || null,
                            taskLink,
                        }),
                    });
                }
            }
            catch (emailError) {
                console.error('Error sending task assignment email:', emailError);
            }
        }
        res.status(201).json(task);
    }
    catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * PATCH /api/tasks/:id
 * Update task
 */
export const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, priority, assignee_id, due_date, tags, epic_id, team_id, sprint_id, horas_estimadas, asignatura_id } = req.body;
        const userRole = req.user?.role;
        const profileId = req.user?.profileId;
        const taskLookup = await query('SELECT project_id FROM public.tasks WHERE id = $1', [id]);
        if (taskLookup.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const projectId = taskLookup.rows[0].project_id;
        // General permission: editing ANY field of a task (title, description, due
        // date, etc.) requires an actual relationship to its project -- admin,
        // global/per-project leader, a real project member, or someone with work
        // assigned in this project. Previously only the assignee_id change below
        // was checked, so any authenticated user could rename/reschedule a task
        // in a project they have nothing to do with.
        let isProjectLeaderForTask = userRole === 'admin' || userRole === 'project_leader';
        if (!isProjectLeaderForTask) {
            const accessResult = await query(`SELECT
           public.is_project_member($1::UUID, $2::UUID) as is_member,
           public.is_project_leader($1::UUID, $2::UUID) as is_leader`, [projectId, profileId]);
            const { is_member, is_leader } = accessResult.rows[0] || {};
            isProjectLeaderForTask = !!is_leader;
            if (!is_member && !is_leader) {
                const taskAccessResult = await query(`SELECT COUNT(*) as count FROM public.tasks t
           WHERE t.project_id = $1
             AND (
               t.assignee_id = $2
               OR t.id IN (SELECT task_id FROM public.task_material_assignees WHERE assignee_id = $2)
               OR t.id IN (SELECT task_id FROM public.task_tema_assignees WHERE assignee_id = $2)
             )`, [projectId, profileId]);
                if (!(taskAccessResult.rows[0]?.count > 0)) {
                    return res.status(403).json({ error: 'No tienes acceso a este proyecto' });
                }
            }
        }
        // Check permission: only admin and project_leader of THIS project can change assignee
        if (assignee_id !== undefined) {
            // Admins and project_leaders can always change assignee
            if (userRole !== 'admin' && userRole !== 'project_leader' && !isProjectLeaderForTask) {
                return res.status(403).json({
                    error: 'Solo administradores y líderes de proyecto pueden cambiar el responsable de tareas'
                });
            }
            if (assignee_id && !(await isActiveProfile(assignee_id))) {
                return res.status(400).json({ error: 'No se puede asignar la tarea a un usuario desactivado' });
            }
        }
        // Build dynamic update
        const updates = [];
        const values = [];
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
        if (epic_id !== undefined) {
            updates.push(`epic_id = $${paramCount++}`);
            values.push(epic_id);
        }
        if (team_id !== undefined) {
            updates.push(`team_id = $${paramCount++}`);
            values.push(team_id);
        }
        if (sprint_id !== undefined) {
            updates.push(`sprint_id = $${paramCount++}`);
            values.push(sprint_id);
        }
        if (horas_estimadas !== undefined) {
            updates.push(`horas_estimadas = $${paramCount++}`);
            values.push(horas_estimadas);
        }
        if (asignatura_id !== undefined) {
            updates.push(`asignatura_id = $${paramCount++}`);
            values.push(asignatura_id || null);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        values.push(id);
        const result = await query(`UPDATE public.tasks
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const task = result.rows[0];
        if (assignee_id) {
            await ensureWatcher(task.id, assignee_id);
        }
        // Create notification + email if assignee changed
        if (assignee_id && assignee_id !== req.user?.profileId) {
            await query(`INSERT INTO public.notifications (user_id, project_id, task_id, type, title, message)
         VALUES ($1, $2, $3, 'task_assigned', 'Tarea asignada', $4)`, [assignee_id, task.project_id, task.id, `Se te ha asignado la tarea: ${task.title}`]);
            try {
                const assigneeResult = await query(`SELECT p.full_name, u.email
           FROM public.profiles p
           JOIN public.users u ON u.id = p.user_id
           WHERE p.id = $1`, [assignee_id]);
                const projectResult = await query('SELECT name FROM public.projects WHERE id = $1', [task.project_id]);
                const assignee = assigneeResult.rows[0];
                const project = projectResult.rows[0];
                if (assignee?.email) {
                    const frontendUrl = (env.FRONTEND_URL ?? '').replace(/\/$/, '');
                    const taskLink = frontendUrl ? `${frontendUrl}#/my-tasks` : '';
                    await sendTaskAssignedEmail({
                        to: assignee.email,
                        subject: `Tarea asignada en ${project?.name ?? 'un proyecto'}`,
                        html: buildTaskAssignedHtml({
                            assigneeName: assignee.full_name ?? '',
                            projectName: project?.name ?? 'un proyecto',
                            taskTitle: task.title,
                            dueDate: task.due_date,
                            taskLink,
                            isReassignment: true,
                        }),
                    });
                }
            }
            catch (emailError) {
                console.error('Error sending task reassignment email:', emailError);
            }
        }
        res.json(task);
    }
    catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * PATCH /api/tasks/:id/status
 * Update task status (triggers history tracking via database trigger)
 */
export const updateTaskStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status_id } = req.body;
        const userRole = req.user?.role;
        const profileId = req.user?.profileId;
        if (!status_id) {
            return res.status(400).json({ error: 'status_id is required' });
        }
        // Get current task with its status
        const taskResult = await query(`SELECT t.*, ts.name as current_status_name
       FROM public.tasks t
       JOIN public.task_statuses ts ON ts.id = t.status_id
       WHERE t.id = $1`, [id]);
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
            (await query('SELECT public.is_project_leader($1::UUID, $2::UUID) as is_leader', [currentTask.project_id, profileId])).rows[0]?.is_leader;
        const transitionCheck = checkStatusTransition(currentStatusName, newStatusName, !!isAdminOrLeader, userRole);
        if (!transitionCheck.allowed) {
            return res.status(403).json({ error: transitionCheck.error, detail: transitionCheck.detail });
        }
        // Safeguard: Copy tasks (parent_task_id IS NOT NULL) cannot be finalized without an assignee
        if (currentTask.parent_task_id && newStatusName === 'Finalizado' && !currentTask.assignee_id) {
            return res.status(400).json({
                error: 'No se puede finalizar una tarea sin asignar',
                detail: 'Esta tarea debe ser asignada a un responsable antes de poder finalizarla.'
            });
        }
        // Update status
        const result = await query(`UPDATE public.tasks
       SET status_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`, [status_id, id]);
        const task = result.rows[0];
        // Notify assignee
        if (task.assignee_id && task.assignee_id !== req.user?.profileId) {
            await query(`INSERT INTO public.notifications (user_id, project_id, task_id, type, title, message)
         VALUES ($1, $2, $3, 'task_status_changed', 'Estado de tarea actualizado', $4)`, [task.assignee_id, task.project_id, task.id, `La tarea "${task.title}" cambió a: ${newStatusName}`]);
        }
        // Notify the rest of the watchers (assignee already covered above).
        await notifyWatchers(task.id, task.project_id, 'task_status_changed', 'Estado de tarea actualizado', `La tarea "${task.title}" cambió a: ${newStatusName}`, [profileId, task.assignee_id]);
        res.json(task);
    }
    catch (error) {
        console.error('Update task status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * PATCH /api/tasks/bulk
 * Apply one field (status_id, assignee_id, or sprint_id -- exactly one, enforced
 * by bulkTaskUpdateSchema) to many tasks of a single project at once. All-or-
 * nothing: if any task in the batch can't make a requested status transition,
 * the whole batch is rejected rather than partially applied.
 */
export const bulkUpdateTasks = async (req, res) => {
    try {
        const { project_id: projectId, task_ids: taskIds, status_id, assignee_id, sprint_id } = req.body;
        const userRole = req.user?.role;
        const profileId = req.user?.profileId;
        // Same project-access rule as updateTask: admin / global leader / leader of
        // THIS project / real member / has assigned work here.
        let isProjectLeaderForTask = userRole === 'admin' || userRole === 'project_leader';
        if (!isProjectLeaderForTask) {
            const accessResult = await query(`SELECT
           public.is_project_member($1::UUID, $2::UUID) as is_member,
           public.is_project_leader($1::UUID, $2::UUID) as is_leader`, [projectId, profileId]);
            const { is_member, is_leader } = accessResult.rows[0] || {};
            isProjectLeaderForTask = !!is_leader;
            if (!is_member && !is_leader) {
                const taskAccessResult = await query(`SELECT COUNT(*) as count FROM public.tasks t
           WHERE t.project_id = $1
             AND (
               t.assignee_id = $2
               OR t.id IN (SELECT task_id FROM public.task_material_assignees WHERE assignee_id = $2)
               OR t.id IN (SELECT task_id FROM public.task_tema_assignees WHERE assignee_id = $2)
             )`, [projectId, profileId]);
                if (!(taskAccessResult.rows[0]?.count > 0)) {
                    return res.status(403).json({ error: 'No tienes acceso a este proyecto' });
                }
            }
        }
        if (assignee_id !== undefined && userRole !== 'admin' && userRole !== 'project_leader' && !isProjectLeaderForTask) {
            return res.status(403).json({
                error: 'Solo administradores y líderes de proyecto pueden cambiar el responsable de tareas'
            });
        }
        if (assignee_id && !(await isActiveProfile(assignee_id))) {
            return res.status(400).json({ error: 'No se puede asignar la tarea a un usuario desactivado' });
        }
        const tasksResult = await query(`SELECT t.id, t.title, t.assignee_id, t.sprint_id, t.parent_task_id, t.status_id, ts.name AS status_name
       FROM public.tasks t
       JOIN public.task_statuses ts ON ts.id = t.status_id
       WHERE t.id = ANY($1::uuid[]) AND t.project_id = $2`, [taskIds, projectId]);
        if (tasksResult.rows.length !== taskIds.length) {
            return res.status(400).json({ error: 'Algunas tareas no pertenecen a este proyecto' });
        }
        const tasks = tasksResult.rows;
        let field;
        let value;
        let newStatusName;
        if (status_id !== undefined) {
            field = 'status_id';
            value = status_id;
            const newStatusResult = await query('SELECT name FROM public.task_statuses WHERE id = $1', [status_id]);
            if (newStatusResult.rows.length === 0) {
                return res.status(404).json({ error: 'Invalid status_id' });
            }
            newStatusName = newStatusResult.rows[0].name;
            for (const t of tasks) {
                const transitionCheck = checkStatusTransition(t.status_name, newStatusName, isProjectLeaderForTask, userRole);
                if (!transitionCheck.allowed) {
                    return res.status(403).json({
                        error: transitionCheck.error,
                        detail: `"${t.title}": ${transitionCheck.detail}`,
                    });
                }
                if (t.parent_task_id && newStatusName === 'Finalizado' && !t.assignee_id) {
                    return res.status(400).json({
                        error: 'No se puede finalizar una tarea sin asignar',
                        detail: `"${t.title}" debe ser asignada a un responsable antes de poder finalizarla.`,
                    });
                }
            }
        }
        else if (assignee_id !== undefined) {
            field = 'assignee_id';
            value = assignee_id;
        }
        else {
            field = 'sprint_id';
            value = sprint_id;
        }
        if (field === 'assignee_id' && value) {
            await Promise.all(taskIds.map((taskId) => ensureWatcher(taskId, value)));
        }
        const result = await query(`UPDATE public.tasks
       SET ${field} = $1, updated_at = NOW()
       WHERE id = ANY($2::uuid[]) AND project_id = $3
       RETURNING id, title, assignee_id, status_id, sprint_id, project_id`, [value, taskIds, projectId]);
        if (field === 'assignee_id' && value && value !== profileId) {
            const changedTasks = tasks.filter((t) => t.assignee_id !== value);
            if (changedTasks.length > 0) {
                await Promise.all(changedTasks.map((t) => query(`INSERT INTO public.notifications (user_id, project_id, task_id, type, title, message)
               VALUES ($1, $2, $3, 'task_assigned', 'Tarea asignada', $4)`, [value, projectId, t.id, `Se te ha asignado la tarea: ${t.title}`])));
                try {
                    const assigneeResult = await query(`SELECT p.full_name, u.email
             FROM public.profiles p
             JOIN public.users u ON u.id = p.user_id
             WHERE p.id = $1`, [value]);
                    const projectResult = await query('SELECT name FROM public.projects WHERE id = $1', [projectId]);
                    const assignee = assigneeResult.rows[0];
                    const project = projectResult.rows[0];
                    if (assignee?.email) {
                        const frontendUrl = (env.FRONTEND_URL ?? '').replace(/\/$/, '');
                        const taskLink = frontendUrl ? `${frontendUrl}#/my-tasks` : '';
                        await Promise.allSettled(changedTasks.map((t) => sendTaskAssignedEmail({
                            to: assignee.email,
                            subject: `Tarea asignada en ${project?.name ?? 'un proyecto'}`,
                            html: buildTaskAssignedHtml({
                                assigneeName: assignee.full_name ?? '',
                                projectName: project?.name ?? 'un proyecto',
                                taskTitle: t.title,
                                dueDate: null,
                                taskLink,
                                isReassignment: true,
                            }),
                        })));
                    }
                }
                catch (emailError) {
                    console.error('Error sending bulk assignment emails:', emailError);
                }
            }
        }
        else if (field === 'status_id') {
            const notifyTasks = tasks.filter((t) => t.assignee_id && t.assignee_id !== profileId);
            if (notifyTasks.length > 0) {
                await Promise.all(notifyTasks.map((t) => query(`INSERT INTO public.notifications (user_id, project_id, task_id, type, title, message)
               VALUES ($1, $2, $3, 'task_status_changed', 'Estado de tarea actualizado', $4)`, [t.assignee_id, projectId, t.id, `La tarea "${t.title}" cambió a: ${newStatusName}`])));
            }
            await Promise.all(tasks.map((t) => notifyWatchers(t.id, projectId, 'task_status_changed', 'Estado de tarea actualizado', `La tarea "${t.title}" cambió a: ${newStatusName}`, [profileId, t.assignee_id])));
        }
        res.json({ updated: result.rows.length, tasks: result.rows });
    }
    catch (error) {
        console.error('Bulk update tasks error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * PATCH /api/tasks/:id/rank
 * Reorder a task within its Kanban column ('board') or its backlog ('backlog'),
 * using fractional (midpoint) ranking so a single drag only ever writes one row —
 * this matters because a plain member only sees a subset of a project's tasks,
 * and a full-list renumber would silently corrupt the rank of tasks they can't see.
 */
export const updateTaskRank = async (req, res) => {
    try {
        const { id } = req.params;
        const { list, prev_task_id, next_task_id } = req.body;
        const column = list === 'backlog' ? 'backlog_rank' : 'board_rank';
        const taskResult = await query('SELECT id, project_id, status_id FROM public.tasks WHERE id = $1', [id]);
        if (taskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const { project_id: projectId, status_id: statusId } = taskResult.rows[0];
        const neighbourIds = [prev_task_id, next_task_id].filter(isUuid);
        let prevRank = null;
        let nextRank = null;
        if (neighbourIds.length > 0) {
            const neighbours = await query(`SELECT id, ${column}::float8 AS rank FROM public.tasks WHERE id = ANY($1::uuid[]) AND project_id = $2`, [neighbourIds, projectId]);
            const byId = new Map(neighbours.rows.map((r) => [r.id, r.rank]));
            if (isUuid(prev_task_id))
                prevRank = byId.get(prev_task_id) ?? null;
            if (isUuid(next_task_id))
                nextRank = byId.get(next_task_id) ?? null;
        }
        let newRank;
        if (prevRank === null && nextRank === null) {
            newRank = 1000;
        }
        else if (prevRank === null) {
            newRank = nextRank - 1000;
        }
        else if (nextRank === null) {
            newRank = prevRank + 1000;
        }
        else if (nextRank - prevRank < 1e-6) {
            // Gap exhausted: rebalance this scope, then recompute the midpoint.
            if (column === 'board_rank') {
                await query(`WITH r AS (
             SELECT id, 1000 * ROW_NUMBER() OVER (ORDER BY board_rank ASC NULLS LAST, created_at DESC) AS rk
             FROM public.tasks WHERE project_id = $1 AND status_id = $2
           )
           UPDATE public.tasks t SET board_rank = r.rk FROM r WHERE r.id = t.id`, [projectId, statusId]);
            }
            else {
                await query(`WITH r AS (
             SELECT id, 1000 * ROW_NUMBER() OVER (ORDER BY backlog_rank ASC NULLS LAST, created_at DESC) AS rk
             FROM public.tasks WHERE project_id = $1
           )
           UPDATE public.tasks t SET backlog_rank = r.rk FROM r WHERE r.id = t.id`, [projectId]);
            }
            const refreshed = await query(`SELECT id, ${column}::float8 AS rank FROM public.tasks WHERE id = ANY($1::uuid[]) AND project_id = $2`, [neighbourIds, projectId]);
            const byId = new Map(refreshed.rows.map((r) => [r.id, r.rank]));
            const p = isUuid(prev_task_id) ? byId.get(prev_task_id) ?? null : null;
            const n = isUuid(next_task_id) ? byId.get(next_task_id) ?? null : null;
            newRank = p !== null && n !== null ? (p + n) / 2 : p !== null ? p + 1000 : n - 1000;
        }
        else {
            newRank = (prevRank + nextRank) / 2;
        }
        const result = await query(`UPDATE public.tasks
       SET ${column} = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, project_id, status_id, board_rank::float8 AS board_rank, backlog_rank::float8 AS backlog_rank`, [newRank, id]);
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Update task rank error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * DELETE /api/tasks/:id
 * Delete task
 */
export const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM public.tasks WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json({ message: 'Task deleted successfully' });
    }
    catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * GET /api/tasks/:id/history
 * Get task status change history
 */
export const getTaskHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(`SELECT
        tsh.*,
        from_status.name as from_status_name, from_status.color as from_status_color,
        to_status.name as to_status_name, to_status.color as to_status_color,
        p.id as changed_by_id, p.full_name as changed_by_name, p.avatar_url as changed_by_avatar
       FROM public.task_status_history tsh
       LEFT JOIN public.task_statuses from_status ON from_status.id = tsh.from_status_id
       JOIN public.task_statuses to_status ON to_status.id = tsh.to_status_id
       LEFT JOIN public.profiles p ON p.id = tsh.changed_by
       WHERE tsh.task_id = $1
       ORDER BY tsh.started_at DESC`, [id]);
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
    }
    catch (error) {
        console.error('Get task history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * GET /api/tasks/:id/activity
 * Get task activity log
 */
export const getTaskActivity = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(`SELECT
        tal.*,
        p.id as performed_by_id, p.full_name as performed_by_name, p.avatar_url as performed_by_avatar
       FROM public.task_activity_log tal
       LEFT JOIN public.profiles p ON p.id = tal.performed_by
       WHERE tal.task_id = $1
       ORDER BY tal.created_at DESC`, [id]);
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
    }
    catch (error) {
        console.error('Get task activity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
/**
 * GET /api/projects/:projectId/tasks/tags
 * Distinct list of tags used across the project's tasks (for filter/autocomplete UIs).
 */
export const listProjectTags = async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await query(`SELECT DISTINCT tag FROM public.tasks t, UNNEST(t.tags) AS tag
       WHERE t.project_id = $1 AND tag <> '' ORDER BY tag`, [projectId]);
        res.json(result.rows.map((r) => r.tag));
    }
    catch (error) {
        console.error('List project tags error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
