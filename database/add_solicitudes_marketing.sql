-- Módulo "Solicitudes de Marketing": ticket de solicitud de piezas de marketing
-- con seguimiento de insumos y producción.

CREATE TABLE IF NOT EXISTS public.solicitudes_marketing (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio                       SERIAL UNIQUE,

  -- Registro
  fecha_registro              TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_limite                DATE NOT NULL,

  -- Solicitante
  area_solicitante            TEXT NOT NULL,
  solicitante                 TEXT NOT NULL,
  contacto                    TEXT,
  numero_ticket               TEXT DEFAULT 'Nuevo',

  -- Brief
  campana                     TEXT NOT NULL,
  proyecto_id                 UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  brief                       TEXT,
  objetivo_comunicacion       TEXT,
  publico_objetivo            TEXT,

  -- Pieza y copy
  canal                       TEXT,             -- JSON array serializado, ej. ["instagram","tiktok"]
  tipo_pieza                  TEXT,
  formato_medidas             TEXT,
  cantidad                    INTEGER DEFAULT 1,
  entregables_especificos     TEXT,
  mensaje_clave                TEXT,
  cta                         TEXT,

  -- Insumos
  insumos_disponibles         BOOLEAN NOT NULL DEFAULT false,
  link_insumos                TEXT,
  restricciones               TEXT,

  -- Seguimiento
  prioridad                   TEXT NOT NULL DEFAULT 'media'
                               CHECK (prioridad IN ('alta','media','baja')),
  estado_insumos               TEXT NOT NULL DEFAULT 'pendiente'
                               CHECK (estado_insumos IN ('pendiente','recibido','incompleto')),
  estado_produccion            TEXT NOT NULL DEFAULT 'pendiente'
                               CHECK (estado_produccion IN ('pendiente','en_diseno','en_revision','aprobado','publicado')),
  fecha_estimada_entrega       DATE,
  observaciones                TEXT,
  entregas_links                TEXT,
  nuevas_observaciones          TEXT,
  observaciones_adicionales     TEXT,

  created_by                  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_marketing_proyecto ON public.solicitudes_marketing(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_marketing_estado_produccion ON public.solicitudes_marketing(estado_produccion);

COMMENT ON TABLE public.solicitudes_marketing IS 'Solicitudes de piezas de marketing: brief, insumos y seguimiento de producción.';
