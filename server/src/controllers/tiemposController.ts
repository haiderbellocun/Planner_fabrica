import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

/**
 * GET /api/tiempos-estimados
 * Get all estimated times, optionally filtered by producto, cargo, or material_type_id
 */
export const getTiemposEstimados = async (req: AuthRequest, res: Response) => {
  try {
    const { producto, cargo, material_type_id } = req.query;

    let sql = `
      SELECT te.*, mt.name as material_type_name, mt.icon as material_type_icon
      FROM public.tiempos_estimados te
      LEFT JOIN public.material_types mt ON mt.id = te.material_type_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (producto) {
      sql += ` AND LOWER(te.producto) = LOWER($${paramIdx})`;
      params.push(producto);
      paramIdx++;
    }

    if (cargo) {
      sql += ` AND LOWER(te.cargo) = LOWER($${paramIdx})`;
      params.push(cargo);
      paramIdx++;
    }

    if (material_type_id) {
      sql += ` AND te.material_type_id = $${paramIdx}`;
      params.push(material_type_id);
      paramIdx++;
    }

    sql += ` ORDER BY te.producto, te.cargo, te.cantidad_valor`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get tiempos estimados error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/tiempos-estimados/calcular
 * Calculate estimated hours for a task based on material type, cargo, and quantity
 * Query params: material_type_id, cargo, cantidad_valor, cantidad_unidad
 */
export const calcularTiempo = async (req: AuthRequest, res: Response) => {
  try {
    const { material_type_id, cargo, cantidad_valor, cantidad_unidad } = req.query;

    if (!material_type_id || !cargo) {
      return res.status(400).json({ error: 'material_type_id and cargo are required' });
    }

    // Find matching tiempos - exact match first, then closest
    let result = await query(
      `SELECT te.*, mt.name as material_type_name
       FROM public.tiempos_estimados te
       LEFT JOIN public.material_types mt ON mt.id = te.material_type_id
       WHERE te.material_type_id = $1 AND LOWER(te.cargo) = LOWER($2)
       ORDER BY te.cantidad_valor`,
      [material_type_id, cargo]
    );

    if (result.rows.length === 0) {
      return res.json({
        found: false,
        message: 'No hay tiempos estimados para esta combinación de material y cargo',
        options: [],
      });
    }

    // If cantidad_valor provided, find exact or closest match
    if (cantidad_valor) {
      const val = parseFloat(cantidad_valor as string);
      const exact = result.rows.find(r => parseFloat(r.cantidad_valor) === val);

      if (exact) {
        return res.json({
          found: true,
          exact_match: true,
          tiempo: exact,
        });
      }

      // Find closest (between two values or extrapolate)
      const sorted = result.rows.sort((a: any, b: any) => a.cantidad_valor - b.cantidad_valor);
      let lower = null;
      let upper = null;

      for (const row of sorted) {
        if (parseFloat(row.cantidad_valor) <= val) lower = row;
        if (parseFloat(row.cantidad_valor) >= val && !upper) upper = row;
      }

      if (lower && upper && lower.id !== upper.id) {
        // Interpolate
        const range = parseFloat(upper.cantidad_valor) - parseFloat(lower.cantidad_valor);
        const ratio = (val - parseFloat(lower.cantidad_valor)) / range;
        const estimatedHours = parseFloat(lower.horas) + ratio * (parseFloat(upper.horas) - parseFloat(lower.horas));

        return res.json({
          found: true,
          exact_match: false,
          interpolated: true,
          horas_estimadas: Math.round(estimatedHours * 100) / 100,
          based_on: { lower, upper },
        });
      }

      // Use closest match
      const closest = lower || upper;
      return res.json({
        found: true,
        exact_match: false,
        tiempo: closest,
      });
    }

    // Return all options for this material + cargo combination
    return res.json({
      found: true,
      options: result.rows,
    });
  } catch (error) {
    console.error('Calcular tiempo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/tiempos-estimados/tarea/:taskId
 * Calculate estimated time for a specific task based on its materials and assignees
 */
export const calcularTiempoTarea = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;

    // Get task with material and assignee info
    const taskResult = await query(
      `SELECT t.id, t.title, t.assignee_id,
              mr.id as material_id, mr.material_type_id, mr.cantidad,
              mt.name as material_type_name, mt.icon as material_type_icon,
              p.cargo as assignee_cargo, p.full_name as assignee_name
       FROM public.tasks t
       LEFT JOIN public.materiales_requeridos mr ON mr.id = t.material_requerido_id
       LEFT JOIN public.material_types mt ON mt.id = mr.material_type_id
       LEFT JOIN public.profiles p ON p.id = t.assignee_id
       WHERE t.id = $1`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Get task-level estimation (if task has a direct material_requerido_id + assignee with cargo)
    let taskTiempos: any[] = [];
    if (task.material_type_id && task.assignee_cargo) {
      const tiemposResult = await query(
        `SELECT * FROM public.tiempos_estimados
         WHERE material_type_id = $1 AND LOWER(cargo) = LOWER($2)
         ORDER BY cantidad_valor`,
        [task.material_type_id, task.assignee_cargo]
      );
      taskTiempos = tiemposResult.rows;
    }

    // Always get material assignees and their estimations
    const materialAssigneesResult = await query(
      `SELECT tma.material_id, tma.assignee_id,
              p.full_name, p.cargo,
              mr.material_type_id, mr.cantidad,
              mt.name as material_type_name, mt.icon as material_type_icon
       FROM public.task_material_assignees tma
       JOIN public.profiles p ON p.id = tma.assignee_id
       JOIN public.materiales_requeridos mr ON mr.id = tma.material_id
       JOIN public.material_types mt ON mt.id = mr.material_type_id
       WHERE tma.task_id = $1`,
      [taskId]
    );

    // Calculate per-material-assignee estimations
    const materialEstimations = [];
    for (const ma of materialAssigneesResult.rows) {
      // Try cargo-specific match first
      let tiempoResult = await query(
        `SELECT * FROM public.tiempos_estimados
         WHERE material_type_id = $1 AND LOWER(cargo) = LOWER($2)
         AND LOWER(producto) NOT LIKE 'plantilla%'
         AND LOWER(producto) NOT LIKE 'guion%'
         AND LOWER(producto) NOT LIKE 'guión%'
         AND LOWER(producto) NOT LIKE 'post %'
         ORDER BY producto, cantidad_valor`,
        [ma.material_type_id, ma.cargo || '']
      );

      // Fallback: if no cargo-specific match, show ALL tiempos for this material type
      if (tiempoResult.rows.length === 0) {
        tiempoResult = await query(
          `SELECT * FROM public.tiempos_estimados
           WHERE material_type_id = $1
           AND LOWER(producto) NOT LIKE 'plantilla%'
           AND LOWER(producto) NOT LIKE 'guion%'
           AND LOWER(producto) NOT LIKE 'guión%'
           AND LOWER(producto) NOT LIKE 'post %'
           ORDER BY producto, cantidad_valor`,
          [ma.material_type_id]
        );
      }

      materialEstimations.push({
        assignee_id: ma.assignee_id,
        assignee_name: ma.full_name,
        cargo: ma.cargo,
        material_type: ma.material_type_name,
        material_type_icon: ma.material_type_icon,
        tiempos_disponibles: tiempoResult.rows,
      });
    }

    // Calculate total estimated hours (sum of first available time per material assignee)
    let totalHorasEstimadas = 0;
    let materialesConTiempo = 0;
    for (const me of materialEstimations) {
      if (me.tiempos_disponibles.length > 0) {
        // Use the middle option as default estimate
        const midIdx = Math.floor(me.tiempos_disponibles.length / 2);
        totalHorasEstimadas += parseFloat(me.tiempos_disponibles[midIdx].horas);
        materialesConTiempo++;
      }
    }

    const hasAnyEstimation = taskTiempos.length > 0 || materialEstimations.some(me => me.tiempos_disponibles.length > 0);

    res.json({
      task_id: taskId,
      has_estimation: hasAnyEstimation,
      task_material: task.material_type_id ? {
        type_name: task.material_type_name,
        icon: task.material_type_icon,
        cantidad: task.cantidad,
      } : null,
      assignee: task.assignee_id ? {
        name: task.assignee_name,
        cargo: task.assignee_cargo,
      } : null,
      tiempos_disponibles: taskTiempos,
      material_assignee_estimations: materialEstimations,
      resumen: {
        total_horas_estimadas: Math.round(totalHorasEstimadas * 100) / 100,
        materiales_con_tiempo: materialesConTiempo,
        materiales_total: materialEstimations.length,
      },
    });
  } catch (error) {
    console.error('Calcular tiempo tarea error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/tiempos-estimados/productos
 * Get unique product names
 */
export const getProductos = async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT DISTINCT producto FROM public.tiempos_estimados ORDER BY producto`
    );
    res.json(result.rows.map(r => r.producto));
  } catch (error) {
    console.error('Get productos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/tiempos-estimados/cargos
 * Get unique cargo names
 */
export const getCargos = async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT DISTINCT cargo FROM public.tiempos_estimados ORDER BY cargo`
    );
    res.json(result.rows.map(r => r.cargo));
  } catch (error) {
    console.error('Get cargos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
