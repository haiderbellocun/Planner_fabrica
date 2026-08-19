-- Migration: Add project_pins (proyectos fijados como favoritos, por usuario)
-- Personal: si un usuario fija un proyecto, solo el ve ese proyecto como
-- fijado -- no afecta a nadie mas. Mismo patron que task_watchers.

CREATE TABLE IF NOT EXISTS public.project_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_pins_project_id ON public.project_pins(project_id);
CREATE INDEX IF NOT EXISTS idx_project_pins_user_id ON public.project_pins(user_id);

-- Verify
SELECT COUNT(*) AS project_pins_count FROM public.project_pins;
