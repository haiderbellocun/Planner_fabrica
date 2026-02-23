-- Update task statuses
-- New statuses: Sin iniciar, En proceso, En pausa, En revisión, Ajustes, Finalizado

BEGIN;

-- Update existing statuses
UPDATE public.task_statuses
SET name = 'Sin iniciar', display_order = 0
WHERE name = 'Pendiente';

UPDATE public.task_statuses
SET name = 'En proceso', display_order = 1
WHERE name = 'En Progreso';

UPDATE public.task_statuses
SET name = 'En revisión', display_order = 3
WHERE name = 'En Revisión';

UPDATE public.task_statuses
SET name = 'Finalizado', color = '#059669', display_order = 5
WHERE name = 'Completado';

-- Insert new statuses if they don't exist
INSERT INTO public.task_statuses (name, color, description, display_order)
SELECT 'En pausa', '#9CA3AF', 'Tarea pausada temporalmente', 2
WHERE NOT EXISTS (SELECT 1 FROM public.task_statuses WHERE name = 'En pausa');

INSERT INTO public.task_statuses (name, color, description, display_order)
SELECT 'Ajustes', '#F97316', 'Tarea requiere ajustes después de revisión', 4
WHERE NOT EXISTS (SELECT 1 FROM public.task_statuses WHERE name = 'Ajustes');

COMMIT;

-- Verify the changes
SELECT name, color, display_order
FROM public.task_statuses
ORDER BY display_order;
