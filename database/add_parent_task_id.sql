-- Add parent_task_id to track task copies/hierarchy
-- This allows us to distinguish between original tasks and automatic copies

BEGIN;

-- Add parent_task_id column
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks(parent_task_id);

-- Add comment explaining the field
COMMENT ON COLUMN public.tasks.parent_task_id IS 'Reference to the original task if this is an automatic copy created when a task is finalized';

COMMIT;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tasks' AND column_name = 'parent_task_id';
