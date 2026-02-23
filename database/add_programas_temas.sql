-- Migration: Add programas and temas tables
-- This restructures the content factory to support:
-- Project → Programas → Asignaturas → Temas → Materiales

BEGIN;

-- 1. Create programas table
CREATE TABLE IF NOT EXISTS public.programas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create temas table
CREATE TABLE IF NOT EXISTS public.temas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asignatura_id UUID REFERENCES public.asignaturas(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Add programa_id to asignaturas (nullable for now)
ALTER TABLE public.asignaturas
ADD COLUMN IF NOT EXISTS programa_id UUID REFERENCES public.programas(id) ON DELETE CASCADE;

-- 4. Add tema_id to materiales_requeridos (nullable for now)
ALTER TABLE public.materiales_requeridos
ADD COLUMN IF NOT EXISTS tema_id UUID REFERENCES public.temas(id) ON DELETE CASCADE;

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_programas_project_id ON public.programas(project_id);
CREATE INDEX IF NOT EXISTS idx_programas_display_order ON public.programas(display_order);
CREATE INDEX IF NOT EXISTS idx_asignaturas_programa_id ON public.asignaturas(programa_id);
CREATE INDEX IF NOT EXISTS idx_temas_asignatura_id ON public.temas(asignatura_id);
CREATE INDEX IF NOT EXISTS idx_temas_display_order ON public.temas(display_order);
CREATE INDEX IF NOT EXISTS idx_materiales_requeridos_tema_id ON public.materiales_requeridos(tema_id);

-- 6. Add triggers for updated_at
CREATE TRIGGER update_programas_updated_at
    BEFORE UPDATE ON public.programas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_temas_updated_at
    BEFORE UPDATE ON public.temas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- 7. Drop the old NOT NULL constraint on asignaturas.project_id
-- (We'll make programa_id NOT NULL in a future migration after data migration)
ALTER TABLE public.asignaturas
ALTER COLUMN project_id DROP NOT NULL;

-- 8. Drop the old NOT NULL constraint on materiales_requeridos.asignatura_id
-- (We'll make tema_id NOT NULL in a future migration after data migration)
ALTER TABLE public.materiales_requeridos
ALTER COLUMN asignatura_id DROP NOT NULL;

COMMIT;

-- Notes for data migration:
-- After this migration, you should:
-- 1. Create default programas for existing projects if needed
-- 2. Update asignaturas to reference programas
-- 3. Create default temas for existing asignaturas if needed
-- 4. Update materiales_requeridos to reference temas
-- 5. Run a follow-up migration to make programa_id and tema_id NOT NULL
