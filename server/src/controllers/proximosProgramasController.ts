import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

export const listProximosProgramas = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT pp.*, p.full_name as creator_name
       FROM public.proximos_programas pp
       LEFT JOIN public.profiles p ON p.id = pp.created_by
       ORDER BY
         CASE prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END ASC,
         fecha_envio_curriculo ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List proximos_programas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProximoPrograma = async (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.user?.profileId;
    const {
      escuela,
      nivel_programa,
      clasificacion_programa,
      programa_con_cambio,
      programa_sin_cambio,
      modalidad,
      cantidad_asignaturas,
      fecha_envio_curriculo,
      prioridad,
      estado,
      dependencia,
      link,
      notas,
    } = req.body;

    if (!escuela || !nivel_programa || !clasificacion_programa || !modalidad || !fecha_envio_curriculo) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const result = await query(
      `INSERT INTO public.proximos_programas
         (escuela, nivel_programa, clasificacion_programa, programa_con_cambio, programa_sin_cambio,
          modalidad, cantidad_asignaturas, fecha_envio_curriculo, prioridad, estado, dependencia, link, notas, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        escuela,
        nivel_programa,
        clasificacion_programa,
        programa_con_cambio || null,
        programa_sin_cambio || null,
        modalidad,
        cantidad_asignaturas ?? 0,
        fecha_envio_curriculo,
        prioridad || 'media',
        estado || 'pendiente',
        dependencia || null,
        link || null,
        notas || null,
        profileId || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create proximo_programa error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProximoPrograma = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      escuela,
      nivel_programa,
      clasificacion_programa,
      programa_con_cambio,
      programa_sin_cambio,
      modalidad,
      cantidad_asignaturas,
      fecha_envio_curriculo,
      prioridad,
      estado,
      dependencia,
      link,
      notas,
    } = req.body;

    const result = await query(
      `UPDATE public.proximos_programas SET
         escuela = COALESCE($1, escuela),
         nivel_programa = COALESCE($2, nivel_programa),
         clasificacion_programa = COALESCE($3, clasificacion_programa),
         programa_con_cambio = $4,
         programa_sin_cambio = $5,
         modalidad = COALESCE($6, modalidad),
         cantidad_asignaturas = COALESCE($7, cantidad_asignaturas),
         fecha_envio_curriculo = COALESCE($8, fecha_envio_curriculo),
         prioridad = COALESCE($9, prioridad),
         estado = COALESCE($10, estado),
         dependencia = $11,
         link = $12,
         notas = $13
       WHERE id = $14
       RETURNING *`,
      [
        escuela,
        nivel_programa,
        clasificacion_programa,
        programa_con_cambio ?? null,
        programa_sin_cambio ?? null,
        modalidad,
        cantidad_asignaturas,
        fecha_envio_curriculo,
        prioridad,
        estado,
        dependencia ?? null,
        link ?? null,
        notas ?? null,
        id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update proximo_programa error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteProximoPrograma = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM public.proximos_programas WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ message: 'Eliminado' });
  } catch (error) {
    console.error('Delete proximo_programa error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
