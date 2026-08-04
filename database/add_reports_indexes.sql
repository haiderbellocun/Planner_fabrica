-- Migration: Indexes to support the reformulated report queries (person-metrics,
-- capacity-forecast, throughput, production-by-person, and the corrected existing
-- endpoints). task_status_history previously had only one index (on task_id) despite
-- every new query joining on to_status_id and aggregating started_at/duration_seconds.

CREATE INDEX IF NOT EXISTS idx_tsh_task_to_status_started
  ON public.task_status_history (task_id, to_status_id, started_at);

CREATE INDEX IF NOT EXISTS idx_tsh_to_status_duration
  ON public.task_status_history (to_status_id)
  WHERE duration_seconds IS NOT NULL AND duration_seconds > 0;

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status_due
  ON public.tasks (assignee_id, status_id, due_date);

-- Verify
SELECT 'idx_tsh_task_to_status_started created' AS result
WHERE EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tsh_task_to_status_started');

SELECT 'idx_tsh_to_status_duration created' AS result
WHERE EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tsh_to_status_duration');

SELECT 'idx_tasks_assignee_status_due created' AS result
WHERE EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_assignee_status_due');
