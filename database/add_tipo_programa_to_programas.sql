-- Add tipo_programa to programas table
-- This allows each programa to have its own type (maestria, diplomado, tecnico, tecnologo)

CREATE TYPE tipo_programa_enum AS ENUM (
  'tecnico',
  'tecnologo',
  'diplomado',
  'profesional',
  'maestria',
  'doctorado'
);

-- Add tipo_programa column to programas table
ALTER TABLE public.programas
ADD COLUMN tipo_programa tipo_programa_enum;

-- Update existing programas to have a default value (optional)
-- UPDATE public.programas SET tipo_programa = 'profesional' WHERE tipo_programa IS NULL;
