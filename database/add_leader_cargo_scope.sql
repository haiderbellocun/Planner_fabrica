-- =====================================================
-- Leader cargo scope: scope which cargos each project_leader sees in "Foco del equipo"
-- Run after migration_local.sql (profiles must exist).
-- =====================================================

BEGIN;

-- 1) Tabla
CREATE TABLE IF NOT EXISTS public.leader_cargo_scope (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cargo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (leader_profile_id, cargo)
);

-- 2) Índices
CREATE INDEX IF NOT EXISTS idx_leader_cargo_scope_leader_profile_id
  ON public.leader_cargo_scope (leader_profile_id);

CREATE INDEX IF NOT EXISTS idx_leader_cargo_scope_cargo
  ON public.leader_cargo_scope (cargo);

-- 3) Datos iniciales (profile_id por email)

-- Nathaly -> GIF
INSERT INTO public.leader_cargo_scope (leader_profile_id, cargo)
SELECT p.id, 'GIF'
FROM public.profiles p
WHERE p.email = 'nathaly_amaya@cun.edu.co'
ON CONFLICT (leader_profile_id, cargo) DO NOTHING;

-- Deyvis -> Analista de diseño
INSERT INTO public.leader_cargo_scope (leader_profile_id, cargo)
SELECT p.id, 'Analista de diseño'
FROM public.profiles p
WHERE p.email = 'deyvis_miranda@cun.edu.co'
ON CONFLICT (leader_profile_id, cargo) DO NOTHING;

-- German -> Presentadores + Presentadora (variantes)
INSERT INTO public.leader_cargo_scope (leader_profile_id, cargo)
SELECT p.id, 'Presentadores'
FROM public.profiles p
WHERE p.email = 'german_giraldo@cun.edu.co'
ON CONFLICT (leader_profile_id, cargo) DO NOTHING;

INSERT INTO public.leader_cargo_scope (leader_profile_id, cargo)
SELECT p.id, 'Presentadora'
FROM public.profiles p
WHERE p.email = 'german_giraldo@cun.edu.co'
ON CONFLICT (leader_profile_id, cargo) DO NOTHING;

COMMENT ON TABLE public.leader_cargo_scope IS 'Cargos (job titles) that each project_leader can see in Foco del equipo';

COMMIT;
