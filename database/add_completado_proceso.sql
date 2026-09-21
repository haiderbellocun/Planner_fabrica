-- Migration: Add a direct "completado" checkbox to asignaturas, temas and
-- materiales_requeridos. Material completion used to be inferred only from a
-- linked task's status (tasks.material_requerido_id + task_statuses.is_completed),
-- but most materiales_requeridos rows have no task behind them at all (e.g. bulk
-- content-factory migrations), so that count was stuck at 0% regardless of real
-- progress. This lets Proceso be checked off directly, independent of tasks.

ALTER TABLE public.asignaturas
ADD COLUMN IF NOT EXISTS completado BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.temas
ADD COLUMN IF NOT EXISTS completado BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.materiales_requeridos
ADD COLUMN IF NOT EXISTS completado BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.asignaturas.completado IS 'Materia marcada como completada a mano desde Proceso.';
COMMENT ON COLUMN public.temas.completado IS 'Gránulo marcado como completado a mano desde Proceso.';
COMMENT ON COLUMN public.materiales_requeridos.completado IS 'Material marcado como completado a mano desde Proceso, independiente de si tiene una tarea asociada.';

-- Verify
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema='public' AND column_name='completado'
  AND table_name IN ('asignaturas','temas','materiales_requeridos');
