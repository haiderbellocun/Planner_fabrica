-- Migration: Add persistent ordering to tasks (Kanban board order + backlog order).
-- board_rank: position within a (project_id, status_id) Kanban column.
-- backlog_rank: position within the project's backlog / sprint list.
-- Both use fractional (midpoint) ranking so a single drag only ever writes one row.

-- 1. Add both rank columns
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS board_rank   NUMERIC(20,6),
  ADD COLUMN IF NOT EXISTS backlog_rank NUMERIC(20,6);

-- 2. Backfill board_rank reproducing today's ORDER BY created_at DESC per column
WITH ranked AS (
  SELECT id, 1000 * ROW_NUMBER() OVER (
    PARTITION BY project_id, status_id ORDER BY created_at DESC, id
  ) AS rk
  FROM public.tasks
  WHERE board_rank IS NULL
)
UPDATE public.tasks t
SET board_rank = ranked.rk
FROM ranked
WHERE ranked.id = t.id;

-- 3. Backfill backlog_rank the same way, one list per project
WITH ranked AS (
  SELECT id, 1000 * ROW_NUMBER() OVER (
    PARTITION BY project_id ORDER BY created_at DESC, id
  ) AS rk
  FROM public.tasks
  WHERE backlog_rank IS NULL
)
UPDATE public.tasks t
SET backlog_rank = ranked.rk
FROM ranked
WHERE ranked.id = t.id;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_board_rank ON public.tasks(project_id, status_id, board_rank);
CREATE INDEX IF NOT EXISTS idx_tasks_backlog_rank ON public.tasks(project_id, backlog_rank);

-- Verify
SELECT 'tasks.board_rank column added' AS result
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tasks' AND column_name='board_rank'
);

SELECT 'tasks.backlog_rank column added' AS result
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tasks' AND column_name='backlog_rank'
);

SELECT 'tasks with NULL board_rank remaining: ' || COUNT(*) AS result
FROM public.tasks WHERE board_rank IS NULL;
