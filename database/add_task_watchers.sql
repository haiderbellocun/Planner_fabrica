-- Migration: Add task_watchers (seguidores de una tarea)
-- Alguien no asignado que quiere enterarse de cambios en una tarea: estado y
-- comentarios nuevos. El reportero y el responsable quedan como seguidores
-- automaticos (al crear la tarea, al asignarla, o al comentar en ella);
-- cualquier otra persona puede seguir/dejar de seguir manualmente.

CREATE TABLE IF NOT EXISTS public.task_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_watchers_task_id ON public.task_watchers(task_id);
CREATE INDEX IF NOT EXISTS idx_task_watchers_user_id ON public.task_watchers(user_id);

-- Backfill: el reportero y el responsable de tareas ya existentes pasan a ser
-- seguidores, para no perder las notificaciones que ya recibian antes de este
-- cambio (ver commentsController.ts / tasksController.ts).
INSERT INTO public.task_watchers (task_id, user_id)
SELECT id, reporter_id FROM public.tasks WHERE reporter_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.task_watchers (task_id, user_id)
SELECT id, assignee_id FROM public.tasks WHERE assignee_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Verify
SELECT COUNT(*) AS task_watchers_count FROM public.task_watchers;
