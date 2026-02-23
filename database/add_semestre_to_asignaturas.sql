-- Add semestre to asignaturas table
-- This allows specifying which semester the asignatura belongs to

ALTER TABLE public.asignaturas
ADD COLUMN semestre INTEGER;

-- Add index for better query performance
CREATE INDEX idx_asignaturas_semestre ON public.asignaturas(semestre);

-- Optional: Update existing asignaturas to have a default semestre (if needed)
-- UPDATE public.asignaturas SET semestre = 1 WHERE semestre IS NULL;
