-- Fix the epics status check constraint to use correct values
-- The original constraint had different status values than what the app uses

ALTER TABLE public.epics DROP CONSTRAINT IF EXISTS epics_status_check;

ALTER TABLE public.epics
  ADD CONSTRAINT epics_status_check
  CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled'));

-- Also ensure the default is correct
ALTER TABLE public.epics ALTER COLUMN status SET DEFAULT 'open';

-- Verify
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'epics_status_check';
