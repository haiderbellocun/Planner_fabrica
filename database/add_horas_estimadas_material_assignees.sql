-- Add horas_estimadas column to task_material_assignees
-- Allows storing the assigned duration when a material is assigned to someone

BEGIN;

ALTER TABLE public.task_material_assignees
ADD COLUMN IF NOT EXISTS horas_estimadas NUMERIC(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.task_material_assignees.horas_estimadas IS 'Estimated hours assigned for this material, selected from tiempos_estimados';

COMMIT;

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'task_material_assignees'
ORDER BY ordinal_position;
