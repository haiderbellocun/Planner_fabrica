-- ============================================
-- PHASE 2: Content Factory - Database Structure
-- ============================================
-- Adds support for educational content management:
-- - Program types (Profesional, Diplomado, Maestría, Doctorado)
-- - Subjects/Asignaturas per project
-- - Material types and requirements per subject
-- ============================================

-- Add tipo_programa to projects table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_programa') THEN
        CREATE TYPE tipo_programa AS ENUM ('profesional', 'diplomado', 'maestria', 'doctorado');
    END IF;
END $$;

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS tipo_programa tipo_programa;

COMMENT ON COLUMN public.projects.tipo_programa IS 'Tipo de programa educativo';

-- ============================================
-- Table: asignaturas (Subjects/Courses)
-- ============================================
CREATE TABLE IF NOT EXISTS public.asignaturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT asignaturas_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_asignaturas_project_id ON public.asignaturas(project_id);
CREATE INDEX IF NOT EXISTS idx_asignaturas_display_order ON public.asignaturas(project_id, display_order);

COMMENT ON TABLE public.asignaturas IS 'Asignaturas/materias asociadas a un proyecto educativo';
COMMENT ON COLUMN public.asignaturas.code IS 'Código de la asignatura (ej: MAT-101)';
COMMENT ON COLUMN public.asignaturas.display_order IS 'Orden de visualización';

-- ============================================
-- Table: material_types (Catalog)
-- ============================================
CREATE TABLE IF NOT EXISTS public.material_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT material_types_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_material_types_display_order ON public.material_types(display_order);

COMMENT ON TABLE public.material_types IS 'Catálogo de tipos de materiales educativos';

-- ============================================
-- Seed material types
-- ============================================
INSERT INTO public.material_types (name, description, icon, display_order) VALUES
    ('video', 'Video educativo', '🎥', 1),
    ('ppt', 'Presentación PowerPoint', '📊', 2),
    ('pdf', 'Documento PDF', '📄', 3),
    ('ficha_bibliografica', 'Ficha bibliográfica', '📚', 4),
    ('infografia', 'Infografía', '📈', 5),
    ('revista_digital', 'Revista digital', '📰', 6),
    ('guia', 'Guía de estudio', '📖', 7),
    ('actividad_evaluativa', 'Actividad evaluativa', '✏️', 8),
    ('audio', 'Audio', '🎵', 9)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Table: materiales_requeridos
-- ============================================
CREATE TABLE IF NOT EXISTS public.materiales_requeridos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asignatura_id UUID REFERENCES public.asignaturas(id) ON DELETE CASCADE NOT NULL,
    material_type_id UUID REFERENCES public.material_types(id) NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    descripcion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT materiales_requeridos_cantidad_positive CHECK (cantidad > 0),
    CONSTRAINT materiales_requeridos_unique_per_asignatura UNIQUE (asignatura_id, material_type_id)
);

CREATE INDEX IF NOT EXISTS idx_materiales_requeridos_asignatura_id ON public.materiales_requeridos(asignatura_id);
CREATE INDEX IF NOT EXISTS idx_materiales_requeridos_material_type_id ON public.materiales_requeridos(material_type_id);

COMMENT ON TABLE public.materiales_requeridos IS 'Materiales requeridos por asignatura';
COMMENT ON COLUMN public.materiales_requeridos.cantidad IS 'Cantidad de materiales de este tipo requeridos';

-- ============================================
-- Link tasks to materials (optional)
-- ============================================
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS material_requerido_id UUID REFERENCES public.materiales_requeridos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_material_requerido_id ON public.tasks(material_requerido_id);

COMMENT ON COLUMN public.tasks.material_requerido_id IS 'Material asociado a esta tarea (si aplica)';

-- ============================================
-- Triggers for updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_asignaturas_updated_at ON public.asignaturas;
CREATE TRIGGER update_asignaturas_updated_at
    BEFORE UPDATE ON public.asignaturas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_materiales_requeridos_updated_at ON public.materiales_requeridos;
CREATE TRIGGER update_materiales_requeridos_updated_at
    BEFORE UPDATE ON public.materiales_requeridos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- Helper Views
-- ============================================

-- View: Projects with content factory info
CREATE OR REPLACE VIEW public.projects_with_content AS
SELECT
    p.*,
    COUNT(DISTINCT a.id) as asignaturas_count,
    COUNT(DISTINCT mr.id) as materiales_count
FROM public.projects p
LEFT JOIN public.asignaturas a ON a.project_id = p.id
LEFT JOIN public.materiales_requeridos mr ON mr.asignatura_id = a.id
GROUP BY p.id;

COMMENT ON VIEW public.projects_with_content IS 'Proyectos con información de contenidos';

-- ============================================
-- Success Message
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Content Factory structure created successfully!';
    RAISE NOTICE '   - tipo_programa added to projects';
    RAISE NOTICE '   - asignaturas table created';
    RAISE NOTICE '   - material_types catalog seeded (9 types)';
    RAISE NOTICE '   - materiales_requeridos table created';
    RAISE NOTICE '   - tasks linked to materials';
END $$;
