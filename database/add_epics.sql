-- Migration: Add epics feature
-- Creates the epics table and adds epic_id to tasks

-- 1. Create epics table
CREATE TABLE IF NOT EXISTS public.epics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  color VARCHAR(20) NOT NULL DEFAULT '#6366f1',
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_epics_project_id ON public.epics(project_id);
CREATE INDEX IF NOT EXISTS idx_epics_status ON public.epics(status);

-- 3. Add epic_id to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS epic_id UUID REFERENCES public.epics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_epic_id ON public.tasks(epic_id);

-- Verify
SELECT 'epics table created' AS result
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'epics'
);

SELECT 'tasks.epic_id column added' AS result
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'epic_id'
);
