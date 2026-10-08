-- Cambia el estándar de capacidad semanal de 40.25h a 38h para TODOS los perfiles,
-- sin excepción (decisión explícita del equipo — no se preservan valores
-- personalizados existentes, a diferencia de lo que sugería
-- database/nullable_weekly_hours_capacity.sql para cambios futuros).
--
-- Incluye tanto los perfiles que seguían en el default heredado (40.25) como
-- cualquiera que ya tuviera un valor distinto configurado a mano, y también los
-- que estuvieran en NULL ("sin configurar") — después de esta migración nadie
-- queda sin valor.
--
-- Aplicación: correr manualmente contra la base de datos real (no hay acceso de
-- red a ella desde este entorno), con el mecanismo habitual del proyecto, p. ej.:
--   cd server && node run-migration.js ../database/update_weekly_hours_capacity_38.sql
-- Verificar después:
--   SELECT weekly_hours_capacity, COUNT(*) FROM public.profiles GROUP BY 1;
--   (debería dar una sola fila: 38 | <total de perfiles>)

BEGIN;

UPDATE public.profiles
SET weekly_hours_capacity = 38;

ALTER TABLE public.profiles
  ALTER COLUMN weekly_hours_capacity SET DEFAULT 38;

COMMENT ON COLUMN public.profiles.weekly_hours_capacity IS
  'Capacidad semanal en horas para reportes de utilización. Estándar vigente: 38h para todos los perfiles (ver database/update_weekly_hours_capacity_38.sql). NULL en perfiles creados después de esta migración = sin configurar todavía.';

COMMIT;
