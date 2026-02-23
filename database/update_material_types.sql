-- Update material types with new list
-- Run this to replace all material types

BEGIN;

-- First, delete all materiales_requeridos (they reference material_types)
DELETE FROM public.materiales_requeridos;

-- Then delete existing material types
DELETE FROM public.material_types;

-- Insert new material types
INSERT INTO public.material_types (name, description, icon, display_order) VALUES
    ('tapas_banner', 'Tapas y Banner', '🎨', 1),
    ('bibliografia', 'Bibliografía', '📚', 2),
    ('portada', 'Portada', '📑', 3),
    ('revista_digital', 'Revista Digital', '📰', 4),
    ('pdf', 'PDF', '📄', 5),
    ('glosario', 'Glosario', '📖', 6),
    ('fichas_bibliograficas', 'Fichas Bibliográficas', '📇', 7),
    ('video_generativo', 'Video Generativo', '🎬', 8),
    ('actividades_moodle', 'Actividades Moodle', '✍️', 9),
    ('multimedia', 'Multimedia', '🎭', 10),
    ('video_experto', 'Video Experto', '🎥', 11),
    ('podcast', 'Podcast', '🎙️', 12),
    ('infografia', 'Infografía', '📊', 13);

COMMIT;

-- Verify the update
SELECT name, description, icon FROM public.material_types ORDER BY display_order;
