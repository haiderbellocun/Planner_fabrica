-- Migration: Add subtask_of_id (subtareas creadas por el usuario)
-- Distinto de parent_task_id, que ya esta en uso para el mecanismo interno de
-- copias automaticas de tarea al asignar materiales (materialAssigneesController.ts).
-- No confundir ni reutilizar esa columna para este feature.

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS subtask_of_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_subtask_of_id ON public.tasks(subtask_of_id);

COMMENT ON COLUMN public.tasks.subtask_of_id IS
  'Subtarea creada por el usuario, independiente de parent_task_id (mecanismo interno de copias por material). Un solo nivel: una fila con subtask_of_id no puede a su vez tener subtareas propias -- reforzado en la app, no con constraint de BD.';

-- Verify
SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name='subtask_of_id';
SELECT indexname FROM pg_indexes WHERE tablename='tasks' AND indexname='idx_tasks_subtask_of_id';
