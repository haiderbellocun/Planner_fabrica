import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

export const listEntregas = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT e.*, p.full_name AS creator_name
       FROM public.entregas e
       LEFT JOIN public.profiles p ON p.id = e.created_by
       ORDER BY e.fecha_entrega DESC, e.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('listEntregas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createEntrega = async (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.user?.profileId;
    const {
      nombre_proyecto,
      escuela,
      nivel_programa,
      modalidad,
      fecha_entrega,
      entregado_a,
      tipo_entrega,
      estado,
      notas,
      cantidad_semestres,
      materias,
      materiales_entregados,
      proyecto_id,
    } = req.body;

    if (!nombre_proyecto || !fecha_entrega) {
      return res.status(400).json({ error: 'nombre_proyecto y fecha_entrega son requeridos' });
    }

    const result = await query(
      `INSERT INTO public.entregas
         (nombre_proyecto, escuela, nivel_programa, modalidad, fecha_entrega,
          entregado_a, tipo_entrega, estado, notas,
          cantidad_semestres, materias, materiales_entregados,
          proyecto_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        nombre_proyecto,
        escuela || null,
        nivel_programa || null,
        modalidad || null,
        fecha_entrega,
        entregado_a || null,
        tipo_entrega || 'primera_entrega',
        estado || 'pendiente',
        notas || null,
        cantidad_semestres ? parseInt(cantidad_semestres) : null,
        materias || null,
        materiales_entregados || null,
        proyecto_id || null,
        profileId || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('createEntrega error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEntrega = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      nombre_proyecto,
      escuela,
      nivel_programa,
      modalidad,
      fecha_entrega,
      entregado_a,
      tipo_entrega,
      estado,
      notas,
      cantidad_semestres,
      materias,
      materiales_entregados,
      proyecto_id,
    } = req.body;

    const result = await query(
      `UPDATE public.entregas SET
         nombre_proyecto       = COALESCE($1, nombre_proyecto),
         escuela               = $2,
         nivel_programa        = $3,
         modalidad             = $4,
         fecha_entrega         = COALESCE($5, fecha_entrega),
         entregado_a           = $6,
         tipo_entrega          = COALESCE($7, tipo_entrega),
         estado                = COALESCE($8, estado),
         notas                 = $9,
         cantidad_semestres    = $10,
         materias              = $11,
         materiales_entregados = $12,
         proyecto_id           = $13
       WHERE id = $14
       RETURNING *`,
      [
        nombre_proyecto,
        escuela ?? null,
        nivel_programa ?? null,
        modalidad ?? null,
        fecha_entrega,
        entregado_a ?? null,
        tipo_entrega,
        estado,
        notas ?? null,
        cantidad_semestres ? parseInt(cantidad_semestres) : null,
        materias ?? null,
        materiales_entregados ?? null,
        proyecto_id ?? null,
        id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('updateEntrega error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteEntrega = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM public.entregas WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ message: 'Eliminado' });
  } catch (error) {
    console.error('deleteEntrega error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
