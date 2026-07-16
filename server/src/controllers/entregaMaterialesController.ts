import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

/**
 * GET /api/entregas/:id/materiales
 * Detalle materia x tipo de material x cantidad entregada para una entrega
 */
export const getEntregaMateriales = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT em.*,
              a.name AS asignatura_name,
              mt.name AS material_type_name,
              mt.icon AS material_type_icon,
              mt.display_order AS material_type_display_order,
              COALESCE(mr.cantidad, 0) AS cantidad_requerida
       FROM public.entrega_materiales em
       JOIN public.asignaturas a ON a.id = em.asignatura_id
       JOIN public.material_types mt ON mt.id = em.material_type_id
       LEFT JOIN public.materiales_requeridos mr
         ON mr.asignatura_id = em.asignatura_id AND mr.material_type_id = em.material_type_id
       WHERE em.entrega_id = $1
       ORDER BY a.display_order ASC, mt.display_order ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('getEntregaMateriales error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /api/entregas/:id/materiales
 * Reemplaza el detalle materia x tipo de material x cantidad entregada de una entrega
 */
export const setEntregaMateriales = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    const entregaExists = await query('SELECT id FROM public.entregas WHERE id = $1', [id]);
    if (entregaExists.rows.length === 0) {
      return res.status(404).json({ error: 'Entrega no encontrada' });
    }

    await query('BEGIN');

    try {
      await query('DELETE FROM public.entrega_materiales WHERE entrega_id = $1', [id]);

      for (const item of items) {
        const cantidad = parseInt(item?.cantidad_entregada, 10) || 0;
        if (!item?.asignatura_id || !item?.material_type_id || cantidad <= 0) continue;

        await query(
          `INSERT INTO public.entrega_materiales (entrega_id, asignatura_id, material_type_id, cantidad_entregada)
           VALUES ($1, $2, $3, $4)`,
          [id, item.asignatura_id, item.material_type_id, cantidad]
        );
      }

      await query('COMMIT');
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

    const result = await query(
      `SELECT em.*,
              a.name AS asignatura_name,
              mt.name AS material_type_name,
              mt.icon AS material_type_icon,
              COALESCE(mr.cantidad, 0) AS cantidad_requerida
       FROM public.entrega_materiales em
       JOIN public.asignaturas a ON a.id = em.asignatura_id
       JOIN public.material_types mt ON mt.id = em.material_type_id
       LEFT JOIN public.materiales_requeridos mr
         ON mr.asignatura_id = em.asignatura_id AND mr.material_type_id = em.material_type_id
       WHERE em.entrega_id = $1
       ORDER BY a.display_order ASC, mt.display_order ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('setEntregaMateriales error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/entregas/materiales
 * Feed plano de todo el detalle materia x tipo de material, para el dashboard
 */
export const getEntregaMaterialesResumen = async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT em.entrega_id,
              e.fecha_entrega,
              e.estado,
              e.tipo_entrega,
              e.escuela,
              e.nivel_programa,
              e.proyecto_id,
              e.nombre_proyecto,
              em.asignatura_id,
              a.name AS asignatura_name,
              em.material_type_id,
              mt.name AS material_type_name,
              mt.icon AS material_type_icon,
              em.cantidad_entregada,
              COALESCE(mr.cantidad, 0) AS cantidad_requerida
       FROM public.entrega_materiales em
       JOIN public.entregas e ON e.id = em.entrega_id
       JOIN public.asignaturas a ON a.id = em.asignatura_id
       JOIN public.material_types mt ON mt.id = em.material_type_id
       LEFT JOIN public.materiales_requeridos mr
         ON mr.asignatura_id = em.asignatura_id AND mr.material_type_id = em.material_type_id
       ORDER BY e.fecha_entrega DESC, a.display_order ASC, mt.display_order ASC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('getEntregaMaterialesResumen error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
