-- Migration: Enforce that a person can only belong to ONE equipo at a time.
-- Replaces the composite UNIQUE(equipo_id, profile_id) with a UNIQUE(profile_id).

ALTER TABLE public.equipo_members
  DROP CONSTRAINT IF EXISTS equipo_members_equipo_id_profile_id_key;

ALTER TABLE public.equipo_members
  ADD CONSTRAINT equipo_members_profile_id_key UNIQUE (profile_id);

-- Verify
SELECT 'equipo_members.profile_id is now unique' AS result
WHERE EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'equipo_members_profile_id_key'
);
