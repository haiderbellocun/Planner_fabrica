-- =====================================================
-- Add weekly capacity per profile (real capacity for reports)
-- Run after migration_local.sql (profiles must exist).
-- =====================================================

BEGIN;

-- Add column: capacity in hours per week (default 40.25 = Mon-Thu 8.25h*4 + Fri 7.25h)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_hours_capacity NUMERIC(5,2) NOT NULL DEFAULT 40.25;

COMMENT ON COLUMN public.profiles.weekly_hours_capacity IS 'Capacidad semanal en horas para reportes de utilización (default 40.25)';

COMMIT;
