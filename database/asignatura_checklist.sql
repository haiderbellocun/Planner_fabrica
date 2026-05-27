-- Checklist de seguimiento por asignatura (equivalente al Excel de control)
CREATE TABLE IF NOT EXISTS public.asignatura_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asignatura_id UUID NOT NULL REFERENCES public.asignaturas(id) ON DELETE CASCADE,

  -- Estados generales
  listo_para_revisar TEXT NOT NULL DEFAULT 'sin_iniciar'
    CHECK (listo_para_revisar IN ('sin_iniciar', 'en_proceso', 'finalizado')),
  qa_status TEXT NOT NULL DEFAULT 'sin_iniciar'
    CHECK (qa_status IN ('sin_iniciar', 'en_proceso', 'finalizado')),

  -- Grupo 1 (En Revisión y/o corrección G1)
  g1_inf     BOOLEAN NOT NULL DEFAULT FALSE,
  g1_vid     BOOLEAN NOT NULL DEFAULT FALSE,
  g1_pod     BOOLEAN NOT NULL DEFAULT FALSE,
  g1_glos    BOOLEAN NOT NULL DEFAULT FALSE,
  g1_fecha   BOOLEAN NOT NULL DEFAULT FALSE,
  g1_rev     BOOLEAN NOT NULL DEFAULT FALSE,

  -- Grupo 2
  g2_inf     BOOLEAN NOT NULL DEFAULT FALSE,
  g2_vid     BOOLEAN NOT NULL DEFAULT FALSE,
  g2_pod     BOOLEAN NOT NULL DEFAULT FALSE,
  g2_glos    BOOLEAN NOT NULL DEFAULT FALSE,
  g2_fecha   BOOLEAN NOT NULL DEFAULT FALSE,
  g2_rev     BOOLEAN NOT NULL DEFAULT FALSE,

  -- Grupo 3
  g3_inf     BOOLEAN NOT NULL DEFAULT FALSE,
  g3_vid     BOOLEAN NOT NULL DEFAULT FALSE,
  g3_pod     BOOLEAN NOT NULL DEFAULT FALSE,
  g3_glos    BOOLEAN NOT NULL DEFAULT FALSE,
  g3_fecha   BOOLEAN NOT NULL DEFAULT FALSE,
  g3_rev     BOOLEAN NOT NULL DEFAULT FALSE,

  -- Grupo 4
  g4_inf     BOOLEAN NOT NULL DEFAULT FALSE,
  g4_vid     BOOLEAN NOT NULL DEFAULT FALSE,
  g4_pod     BOOLEAN NOT NULL DEFAULT FALSE,
  g4_glos    BOOLEAN NOT NULL DEFAULT FALSE,
  g4_fecha   BOOLEAN NOT NULL DEFAULT FALSE,
  g4_rev     BOOLEAN NOT NULL DEFAULT FALSE,

  -- Grupo 5
  g5_inf     BOOLEAN NOT NULL DEFAULT FALSE,
  g5_vid     BOOLEAN NOT NULL DEFAULT FALSE,
  g5_pod     BOOLEAN NOT NULL DEFAULT FALSE,
  g5_glos    BOOLEAN NOT NULL DEFAULT FALSE,
  g5_fecha   BOOLEAN NOT NULL DEFAULT FALSE,
  g5_rev     BOOLEAN NOT NULL DEFAULT FALSE,

  -- Cierre
  carga_completa      BOOLEAN NOT NULL DEFAULT FALSE,
  actividades_moodle  BOOLEAN NOT NULL DEFAULT FALSE,

  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (asignatura_id)
);

CREATE INDEX IF NOT EXISTS idx_asignatura_checklist_asignatura
  ON public.asignatura_checklist (asignatura_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_asignatura_checklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asignatura_checklist_updated_at
  BEFORE UPDATE ON public.asignatura_checklist
  FOR EACH ROW EXECUTE FUNCTION update_asignatura_checklist_updated_at();
