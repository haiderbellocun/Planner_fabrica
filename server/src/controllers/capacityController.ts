import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { ASSIGNED_WORK_CTE } from './reportsMetrics.js';

/**
 * GET /api/capacity/me
 * Carga personal por horas del usuario autenticado -- a diferencia de
 * getTeamCapacity() (server/src/controllers/reportsController.ts, solo admin/líder),
 * este endpoint es para cualquier usuario autenticado y NUNCA sustituye una
 * capacidad semanal sin configurar por un valor por defecto: si
 * profiles.weekly_hours_capacity es NULL, se responde `null`, no 40.25.
 */
export const getMyCapacity = async (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.user?.profileId;
    if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await query(
      `WITH ${ASSIGNED_WORK_CTE}
       SELECT
         p.weekly_hours_capacity,
         COALESCE(SUM(aw.horas_estimadas) FILTER (WHERE NOT aw.is_completed), 0) AS pending_hours,
         COUNT(DISTINCT aw.task_id) FILTER (WHERE NOT aw.is_completed) AS tasks_count,
         COUNT(DISTINCT aw.task_id) FILTER (WHERE NOT aw.is_completed AND aw.horas_estimadas IS NULL) AS tasks_without_estimate
       FROM public.profiles p
       LEFT JOIN assigned_work aw ON aw.profile_id = p.id
       WHERE p.id = $1
       GROUP BY p.id, p.weekly_hours_capacity`,
      [profileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const row = result.rows[0];
    const weeklyHoursCapacity = row.weekly_hours_capacity != null ? parseFloat(row.weekly_hours_capacity) : null;
    const pendingHours = Math.round(parseFloat(row.pending_hours) * 100) / 100;

    res.json({
      pending_hours_estimated: pendingHours,
      weekly_hours_capacity: weeklyHoursCapacity,
      utilization_pct:
        weeklyHoursCapacity != null && weeklyHoursCapacity > 0
          ? Math.round((pendingHours / weeklyHoursCapacity) * 100)
          : null,
      tasks_without_estimate_count: parseInt(row.tasks_without_estimate, 10),
      tasks_count: parseInt(row.tasks_count, 10),
    });
  } catch (error) {
    console.error('getMyCapacity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
