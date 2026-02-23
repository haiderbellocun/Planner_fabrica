-- Migration: Add duration estimation system
-- Adds cargo to profiles + tiempos_estimados lookup table

BEGIN;

-- 1. Add cargo column to profiles (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'cargo'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN cargo TEXT;
  END IF;
END $$;

-- 2. Create tiempos_estimados table
CREATE TABLE IF NOT EXISTS public.tiempos_estimados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto TEXT NOT NULL,
    cargo TEXT NOT NULL,
    cantidad_descripcion TEXT,
    cantidad_valor NUMERIC,
    cantidad_unidad TEXT,
    horas NUMERIC NOT NULL,
    material_type_id UUID REFERENCES public.material_types(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_tiempos_producto_cargo ON public.tiempos_estimados(producto, cargo);
CREATE INDEX IF NOT EXISTS idx_tiempos_material_type ON public.tiempos_estimados(material_type_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_tiempos_estimados_updated_at ON public.tiempos_estimados;
CREATE TRIGGER update_tiempos_estimados_updated_at
    BEFORE UPDATE ON public.tiempos_estimados
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Seed tiempos_estimados from TIEMPOS GRÁFICA.xlsx data
-- Clear existing data first
DELETE FROM public.tiempos_estimados;

-- Bibliografía (maps to bibliografia material type)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES ('Bibliografía', 'GIF', '30 referencias por asignatura', 30, 'referencias', 0.5,
  (SELECT id FROM public.material_types WHERE name = 'bibliografia'));

-- GUION (GIF - script writing, no direct material type mapping)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas)
VALUES
  ('Guion', 'GIF', '10 páginas', 10, 'paginas', 2.5),
  ('Guion', 'GIF', '16 páginas', 16, 'paginas', 3.5),
  ('Guion', 'GIF', '24 páginas', 24, 'paginas', 5.5);

-- GUION GRÁFICO (GIF)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas)
VALUES
  ('Guion Gráfico', 'GIF', '10 páginas', 10, 'paginas', 2),
  ('Guion Gráfico', 'GIF', '16 páginas', 16, 'paginas', 4),
  ('Guion Gráfico', 'GIF', '24 páginas', 24, 'paginas', 6);

-- Actividades Moodle (maps to actividades_moodle)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES
  ('Actividades Moodle', 'GIF', '10 páginas', 10, 'paginas', 2,
    (SELECT id FROM public.material_types WHERE name = 'actividades_moodle')),
  ('Actividades Moodle', 'GIF', '16 páginas', 16, 'paginas', 4,
    (SELECT id FROM public.material_types WHERE name = 'actividades_moodle')),
  ('Actividades Moodle', 'GIF', '24 páginas', 24, 'paginas', 6,
    (SELECT id FROM public.material_types WHERE name = 'actividades_moodle'));

-- PDF (Analista de diseño, maps to pdf)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES
  ('PDF', 'Analista de diseño', '10 páginas', 10, 'paginas', 1,
    (SELECT id FROM public.material_types WHERE name = 'pdf')),
  ('PDF', 'Analista de diseño', '16 páginas', 16, 'paginas', 2,
    (SELECT id FROM public.material_types WHERE name = 'pdf')),
  ('PDF', 'Analista de diseño', '24 páginas', 24, 'paginas', 2.5,
    (SELECT id FROM public.material_types WHERE name = 'pdf'));

-- Podcast - Presentadora (maps to podcast)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES
  ('Podcast', 'Presentadora', '3 minutos', 3, 'minutos', 5,
    (SELECT id FROM public.material_types WHERE name = 'podcast')),
  ('Podcast', 'Presentadora', '3 minutos (edición)', 3, 'minutos', 8,
    (SELECT id FROM public.material_types WHERE name = 'podcast'));

-- Guion de Podcast (GIF)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES
  ('Guion de Podcast', 'GIF', '3 minutos', 3, 'minutos', 2,
    (SELECT id FROM public.material_types WHERE name = 'podcast'));

-- Podcast - Analista de diseño (post-production)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES
  ('Podcast', 'Analista de diseño', '3 minutos', 3, 'minutos', 3,
    (SELECT id FROM public.material_types WHERE name = 'podcast'));

-- Video Experto - EXPERTO TEMÁTICO (maps to video_experto)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES
  ('Video Experto', 'Experto Temático', '3 minutos', 3, 'minutos', 4,
    (SELECT id FROM public.material_types WHERE name = 'video_experto')),
  ('Video Experto', 'Experto Temático', '5 minutos', 5, 'minutos', 5,
    (SELECT id FROM public.material_types WHERE name = 'video_experto'));

-- Video Experto - Analista de diseño (editing/post)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES
  ('Video Experto', 'Analista de diseño', '3 minutos', 3, 'minutos', 4,
    (SELECT id FROM public.material_types WHERE name = 'video_experto')),
  ('Video Experto', 'Analista de diseño', '5 minutos', 5, 'minutos', 4.5,
    (SELECT id FROM public.material_types WHERE name = 'video_experto'));

-- Infografía (Analista de diseño, maps to infografia)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES
  ('Infografía', 'Analista de diseño', '1 unidad', 1, 'unidad', 4,
    (SELECT id FROM public.material_types WHERE name = 'infografia')),
  ('Infografía', 'Analista de diseño', '2 unidades', 2, 'unidad', 6,
    (SELECT id FROM public.material_types WHERE name = 'infografia'));

-- Plantilla Infografía (Analista de diseño)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES
  ('Plantilla Infografía', 'Analista de diseño', '1 unidad', 1, 'unidad', 3,
    (SELECT id FROM public.material_types WHERE name = 'infografia'));

-- Revista Digital (Analista de diseño, maps to revista_digital)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES
  ('Revista Digital', 'Analista de diseño', '10 páginas', 10, 'paginas', 2,
    (SELECT id FROM public.material_types WHERE name = 'revista_digital')),
  ('Revista Digital', 'Analista de diseño', '15 páginas', 15, 'paginas', 2.5,
    (SELECT id FROM public.material_types WHERE name = 'revista_digital')),
  ('Revista Digital', 'Analista de diseño', '20 páginas', 20, 'paginas', 5,
    (SELECT id FROM public.material_types WHERE name = 'revista_digital'));

-- Plantilla Revista Digital (Analista de diseño)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES
  ('Plantilla Revista Digital', 'Analista de diseño', '10 páginas', 10, 'paginas', 14,
    (SELECT id FROM public.material_types WHERE name = 'revista_digital'));

-- Plantilla Interfaz (Analista de diseño)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas)
VALUES
  ('Plantilla Interfaz', 'Analista de diseño', '1 unidad', 1, 'unidad', 7);

-- FICHAS (Analista de diseño, maps to fichas_bibliograficas)
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES
  ('Fichas', 'Analista de diseño', '10 páginas', 10, 'paginas', 1,
    (SELECT id FROM public.material_types WHERE name = 'fichas_bibliograficas')),
  ('Fichas', 'Analista de diseño', '16 páginas', 16, 'paginas', 2,
    (SELECT id FROM public.material_types WHERE name = 'fichas_bibliograficas')),
  ('Fichas', 'Analista de diseño', '24 páginas', 24, 'paginas', 4,
    (SELECT id FROM public.material_types WHERE name = 'fichas_bibliograficas'));

-- Videos Promocionales - Presentadora
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES
  ('Video Promocional', 'Presentadora', '1 minuto', 1, 'minutos', 4,
    (SELECT id FROM public.material_types WHERE name = 'video_generativo')),
  ('Video Promocional', 'Presentadora', '30 segundos', 30, 'segundos', 4,
    (SELECT id FROM public.material_types WHERE name = 'video_generativo'));

-- Guión Videos Promocionales - Presentadora
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES
  ('Guión Video Promocional', 'Presentadora', '1 minuto', 1, 'minutos', 2,
    (SELECT id FROM public.material_types WHERE name = 'video_generativo')),
  ('Guión Video Promocional', 'Presentadora', '30 segundos', 30, 'segundos', 2,
    (SELECT id FROM public.material_types WHERE name = 'video_generativo'));

-- Post Videos Promocionales - Analista de diseño
INSERT INTO public.tiempos_estimados (producto, cargo, cantidad_descripcion, cantidad_valor, cantidad_unidad, horas, material_type_id)
VALUES
  ('Post Video Promocional', 'Analista de diseño', '1 minuto', 1, 'minutos', 8,
    (SELECT id FROM public.material_types WHERE name = 'video_generativo')),
  ('Post Video Promocional', 'Analista de diseño', '30 segundos', 30, 'segundos', 6,
    (SELECT id FROM public.material_types WHERE name = 'video_generativo'));

-- 4. Update profiles with cargo data from HACER UN LISTADO (3).xlsx
UPDATE public.profiles SET cargo = 'Analista de diseño'
WHERE email IN (
  'anibal_anguloor@cun.edu.co', 'blanca_herrera@cun.edu.co', 'brayan_gutierrezm@cun.edu.co',
  'daissy_ardila@cun.edu.co', 'daniel_perezs@cun.edu.co', 'daniel_castrog@cun.edu.co',
  'danna_poveda@cun.edu.co', 'dario_navarro@cun.edu.co', 'david_lizarazo@cun.edu.co',
  'diegof_perez@cun.edu.co', 'doris_avilah@cun.edu.co', 'ginna_garzon@cun.edu.co',
  'jesica_carrillo@cun.edu.co', 'juan_hermida@cun.edu.co', 'juan_sanabriad@cun.edu.co',
  'juliana_correa@cun.edu.co', 'laura_patino@cun.edu.co', 'lesly_cardozo@cun.edu.co',
  'luis_cuspian@cun.edu.co', 'nicolas_quintana@cun.edu.co', 'nidia_prada@cun.edu.co',
  'raul_aldana@cun.edu.co', 'victor_gomezto@cun.edu.co', 'juan_lemos@cun.edu.co',
  'laura_perezve@cun.edu.co'
);

-- Case-insensitive match for emails with mixed case
UPDATE public.profiles SET cargo = 'Analista de diseño'
WHERE LOWER(email) = 'marly_perez@cun.edu.co';

UPDATE public.profiles SET cargo = 'GIF'
WHERE LOWER(email) IN (
  'diana_vargasca@cun.edu.co', 'juan_butrabi@cun.edu.co',
  'sandra_molano@cun.edu.co', 'victor_mendigano@cun.edu.co',
  'maria_cruz@cun.edu.co', 'julian_espitia@cun.edu.co'
);

UPDATE public.profiles SET cargo = 'Presentadora'
WHERE LOWER(email) IN (
  'danna_fierro@gmail.com', 'katherin_araquep@cun.edu.co'
);

COMMIT;
