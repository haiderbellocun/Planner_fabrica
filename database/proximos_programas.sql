-- Tabla para programas próximos a ingresar a la Fábrica de Contenido
CREATE TABLE IF NOT EXISTS public.proximos_programas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  escuela TEXT NOT NULL,
  nivel_programa TEXT NOT NULL CHECK (nivel_programa IN ('pregrado', 'especializacion', 'maestria', 'doctorado')),
  clasificacion_programa TEXT NOT NULL CHECK (clasificacion_programa IN ('nuevo', 'renovacion')),
  programa_con_cambio TEXT,
  programa_sin_cambio TEXT,
  modalidad TEXT NOT NULL CHECK (modalidad IN ('virtual', 'hibrida', 'presencial')),
  cantidad_asignaturas INTEGER NOT NULL DEFAULT 0,
  fecha_envio_curriculo DATE NOT NULL,
  prioridad TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'baja')),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'completado')),
  notas TEXT,

  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_proximos_programas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_proximos_programas_updated_at
  BEFORE UPDATE ON public.proximos_programas
  FOR EACH ROW EXECUTE FUNCTION update_proximos_programas_updated_at();

-- Índice para búsqueda por fecha (columna de ordenamiento principal)
CREATE INDEX IF NOT EXISTS idx_proximos_programas_fecha ON public.proximos_programas (fecha_envio_curriculo ASC);
CREATE INDEX IF NOT EXISTS idx_proximos_programas_prioridad ON public.proximos_programas (prioridad);
