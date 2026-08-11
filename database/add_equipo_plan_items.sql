-- Migration: Add equipo_plan_items (planes de trabajo semanales por equipo)
-- Cada fila es un enlace a una tarea real de Planner para un colaborador de un
-- equipo en una semana especifica (siempre lunes). El estado "terminado" nunca
-- se guarda aqui -- se lee en vivo del estado real de la tarea (tasks.status_id ->
-- task_statuses.is_completed), para que el plan y Planner nunca queden
-- desincronizados.

CREATE TABLE IF NOT EXISTS public.equipo_plan_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id   UUID NOT NULL REFERENCES public.equipos(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  week_start  DATE NOT NULL,
  added_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT equipo_plan_items_week_start_is_monday CHECK (EXTRACT(ISODOW FROM week_start) = 1),
  UNIQUE (equipo_id, profile_id, task_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_equipo_plan_items_equipo_week ON public.equipo_plan_items(equipo_id, week_start);
CREATE INDEX IF NOT EXISTS idx_equipo_plan_items_task_id     ON public.equipo_plan_items(task_id);
CREATE INDEX IF NOT EXISTS idx_equipo_plan_items_profile_id  ON public.equipo_plan_items(profile_id);

-- Verify
SELECT 'equipo_plan_items table created' AS result
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='equipo_plan_items');

SELECT 'equipo_plan_items_week_start_is_monday constraint created' AS result
WHERE EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipo_plan_items_week_start_is_monday');
