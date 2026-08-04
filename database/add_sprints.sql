-- Migration: Add sprints (backlog/scrum planning) for tipo_programa = 'desarrollo' projects.

-- 1. sprints table
CREATE TABLE IF NOT EXISTS public.sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT,
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'completed')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON public.sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_status ON public.sprints(status);

-- 3. At most ONE active sprint per project, enforced in the database
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sprints_one_active_per_project
  ON public.sprints(project_id) WHERE status = 'active';

-- 4. tasks.sprint_id
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES public.sprints(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON public.tasks(sprint_id);

-- Verify
SELECT 'sprints table created' AS result
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sprints');

SELECT 'uniq_sprints_one_active_per_project index created' AS result
WHERE EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uniq_sprints_one_active_per_project');

SELECT 'tasks.sprint_id column added' AS result
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tasks' AND column_name='sprint_id'
);
