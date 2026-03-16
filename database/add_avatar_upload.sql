ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_changed_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.profiles.avatar_changed_at IS
  'Si tiene valor, el usuario ya subió su foto y no puede cambiarla de nuevo';

