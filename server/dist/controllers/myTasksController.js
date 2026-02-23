import { query } from '../config/database.js';
/**
 * GET /api/my-tasks
 * Get all tasks assigned to the current user across all projects
 */
export const getMyTasks = async (req, res) => {
    try {
        const profileId = req.user?.profileId;
        const result = await query(`SELECT
        t.*,
        ts.id as status_id, ts.name as status_name, ts.color as status_color,
        ts.display_order as status_order, ts.is_completed as status_is_completed,
        assignee.id as assignee_id, assignee.full_name as assignee_name,
        assignee.avatar_url as assignee_avatar, assignee.email as assignee_email, assignee.cargo as assignee_cargo,
        reporter.id as reporter_id, reporter.full_name as reporter_name,
        reporter.avatar_url as reporter_avatar, reporter.email as reporter_email,
        p.id as project_id, p.name as project_name, p.key as project_key,
        mr.id as material_id, mr.descripcion as material_descripcion,
        mt.id as material_type_id, mt.name as material_type_name, mt.icon as material_type_icon,
        tema.id as tema_id, tema.title as tema_title,
        asig.id as asignatura_id, asig.name as asignatura_name, asig.code as asignatura_code, asig.semestre as asignatura_semestre,
        prog.id as programa_id, prog.name as programa_name, prog.code as programa_code, prog.tipo_programa as programa_tipo
       FROM public.tasks t
       JOIN public.task_statuses ts ON ts.id = t.status_id
       JOIN public.projects p ON p.id = t.project_id
       LEFT JOIN public.profiles assignee ON assignee.id = t.assignee_id
       LEFT JOIN public.profiles reporter ON reporter.id = t.reporter_id
       LEFT JOIN public.materiales_requeridos mr ON mr.id = t.material_requerido_id
       LEFT JOIN public.material_types mt ON mt.id = mr.material_type_id
       LEFT JOIN public.temas tema ON tema.id = mr.tema_id
       LEFT JOIN public.asignaturas asig ON asig.id = COALESCE(t.asignatura_id, tema.asignatura_id, mr.asignatura_id)
       LEFT JOIN public.programas prog ON prog.id = asig.programa_id
       WHERE (
           t.assignee_id = $1
           OR t.id IN (SELECT task_id FROM public.task_material_assignees WHERE assignee_id = $1)
           OR t.id IN (SELECT task_id FROM public.task_tema_assignees WHERE assignee_id = $1)
         )
       ORDER BY t.created_at DESC`, [profileId]);
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
            project: {
                id: row.project_id,
                name: row.project_name,
                key: row.project_key,
            },
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
        res.json(tasks);
    }
    catch (error) {
        console.error('Get my tasks error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
