-- Add ability to assign different users to each material within a task
-- This allows project leaders to distribute work by material type

BEGIN;

-- Create table to store material assignments within tasks
CREATE TABLE IF NOT EXISTS public.task_material_assignees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materiales_requeridos(id) ON DELETE CASCADE,
    assignee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure one assignee per material per task
    UNIQUE(task_id, material_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_material_assignees_task_id ON public.task_material_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_material_assignees_material_id ON public.task_material_assignees(material_id);
CREATE INDEX IF NOT EXISTS idx_task_material_assignees_assignee_id ON public.task_material_assignees(assignee_id);

-- Add trigger for updated_at
CREATE TRIGGER update_task_material_assignees_updated_at
    BEFORE UPDATE ON public.task_material_assignees
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.task_material_assignees IS 'Allows assigning different users to each material within a task for distributed work';

COMMIT;

-- Verify
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'task_material_assignees'
ORDER BY ordinal_position;
