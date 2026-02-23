-- Add ability to assign different users to each tema within a task
-- This allows project leaders to distribute work by tema

BEGIN;

-- Create table to store tema assignments within tasks
CREATE TABLE IF NOT EXISTS public.task_tema_assignees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    tema_id UUID NOT NULL REFERENCES public.temas(id) ON DELETE CASCADE,
    assignee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure one assignee per tema per task
    UNIQUE(task_id, tema_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_tema_assignees_task_id ON public.task_tema_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tema_assignees_tema_id ON public.task_tema_assignees(tema_id);
CREATE INDEX IF NOT EXISTS idx_task_tema_assignees_assignee_id ON public.task_tema_assignees(assignee_id);

-- Add trigger for updated_at
CREATE TRIGGER update_task_tema_assignees_updated_at
    BEFORE UPDATE ON public.task_tema_assignees
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add comment
COMMENT ON TABLE public.task_tema_assignees IS 'Allows assigning different users to each tema within a task for distributed work';

COMMIT;

-- Verify
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'task_tema_assignees'
ORDER BY ordinal_position;
