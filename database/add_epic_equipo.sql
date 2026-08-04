-- Migration: Link an épica (epic) to one of the global equipos.

ALTER TABLE public.epics
  ADD COLUMN IF NOT EXISTS equipo_id UUID REFERENCES public.equipos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_epics_equipo_id ON public.epics(equipo_id);

-- Verify
SELECT 'epics.equipo_id column added' AS result
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='epics' AND column_name='equipo_id'
);
