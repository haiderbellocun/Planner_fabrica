-- Agrega campos: cantidad_semestres, materias, materiales_entregados a entregas
ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS cantidad_semestres INTEGER,
  ADD COLUMN IF NOT EXISTS materias           TEXT,
  ADD COLUMN IF NOT EXISTS materiales_entregados TEXT;
