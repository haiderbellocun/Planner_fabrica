-- Add maestro_id to asignaturas table
-- This allows assigning a professor/teacher to each asignatura

ALTER TABLE public.asignaturas
ADD COLUMN maestro_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_asignaturas_maestro_id ON public.asignaturas(maestro_id);

-- Optional: Update existing asignaturas to have a default maestro (if needed)
-- UPDATE public.asignaturas SET maestro_id = 'some-profile-id' WHERE maestro_id IS NULL;
