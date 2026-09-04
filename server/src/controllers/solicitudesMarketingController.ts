import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

export const listSolicitudes = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT s.*, p.full_name AS creator_name, pr.name AS proyecto_name
       FROM public.solicitudes_marketing s
       LEFT JOIN public.profiles p ON p.id = s.created_by
       LEFT JOIN public.projects pr ON pr.id = s.proyecto_id
       ORDER BY s.fecha_limite ASC, s.folio DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('listSolicitudes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createSolicitud = async (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.user?.profileId;
    const {
      fecha_limite,
      area_solicitante,
      solicitante,
      contacto,
      numero_ticket,
      campana,
      proyecto_id,
      brief,
      objetivo_comunicacion,
      publico_objetivo,
      canal,
      tipo_pieza,
      formato_medidas,
      cantidad,
      entregables_especificos,
      mensaje_clave,
      cta,
      insumos_disponibles,
      link_insumos,
      restricciones,
      prioridad,
      estado_insumos,
      estado_produccion,
      fecha_estimada_entrega,
      observaciones,
      entregas_links,
      nuevas_observaciones,
      observaciones_adicionales,
    } = req.body;

    if (!fecha_limite || !area_solicitante || !solicitante || !campana) {
      return res.status(400).json({
        error: 'fecha_limite, area_solicitante, solicitante y campana son requeridos',
      });
    }

    const result = await query(
      `INSERT INTO public.solicitudes_marketing
         (fecha_limite, area_solicitante, solicitante, contacto, numero_ticket,
          campana, proyecto_id, brief, objetivo_comunicacion, publico_objetivo,
          canal, tipo_pieza, formato_medidas, cantidad, entregables_especificos,
          mensaje_clave, cta, insumos_disponibles, link_insumos, restricciones,
          prioridad, estado_insumos, estado_produccion, fecha_estimada_entrega,
          observaciones, entregas_links, nuevas_observaciones, observaciones_adicionales,
          created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
               $21,$22,$23,$24,$25,$26,$27,$28,$29)
       RETURNING *`,
      [
        fecha_limite,
        area_solicitante,
        solicitante,
        contacto || null,
        numero_ticket || 'Nuevo',
        campana,
        proyecto_id || null,
        brief || null,
        objetivo_comunicacion || null,
        publico_objetivo || null,
        canal || null,
        tipo_pieza || null,
        formato_medidas || null,
        cantidad ? parseInt(cantidad) : 1,
        entregables_especificos || null,
        mensaje_clave || null,
        cta || null,
        insumos_disponibles ?? false,
        link_insumos || null,
        restricciones || null,
        prioridad || 'media',
        estado_insumos || 'pendiente',
        estado_produccion || 'pendiente',
        fecha_estimada_entrega || null,
        observaciones || null,
        entregas_links || null,
        nuevas_observaciones || null,
        observaciones_adicionales || null,
        profileId || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('createSolicitud error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSolicitud = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      fecha_limite,
      area_solicitante,
      solicitante,
      contacto,
      numero_ticket,
      campana,
      proyecto_id,
      brief,
      objetivo_comunicacion,
      publico_objetivo,
      canal,
      tipo_pieza,
      formato_medidas,
      cantidad,
      entregables_especificos,
      mensaje_clave,
      cta,
      insumos_disponibles,
      link_insumos,
      restricciones,
      prioridad,
      estado_insumos,
      estado_produccion,
      fecha_estimada_entrega,
      observaciones,
      entregas_links,
      nuevas_observaciones,
      observaciones_adicionales,
    } = req.body;

    const result = await query(
      `UPDATE public.solicitudes_marketing SET
         fecha_limite               = COALESCE($1, fecha_limite),
         area_solicitante           = COALESCE($2, area_solicitante),
         solicitante                = COALESCE($3, solicitante),
         contacto                   = $4,
         numero_ticket              = $5,
         campana                    = COALESCE($6, campana),
         proyecto_id                = $7,
         brief                      = $8,
         objetivo_comunicacion      = $9,
         publico_objetivo           = $10,
         canal                      = $11,
         tipo_pieza                 = $12,
         formato_medidas            = $13,
         cantidad                   = $14,
         entregables_especificos    = $15,
         mensaje_clave              = $16,
         cta                        = $17,
         insumos_disponibles        = COALESCE($18, insumos_disponibles),
         link_insumos               = $19,
         restricciones              = $20,
         prioridad                  = COALESCE($21, prioridad),
         estado_insumos             = COALESCE($22, estado_insumos),
         estado_produccion          = COALESCE($23, estado_produccion),
         fecha_estimada_entrega     = $24,
         observaciones              = $25,
         entregas_links             = $26,
         nuevas_observaciones       = $27,
         observaciones_adicionales  = $28,
         updated_at                 = now()
       WHERE id = $29
       RETURNING *`,
      [
        fecha_limite,
        area_solicitante,
        solicitante,
        contacto ?? null,
        numero_ticket ?? null,
        campana,
        proyecto_id ?? null,
        brief ?? null,
        objetivo_comunicacion ?? null,
        publico_objetivo ?? null,
        canal ?? null,
        tipo_pieza ?? null,
        formato_medidas ?? null,
        cantidad ? parseInt(cantidad) : null,
        entregables_especificos ?? null,
        mensaje_clave ?? null,
        cta ?? null,
        insumos_disponibles,
        link_insumos ?? null,
        restricciones ?? null,
        prioridad,
        estado_insumos,
        estado_produccion,
        fecha_estimada_entrega ?? null,
        observaciones ?? null,
        entregas_links ?? null,
        nuevas_observaciones ?? null,
        observaciones_adicionales ?? null,
        id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('updateSolicitud error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSolicitud = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM public.solicitudes_marketing WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ message: 'Eliminado' });
  } catch (error) {
    console.error('deleteSolicitud error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
