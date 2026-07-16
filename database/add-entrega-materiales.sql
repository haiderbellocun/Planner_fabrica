-- Enlaza entregas a proyectos reales y captura el detalle materia x tipo de material x cantidad entregada

ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS proyecto_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.entrega_materiales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id UUID NOT NULL REFERENCES public.entregas(id) ON DELETE CASCADE,
  asignatura_id UUID NOT NULL REFERENCES public.asignaturas(id) ON DELETE CASCADE,
  material_type_id UUID NOT NULL REFERENCES public.material_types(id) ON DELETE RESTRICT,
  cantidad_entregada INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_entregada >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (entrega_id, asignatura_id, material_type_id)
);

CREATE INDEX IF NOT EXISTS idx_entrega_materiales_entrega ON public.entrega_materiales(entrega_id);
