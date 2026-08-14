-- Migration: Add horas_estimadas directly on tasks
-- Distinto de task_material_assignees.horas_estimadas (horas por material +
-- persona asignada, tomadas de un catalogo de presets sin pantalla de edicion).
-- Esta columna nueva cubre CUALQUIER tarea, sin depender de que sea de tipo
-- "material" ni de que exista un preset para su cargo/tipo -- se escribe a mano.
-- ASSIGNED_WORK_CTE (server/src/controllers/reportsMetrics.ts) usa esta columna
-- como respaldo para tareas sin desglose de materiales.

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS horas_estimadas NUMERIC(6,2);

COMMENT ON COLUMN public.tasks.horas_estimadas IS
  'Horas estimadas de esfuerzo para esta tarea, puestas a mano. Independiente de task_material_assignees.horas_estimadas (esa es por material+persona, via catalogo de presets).';

-- Verify
SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tasks' AND column_name='horas_estimadas';
