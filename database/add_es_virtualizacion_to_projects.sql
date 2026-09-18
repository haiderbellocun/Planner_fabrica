-- Migration: Add es_virtualizacion flag to projects
-- Independent of tipo_programa/category: those get set to 'desarrollo' almost
-- every time a project is created regardless of what the project actually is,
-- so they can't be trusted to tell virtualizacion projects apart from the rest.
-- NULL = sin clasificar (proyectos existentes antes de esta migracion),
-- true = es virtualizacion de contenido academico, false = no lo es.

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS es_virtualizacion BOOLEAN;

COMMENT ON COLUMN public.projects.es_virtualizacion IS
  'Si el proyecto es de virtualizacion de contenido academico. NULL = sin clasificar, true/false = clasificado. Independiente de tipo_programa y category.';

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='projects' AND column_name='es_virtualizacion';
