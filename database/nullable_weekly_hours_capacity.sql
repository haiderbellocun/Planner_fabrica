-- Permite representar "disponibilidad sin configurar" para la capacidad semanal de un
-- perfil, en vez de forzar siempre un número.
--
-- Estado actual: public.profiles.weekly_hours_capacity es NUMERIC(5,2) NOT NULL DEFAULT 40.25
-- (ver database/add_weekly_hours_capacity.sql). Como es NOT NULL con default, HOY todo perfil
-- ya tiene un valor numérico, incluso quien nunca configuró nada a propósito -- no existe una
-- forma de distinguir "40.25 elegido a propósito" de "40.25 puesto en silencio al crear el
-- perfil". Por eso esta migración:
--
--   1. Quita el default y el NOT NULL hacia adelante (perfiles nuevos nacen en NULL hasta que
--      alguien los configure explícitamente, vía PATCH /api/profiles/:id/capacity).
--   2. A PROPÓSITO no toca los valores existentes. No hay manera de saber, para un perfil ya
--      creado, si su 40.25 actual es una elección real o el default heredado en silencio --
--      ponerlos en NULL automáticamente podría borrar una configuración real; dejarlos como
--      están asume que siguen siendo válidos hasta que alguien los revise. Se decidió NO
--      adivinar en ningún sentido.
--
-- Aplicación: correr manualmente contra la base de datos real (no se ejecutó desde esta sesión
-- por no tener acceso a la DB remota) con el mecanismo habitual del proyecto, p. ej.:
--   cd server && node run-migration.js ../database/nullable_weekly_hours_capacity.sql
-- Verificar después: SELECT count(*) FROM public.profiles WHERE weekly_hours_capacity IS NULL;
-- (debería dar 0 justo después de aplicar la migración, y solo perfiles NUEVOS deberían
-- aparecer en NULL de ahí en adelante, hasta que se configuren).

ALTER TABLE public.profiles
  ALTER COLUMN weekly_hours_capacity DROP DEFAULT,
  ALTER COLUMN weekly_hours_capacity DROP NOT NULL;

COMMENT ON COLUMN public.profiles.weekly_hours_capacity IS
  'Horas de disponibilidad semanal configuradas para esta persona. NULL = sin configurar (no asumir 40.25 ni ningún otro valor); ver database/nullable_weekly_hours_capacity.sql.';
