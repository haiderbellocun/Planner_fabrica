-- Add category to projects: 'academico' | 'marketing' | 'otros'
-- For Marketing/Otros, normal users will only see tasks assigned to them.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN public.projects.category IS 'Tipo de proyecto: academico, marketing, otros. En marketing/otros los usuarios solo ven sus tareas asignadas.';
