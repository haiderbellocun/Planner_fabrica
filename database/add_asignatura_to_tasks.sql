-- Add asignatura_id to tasks table
-- This allows tasks to be linked directly to an asignatura and show all its temas/materiales

BEGIN;

-- Add asignatura_id column if it doesn't exist
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS asignatura_id UUID REFERENCES public.asignaturas(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_asignatura_id ON public.tasks(asignatura_id);

COMMIT;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tasks' AND column_name IN ('asignatura_id', 'material_requerido_id');
